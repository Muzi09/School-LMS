import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import (
    get_chat_service,
    get_current_user,
    get_db,
    get_user_repository,
)
from app.core.connection_manager import chat_connection_manager
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.chat import (
    ChatUserRead,
    ConversationMessagesResponse,
    ConversationRead,
    CreateConversationRequest,
    MarkReadResponse,
    MessageRead,
    SendMessageRequest,
)
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get(
    "/users",
    response_model=list[ChatUserRead],
    summary="Search Chat Users",
    description="Search active users within the current user's school who can be messaged.",
)
def search_chat_users(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    search: Annotated[str | None, Query(description="Search term (name, email, or mobile)")] = None,
):
    return service.search_users(current_user=current_user, search=search)


@router.get(
    "/conversations",
    response_model=list[ConversationRead],
    summary="List Conversations",
    description="Retrieve all 1-to-1 conversations for the current user.",
)
def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return service.list_conversations(current_user=current_user)


@router.post(
    "/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Get or Create Conversation",
    description="Retrieve existing or create a new 1-to-1 conversation with another school member.",
)
def create_conversation(
    data: CreateConversationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return service.get_or_create_conversation(
        current_user=current_user,
        target_user_id=data.user_id,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
    summary="Get Message History",
    description="Retrieve persisted paginated messages for a conversation.",
)
def get_messages(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit")] = 50,
    before: Annotated[datetime | None, Query(description="Cursor for pagination before timestamp")] = None,
):
    return service.get_messages(
        current_user=current_user,
        conversation_id=conversation_id,
        limit=limit,
        before=before,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message (REST)",
    description="Send a message in a conversation via REST API (also broadcasts to active WebSockets).",
)
async def send_message_rest(
    conversation_id: UUID,
    data: SendMessageRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    msg = service.send_message(
        current_user=current_user,
        conversation_id=conversation_id,
        content=data.content,
    )

    # Broadcast to active WebSockets for participants
    participant_ids = service.chat_repo.get_participant_ids(conversation_id)
    event_payload = {
        "type": "message",
        "message": msg.model_dump(mode="json"),
    }
    await chat_connection_manager.broadcast_to_users(participant_ids, event_payload)
    return msg


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
    summary="Mark Conversation Read",
    description="Update the read receipt timestamp for the current user in this conversation.",
)
async def mark_as_read(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    last_read_at = service.mark_conversation_as_read(
        current_user=current_user,
        conversation_id=conversation_id,
    )
    participant_ids = service.chat_repo.get_participant_ids(conversation_id)
    recipients = [uid for uid in participant_ids if uid != current_user.id]
    if recipients and last_read_at:
        await chat_connection_manager.broadcast_to_users(
            recipients,
            {
                "type": "read_receipt",
                "conversation_id": str(conversation_id),
                "reader_id": str(current_user.id),
                "last_read_at": last_read_at.isoformat(),
            },
        )
    return MarkReadResponse(
        success=True,
        conversation_id=conversation_id,
        last_read_at=last_read_at,
    )


async def handle_chat_websocket(
    websocket: WebSocket,
    token: str | None = None,
    db: Session | None = None,
):
    """
    Core WebSocket handler for real-time messaging.
    Validates JWT token, attaches to ConnectionManager, and processes events.
    """
    if not token:
        # Check if token in query string
        query_token = websocket.query_params.get("token")
        if query_token:
            token = query_token

    if not token:
        logger.warning("WebSocket chat connection rejected: no token provided")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise ValueError("Token missing sub")
        user_id = UUID(user_id_str)
    except Exception as e:
        logger.warning(f"WebSocket auth failed to decode token: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify user in database
    close_db_on_exit = False
    if db is None:
        from app.core.database import SessionLocal
        db = SessionLocal()
        close_db_on_exit = True

    try:
        user = db.get(User, user_id)
        if not user or not user.is_active or user.deleted_at is not None:
            logger.warning(f"WebSocket rejected: user {user_id} not found or inactive")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        school_id = user.school_id
        if not school_id:
            logger.warning(f"WebSocket rejected: user {user_id} has no associated school")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Register active connection
        await chat_connection_manager.connect(user.id, school_id, websocket)

        # Initialize service
        from app.repositories.chat_repository import ChatRepository
        from app.repositories.user_repository import UserRepository
        chat_repo = ChatRepository(db=db)
        user_repo = UserRepository(db=db)
        service = ChatService(chat_repo=chat_repo, user_repo=user_repo, db=db)

        # Track conversations where this connection started typing
        active_typing_conversations: set[UUID] = set()

        # Main message loop
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif event_type == "send_message":
                conv_id_str = data.get("conversation_id")
                content = data.get("content", "")
                temp_id = data.get("temp_id")

                try:
                    conv_id = UUID(conv_id_str)
                    active_typing_conversations.discard(conv_id)
                    msg = service.send_message(
                        current_user=user,
                        conversation_id=conv_id,
                        content=content,
                    )
                    participant_ids = chat_repo.get_participant_ids(conv_id)

                    # 1. Send confirmation with temp_id to sender
                    await websocket.send_json({
                        "type": "message_sent",
                        "temp_id": temp_id,
                        "message": msg.model_dump(mode="json"),
                    })

                    # 2. Broadcast to other participant(s)
                    recipients = [uid for uid in participant_ids if uid != user.id]
                    if recipients:
                        await chat_connection_manager.broadcast_to_users(
                            recipients,
                            {
                                "type": "message",
                                "message": msg.model_dump(mode="json"),
                            },
                        )

                except HTTPException as he:
                    await websocket.send_json({
                        "type": "message_failed",
                        "temp_id": temp_id,
                        "conversation_id": conv_id_str,
                        "error": he.detail,
                    })
                except Exception as ex:
                    logger.error(f"Error handling send_message WS: {ex}", exc_info=True)
                    await websocket.send_json({
                        "type": "message_failed",
                        "temp_id": temp_id,
                        "conversation_id": conv_id_str,
                        "error": "Failed to send message.",
                    })

            elif event_type == "typing_start":
                conv_id_str = data.get("conversation_id")
                if conv_id_str:
                    try:
                        conv_id = UUID(conv_id_str)
                        if chat_repo.is_participant(conv_id, user.id):
                            active_typing_conversations.add(conv_id)
                            participant_ids = chat_repo.get_participant_ids(conv_id)
                            recipients = [uid for uid in participant_ids if uid != user.id]
                            if recipients:
                                await chat_connection_manager.broadcast_to_users(
                                    recipients,
                                    {
                                        "type": "typing",
                                        "conversation_id": str(conv_id),
                                        "user_id": str(user.id),
                                        "is_typing": True,
                                    },
                                )
                    except Exception as ex:
                        logger.debug(f"Invalid typing_start event: {ex}")

            elif event_type == "typing_stop":
                conv_id_str = data.get("conversation_id")
                if conv_id_str:
                    try:
                        conv_id = UUID(conv_id_str)
                        active_typing_conversations.discard(conv_id)
                        if chat_repo.is_participant(conv_id, user.id):
                            participant_ids = chat_repo.get_participant_ids(conv_id)
                            recipients = [uid for uid in participant_ids if uid != user.id]
                            if recipients:
                                await chat_connection_manager.broadcast_to_users(
                                    recipients,
                                    {
                                        "type": "typing",
                                        "conversation_id": str(conv_id),
                                        "user_id": str(user.id),
                                        "is_typing": False,
                                    },
                                )
                    except Exception as ex:
                        logger.debug(f"Invalid typing_stop event: {ex}")

            elif event_type == "mark_read":
                conv_id_str = data.get("conversation_id")
                if conv_id_str:
                    try:
                        conv_id = UUID(conv_id_str)
                        last_read_at = service.mark_conversation_as_read(user, conv_id)
                        participant_ids = chat_repo.get_participant_ids(conv_id)
                        recipients = [uid for uid in participant_ids if uid != user.id]
                        if recipients and last_read_at:
                            await chat_connection_manager.broadcast_to_users(
                                recipients,
                                {
                                    "type": "read_receipt",
                                    "conversation_id": str(conv_id),
                                    "reader_id": str(user.id),
                                    "last_read_at": last_read_at.isoformat(),
                                },
                            )
                    except Exception:
                        pass

    except WebSocketDisconnect:
        await chat_connection_manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket unexpected exception: {e}", exc_info=True)
        await chat_connection_manager.disconnect(user_id, websocket)
    finally:
        # Clean up any ephemeral typing state on disconnect
        if active_typing_conversations:
            for c_id in list(active_typing_conversations):
                try:
                    p_ids = chat_repo.get_participant_ids(c_id)
                    recips = [uid for uid in p_ids if uid != user.id]
                    if recips:
                        await chat_connection_manager.broadcast_to_users(
                            recips,
                            {
                                "type": "typing",
                                "conversation_id": str(c_id),
                                "user_id": str(user.id),
                                "is_typing": False,
                            },
                        )
                except Exception:
                    pass
            active_typing_conversations.clear()
        if close_db_on_exit and db:
            db.close()


@router.websocket("/ws")
async def chat_websocket_route(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    """Router-mounted WebSocket endpoint: /api/v1/chat/ws"""
    await handle_chat_websocket(websocket, token=token, db=db)
