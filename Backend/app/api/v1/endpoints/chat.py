import asyncio
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
from starlette.concurrency import run_in_threadpool

from app.api.deps import (
    get_chat_service,
    get_current_user,
    get_db,
    get_user_repository,
    require_staff_or_principal,
)
from app.core.connection_manager import chat_connection_manager
from app.core.browser_session import COOKIE_NAME, find_browser_user
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.enums import UserRole
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository
from app.models.user import User
from app.schemas.chat import (
    AddParticipantsRequest,
    ChatUserRead,
    ConversationDetailsResponse,
    ConversationMessagesResponse,
    ConversationRead,
    CreateBroadcastRequest,
    CreateConversationRequest,
    CreateGroupRequest,
    MarkReadResponse,
    MessageRead,
    SendMessageRequest,
    TransferOwnershipRequest,
    UpdateConversationRequest,
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
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    search: Annotated[str | None, Query(description="Search term (name, email, or mobile)")] = None,
):
    return service.search_users(current_user=current_user, search=search)


@router.get(
    "/conversations",
    response_model=list[ConversationRead],
    summary="List Conversations",
    description="Retrieve all conversations (direct, group, broadcast) for the current user.",
)
def list_conversations(
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return service.list_conversations(current_user=current_user)


@router.post(
    "/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Get or Create Direct Conversation",
    description="Retrieve existing or create a new 1-to-1 conversation with another school member.",
)
def create_conversation(
    data: CreateConversationRequest,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return service.get_or_create_conversation(
        current_user=current_user,
        target_user_id=data.user_id,
    )


@router.post(
    "/conversations/groups",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Group Conversation",
    description="Create a new group conversation with multiple school members.",
)
async def create_group_conversation(
    data: CreateGroupRequest,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    conv = service.create_group(
        current_user=current_user,
        name=data.name,
        participant_ids=data.participant_ids,
    )
    participant_ids = service.chat_repo.get_participant_ids(conv.id)
    # Notify active members about new group
    await chat_connection_manager.broadcast_to_users(
        participant_ids,
        {
            "type": "conversation_created",
            "conversation_id": str(conv.id),
        },
    )
    return conv


@router.post(
    "/conversations/broadcasts",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Broadcast List",
    description="Create a new one-way broadcast announcement list.",
)
async def create_broadcast_conversation(
    data: CreateBroadcastRequest,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    conv = service.create_broadcast(
        current_user=current_user,
        name=data.name,
        recipient_ids=data.recipient_ids,
    )
    participant_ids = service.chat_repo.get_participant_ids(conv.id)
    await chat_connection_manager.broadcast_to_users(
        participant_ids,
        {
            "type": "conversation_created",
            "conversation_id": str(conv.id),
        },
    )
    return conv


@router.get(
    "/conversations/{conversation_id}/details",
    response_model=ConversationDetailsResponse,
    summary="Get Conversation Details",
    description="Get metadata and full participant roster for a conversation.",
)
def get_conversation_details(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return service.get_conversation_details(
        current_user=current_user,
        conversation_id=conversation_id,
    )


@router.patch(
    "/conversations/{conversation_id}",
    response_model=dict,
    summary="Update Conversation Name",
    description="Rename a group or broadcast list (Admin/Owner only).",
)
async def update_conversation(
    conversation_id: UUID,
    data: UpdateConversationRequest,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    service.update_group_name(
        current_user=current_user,
        conversation_id=conversation_id,
        name=data.name,
    )
    participant_ids = service.chat_repo.get_participant_ids(conversation_id)
    await chat_connection_manager.broadcast_to_users(
        participant_ids,
        {
            "type": "conversation_updated",
            "conversation_id": str(conversation_id),
        },
    )
    return {"success": True, "name": data.name}


@router.post(
    "/conversations/{conversation_id}/participants",
    response_model=dict,
    summary="Add Group Participants",
    description="Add new participants to a group or broadcast (Admin/Owner only).",
)
async def add_participants(
    conversation_id: UUID,
    data: AddParticipantsRequest,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    added = service.add_group_participants(
        current_user=current_user,
        conversation_id=conversation_id,
        user_ids=data.user_ids,
    )
    participant_ids = service.chat_repo.get_participant_ids(conversation_id)
    await chat_connection_manager.broadcast_to_users(
        participant_ids,
        {
            "type": "conversation_updated",
            "conversation_id": str(conversation_id),
        },
    )
    return {"success": True, "added_count": len(added)}


@router.delete(
    "/conversations/{conversation_id}/participants/{user_id}",
    response_model=dict,
    summary="Remove Group Participant",
    description="Remove a participant from a group or broadcast (Admin/Owner only).",
)
async def remove_participant(
    conversation_id: UUID,
    user_id: UUID,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    participant_ids_before = service.chat_repo.get_participant_ids(conversation_id)
    service.remove_group_participant(
        current_user=current_user,
        conversation_id=conversation_id,
        target_user_id=user_id,
    )
    # Notify remaining participants and removed user
    await chat_connection_manager.broadcast_to_users(
        participant_ids_before,
        {
            "type": "conversation_updated",
            "conversation_id": str(conversation_id),
            "removed_user_id": str(user_id),
        },
    )
    return {"success": True}


@router.post(
    "/conversations/{conversation_id}/leave",
    response_model=dict,
    summary="Leave Group",
    description="Leave a group conversation, assigning a new admin if the current owner leaves.",
)
async def leave_group(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    data: TransferOwnershipRequest | None = None,
):
    participant_ids_before = service.chat_repo.get_participant_ids(conversation_id)
    new_owner = data.new_owner_id if data else None
    service.leave_group(
        current_user=current_user,
        conversation_id=conversation_id,
        new_owner_id=new_owner,
    )
    await chat_connection_manager.broadcast_to_users(
        participant_ids_before,
        {
            "type": "conversation_updated",
            "conversation_id": str(conversation_id),
            "left_user_id": str(current_user.id),
        },
    )
    return {"success": True}


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
    summary="Get Message History",
    description="Retrieve persisted paginated messages for a conversation.",
)
def get_messages(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
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
    current_user: Annotated[User, Depends(require_staff_or_principal)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    msg, created = await run_in_threadpool(
        service.send_message, current_user, conversation_id, data.content, data.client_message_id,
    )
    if created:
        participant_ids = await run_in_threadpool(service.chat_repo.get_participant_ids, conversation_id)
        await chat_connection_manager.broadcast_to_users(
            [user_id for user_id in participant_ids if user_id != current_user.id],
            {"type": "message", "message": msg.model_dump(mode="json")},
        )
    return msg


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
    summary="Mark Conversation Read",
    description="Update the read receipt timestamp for the current user in this conversation.",
)
async def mark_as_read(
    conversation_id: UUID,
    current_user: Annotated[User, Depends(require_staff_or_principal)],
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


def _socket_actor(db: Session, token: str | None) -> User | None:
    user = find_browser_user(db, token)
    if user is None or user.school_id is None or user.role not in {UserRole.STAFF, UserRole.PRINCIPAL}:
        return None
    return user


def _socket_identity(token: str | None) -> tuple[UUID, UUID] | None:
    with SessionLocal() as db:
        user = _socket_actor(db, token)
        return (user.id, user.school_id) if user else None


def _process_socket_event(token: str, identity: tuple[UUID, UUID], data: dict):
    event = data.get("type")
    with SessionLocal() as db:
        user = _socket_actor(db, token)
        if not user or (user.id, user.school_id) != identity:
            return None
        if event == "ping":
            return {"type": "pong"}, [], None
        if event not in {"send_message", "typing_start", "typing_stop", "mark_read"}:
            return {"type": "error", "error": "Unrecognized chat event."}, [], None

        repo = ChatRepository(db)
        service = ChatService(chat_repo=repo, user_repo=UserRepository(db), db=db)
        try:
            conversation_id = UUID(str(data.get("conversation_id")))
            conversation = repo.get_conversation_by_id(conversation_id)
            if conversation is None or not service.can_view_conversation(user, conversation):
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

            recipients = [uid for uid in repo.get_participant_ids(conversation_id) if uid != user.id]
            if event == "send_message":
                payload = SendMessageRequest(content=data.get("content"), client_message_id=data.get("temp_id"))
                message, created = service.send_message(
                    user, conversation_id, payload.content, payload.client_message_id,
                )
                output = message.model_dump(mode="json")
                return (
                    {"type": "message_sent", "temp_id": data.get("temp_id"), "message": output},
                    recipients if created else [],
                    {"type": "message", "message": output},
                )
            if event == "mark_read":
                last_read_at = service.mark_conversation_as_read(user, conversation_id)
                return None, recipients, {
                    "type": "read_receipt", "conversation_id": str(conversation_id),
                    "reader_id": str(user.id), "last_read_at": last_read_at.isoformat(),
                }
            if conversation.type == "BROADCAST":
                return None, [], None
            return None, recipients, {
                "type": "typing", "conversation_id": str(conversation_id),
                "user_id": str(user.id), "user_name": f"{user.first_name} {user.last_name}".strip(),
                "is_typing": event == "typing_start",
            }
        except (HTTPException, ValueError) as exc:
            if event == "send_message":
                detail = exc.detail if isinstance(exc, HTTPException) else "Invalid message."
                return {"type": "message_failed", "temp_id": data.get("temp_id"), "error": detail}, [], None
            return None, [], None


async def handle_chat_websocket(websocket: WebSocket) -> None:
    token = websocket.cookies.get(COOKIE_NAME)
    if websocket.headers.get("origin") not in settings.frontend_origins or not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    identity = await run_in_threadpool(_socket_identity, token)
    if identity is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id, school_id = identity
    await chat_connection_manager.connect(user_id, school_id, websocket)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=25)
            except TimeoutError:
                if await run_in_threadpool(_socket_identity, token) != identity:
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    break
                await chat_connection_manager.refresh(user_id, websocket)
                continue
            except ValueError:
                await websocket.send_json({"type": "error", "error": "Invalid chat event."})
                continue
            if not isinstance(data, dict):
                continue

            result = await run_in_threadpool(_process_socket_event, token, identity, data)
            if result is None:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                break
            reply, recipients, event = result
            if reply and reply.get("type") == "pong":
                await chat_connection_manager.refresh(user_id, websocket)
            if reply:
                await websocket.send_json(reply)
            if recipients and event:
                await chat_connection_manager.broadcast_to_users(recipients, event)
    except WebSocketDisconnect:
        pass
    finally:
        await chat_connection_manager.disconnect(user_id, websocket)


@router.websocket("/ws")
async def chat_websocket_route(websocket: WebSocket):
    await handle_chat_websocket(websocket)
