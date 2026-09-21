from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class ConversationType(str, Enum):
    DIRECT = "DIRECT"
    GROUP = "GROUP"
    BROADCAST = "BROADCAST"


class ParticipantRole(str, Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class MessageType(str, Enum):
    TEXT = "TEXT"
    SYSTEM = "SYSTEM"


class ChatUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str | None = None
    role: UserRole
    role_name: str | None = None
    avatar: str | None = None
    is_online: bool = False
    last_seen_at: datetime | None = None


class ConversationParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    first_name: str
    last_name: str
    email: str | None = None
    role_name: str | None = None
    group_role: str = "MEMBER"
    is_online: bool = False
    last_seen_at: datetime | None = None


class CreateConversationRequest(BaseModel):
    user_id: UUID = Field(..., description="ID of the user to start a direct conversation with")


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name of the group")
    participant_ids: list[UUID] = Field(..., min_length=1, description="List of participant user IDs to add")


class CreateBroadcastRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name of the broadcast list")
    recipient_ids: list[UUID] = Field(..., min_length=1, description="List of recipient user IDs")


class UpdateConversationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="New name for the group/broadcast")


class AddParticipantsRequest(BaseModel):
    user_ids: list[UUID] = Field(..., min_length=1, description="List of user IDs to add to the group")


class TransferOwnershipRequest(BaseModel):
    new_owner_id: UUID = Field(..., description="User ID of the new group administrator")


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Message text content")


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_name: str | None = None
    sender_role: str | None = None
    content: str
    message_type: str = "TEXT"
    created_at: datetime
    is_read: bool = False


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str = "DIRECT"
    name: str | None = None
    created_by_id: UUID | None = None
    is_owner: bool = False
    participant_count: int = 2
    other_participant: ChatUserRead | None = None
    participants: list[ConversationParticipantRead] = []
    last_message: MessageRead | None = None
    unread_count: int = 0
    updated_at: datetime


class ConversationDetailsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    name: str | None = None
    created_by_id: UUID | None = None
    is_owner: bool = False
    created_at: datetime
    participants: list[ConversationParticipantRead] = []


class ConversationMessagesResponse(BaseModel):
    messages: list[MessageRead]
    has_more: bool = False
    next_cursor: str | None = None


class MarkReadResponse(BaseModel):
    success: bool = True
    conversation_id: UUID
    last_read_at: datetime

