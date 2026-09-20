from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


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


class CreateConversationRequest(BaseModel):
    user_id: UUID = Field(..., description="ID of the user to start a conversation with")


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Message text content")


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    created_at: datetime
    is_read: bool = False


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    other_participant: ChatUserRead
    last_message: MessageRead | None = None
    unread_count: int = 0
    updated_at: datetime


class ConversationMessagesResponse(BaseModel):
    messages: list[MessageRead]
    has_more: bool = False
    next_cursor: str | None = None


class MarkReadResponse(BaseModel):
    success: bool = True
    conversation_id: UUID
    last_read_at: datetime
