import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import WebSocket, WebSocketDisconnect
from redis import Redis
from redis.asyncio import Redis as AsyncRedis
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger(__name__)
CHANNEL = "school-lms:chat"
LEASE_SECONDS = 60


def _save_last_seen(user_id: UUID, seen_at: datetime) -> None:
    from app.core.database import SessionLocal
    from app.models.user import User

    with SessionLocal.begin() as db:
        user = db.get(User, user_id)
        if user:
            user.last_seen_at = seen_at


class ConnectionManager:
    def __init__(self):
        self._connections: dict[UUID, dict[WebSocket, str]] = {}
        self._user_schools: dict[UUID, UUID] = {}
        self._broker: AsyncRedis | None = None
        self._lookup: Redis | None = None
        self._listener: asyncio.Task | None = None

    async def start(self) -> None:
        if not settings.CHAT_REDIS_URL:
            return
        self._broker = AsyncRedis.from_url(
            settings.CHAT_REDIS_URL, decode_responses=True, socket_connect_timeout=2,
        )
        self._lookup = Redis.from_url(settings.CHAT_REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        subscription = self._broker.pubsub()
        try:
            await asyncio.wait_for(subscription.subscribe(CHANNEL), timeout=3)
            acknowledgment = await subscription.get_message(ignore_subscribe_messages=False, timeout=3)
            if not acknowledgment or acknowledgment["type"] != "subscribe" or acknowledgment["channel"] != CHANNEL:
                raise RuntimeError("The chat broker did not confirm its subscription.")
        except (Exception, asyncio.CancelledError):
            await subscription.aclose()
            await self.stop()
            raise
        self._listener = asyncio.create_task(self._listen(subscription))

    async def stop(self) -> None:
        if self._listener:
            self._listener.cancel()
            await asyncio.gather(self._listener, return_exceptions=True)
            self._listener = None
        if self._broker:
            await self._broker.aclose()
            self._broker = None
        if self._lookup:
            self._lookup.close()
            self._lookup = None

    async def _listen(self, subscription) -> None:
        delay = 1
        try:
            while True:
                try:
                    item = await subscription.get_message(ignore_subscribe_messages=True, timeout=1)
                    if item:
                        await self._deliver(json.loads(item["data"]))
                    delay = 1
                except RedisError:
                    logger.warning("Chat broker listener disconnected. Retrying.")
                    await asyncio.sleep(delay)
                    delay = min(15, delay * 2)
                except (KeyError, TypeError, ValueError):
                    logger.warning("Ignoring an invalid chat broker event.")
        finally:
            await subscription.aclose()

    @staticmethod
    def _presence_key(user_id: UUID) -> str:
        return f"{CHANNEL}:presence:{user_id}"

    async def _write_lease(self, user_id: UUID, lease: str, *, remove: bool = False) -> tuple[bool, bool] | None:
        if self._broker is None:
            return None
        now = time.time()
        key = self._presence_key(user_id)
        async with self._broker.pipeline(transaction=True) as pipeline:
            pipeline.zremrangebyscore(key, "-inf", now)
            pipeline.zcard(key)
            if remove:
                pipeline.zrem(key, lease)
            else:
                pipeline.zadd(key, {lease: now + LEASE_SECONDS})
            pipeline.zcard(key)
            pipeline.expire(key, LEASE_SECONDS * 2)
            try:
                _, before, _, after, _ = await asyncio.wait_for(pipeline.execute(), timeout=2)
            except (RedisError, TimeoutError):
                logger.warning("Chat broker presence update failed.")
                return None
        return bool(before), bool(after)

    async def refresh(self, user_id: UUID, socket: WebSocket) -> None:
        lease = self._connections.get(user_id, {}).get(socket)
        if lease:
            await self._write_lease(user_id, lease)

    async def connect(self, user_id: UUID, school_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        sockets = self._connections.setdefault(user_id, {})
        first_local = not sockets
        lease = uuid4().hex
        sockets[websocket] = lease
        self._user_schools[user_id] = school_id
        presence = await self._write_lease(user_id, lease)
        if (presence is not None and presence == (False, True)) or (presence is None and first_local):
            await self._broadcast_presence(user_id, school_id, True)

    async def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id, {})
        lease = sockets.pop(websocket, None)
        if lease is None:
            return
        school_id = self._user_schools.get(user_id)
        last_local = not sockets
        if last_local:
            self._connections.pop(user_id, None)
            self._user_schools.pop(user_id, None)
        presence = await self._write_lease(user_id, lease, remove=True)
        if school_id and ((presence is not None and not presence[1]) or (presence is None and last_local)):
            seen_at = datetime.now(timezone.utc)
            try:
                await run_in_threadpool(_save_last_seen, user_id, seen_at)
            except SQLAlchemyError:
                logger.warning("Could not save chat presence timestamp.")
            await self._broadcast_presence(user_id, school_id, False, seen_at)

    def is_user_online(self, user_id: UUID) -> bool:
        if self._lookup is not None:
            try:
                return bool(self._lookup.zcount(self._presence_key(user_id), time.time(), "+inf"))
            except RedisError:
                logger.warning("Chat broker presence lookup failed.")
        return bool(self._connections.get(user_id))

    async def _send_local(self, user_id: UUID, data: dict) -> None:
        sockets = tuple(self._connections.get(user_id, {}))
        for socket in sockets:
            try:
                await asyncio.wait_for(socket.send_json(data), timeout=4)
            except (WebSocketDisconnect, RuntimeError, OSError, TimeoutError):
                logger.debug("Delivery to a chat socket failed.")

    async def _deliver(self, envelope: dict) -> None:
        if "school_id" in envelope:
            school_id = UUID(envelope["school_id"])
            excluded_user = UUID(envelope["excluded_user"])
            users = [user for user, school in self._user_schools.items() if school == school_id and user != excluded_user]
        else:
            users = [UUID(user) for user in envelope["users"]]
        await asyncio.gather(*(self._send_local(user, envelope["event"]) for user in users))

    async def _publish(self, envelope: dict) -> None:
        if self._broker is not None:
            try:
                await asyncio.wait_for(self._broker.publish(CHANNEL, json.dumps(envelope)), timeout=2)
                return
            except (RedisError, TimeoutError):
                logger.warning("Chat broker delivery failed. Delivering to sockets on this process.")
        await self._deliver(envelope)

    async def broadcast_to_users(self, users: list[UUID], data: dict) -> None:
        if users:
            await self._publish({"users": [str(user) for user in users], "event": data})

    async def _broadcast_presence(
        self, user_id: UUID, school_id: UUID, is_online: bool, last_seen_at: datetime | None = None,
    ) -> None:
        await self._publish({
            "school_id": str(school_id),
            "excluded_user": str(user_id),
            "event": {
                "type": "presence", "user_id": str(user_id), "is_online": is_online,
                "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
            },
        })


chat_connection_manager = ConnectionManager()
