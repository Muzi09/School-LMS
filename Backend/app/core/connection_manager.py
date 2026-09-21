import asyncio
from datetime import datetime, timezone
import logging
from uuid import UUID
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections for real-time chat and presence.
    Supports multiple concurrent connections per user (e.g., multiple tabs or devices).
    Scoped by school for tenant isolation.
    """

    def __init__(self):
        # Maps user_id -> set of active WebSockets
        self._connections: dict[UUID, set[WebSocket]] = {}
        # Maps user_id -> school_id
        self._user_schools: dict[UUID, UUID] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: UUID, school_id: UUID, websocket: WebSocket) -> None:
        """Register a new active WebSocket connection for a user."""
        await websocket.accept()
        first_connection = False

        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = set()
                first_connection = True
            self._connections[user_id].add(websocket)
            self._user_schools[user_id] = school_id

        logger.info(f"User {user_id} connected (total sockets for user: {len(self._connections.get(user_id, set()))})")

        if first_connection:
            await self.broadcast_presence(user_id, school_id, is_online=True)

    async def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        """Remove a closed WebSocket connection."""
        last_connection = False
        school_id = None

        async with self._lock:
            if user_id in self._connections:
                self._connections[user_id].discard(websocket)
                if not self._connections[user_id]:
                    del self._connections[user_id]
                    school_id = self._user_schools.pop(user_id, None)
                    last_connection = True

        logger.info(f"User {user_id} disconnected (remaining: {len(self._connections.get(user_id, set()))})")

        if last_connection and school_id:
            now = datetime.now(timezone.utc)
            try:
                from app.core.database import SessionLocal
                from app.models.user import User
                with SessionLocal() as db:
                    db_user = db.query(User).filter(User.id == user_id).first()
                    if db_user:
                        db_user.last_seen_at = now
                        db.commit()
            except Exception as e:
                logger.error(f"Failed to update last_seen_at for user {user_id}: {e}", exc_info=True)

            try:
                import anyio
                with anyio.CancelScope(shield=True):
                    await self.broadcast_presence(user_id, school_id, is_online=False, last_seen_at=now)
            except Exception:
                await self.broadcast_presence(user_id, school_id, is_online=False, last_seen_at=now)

    def is_user_online(self, user_id: UUID) -> bool:
        """Check if a user has at least one active connection."""
        return user_id in self._connections and len(self._connections[user_id]) > 0

    def get_online_users_for_school(self, school_id: UUID) -> set[UUID]:
        """Return the set of user IDs who are currently online in the given school."""
        return {
            uid for uid, sid in self._user_schools.items()
            if sid == school_id and self.is_user_online(uid)
        }

    async def send_personal(self, user_id: UUID, data: dict) -> None:
        """Send a JSON event to all active sockets of a specific user."""
        sockets = list(self._connections.get(user_id, set()))
        dead_sockets = []

        for ws in sockets:
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send to socket for user {user_id}: {e}")
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                if user_id in self._connections:
                    for dead in dead_sockets:
                        self._connections[user_id].discard(dead)
                    if not self._connections[user_id]:
                        del self._connections[user_id]
                        self._user_schools.pop(user_id, None)

    async def broadcast_to_users(self, user_ids: list[UUID], data: dict) -> None:
        """Broadcast a JSON event to a list of users."""
        tasks = [self.send_personal(uid, data) for uid in user_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_presence(
        self,
        user_id: UUID,
        school_id: UUID,
        is_online: bool,
        last_seen_at: datetime | None = None,
    ) -> None:
        """Broadcast a user's presence change to all active users within their school."""
        school_online_users = [
            uid for uid, sid in self._user_schools.items()
            if sid == school_id and uid != user_id
        ]
        if not school_online_users:
            return

        payload = {
            "type": "presence",
            "user_id": str(user_id),
            "is_online": is_online,
            "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
        }
        await self.broadcast_to_users(school_online_users, payload)


# Global singleton instance
chat_connection_manager = ConnectionManager()
