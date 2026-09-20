from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.connection_manager import chat_connection_manager
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository
from app.schemas.chat import (
    ChatUserRead,
    ConversationMessagesResponse,
    ConversationRead,
    MessageRead,
)


class ChatService:
    def __init__(
        self,
        chat_repo: ChatRepository,
        user_repo: UserRepository,
        db: Session,
    ):
        self.chat_repo = chat_repo
        self.user_repo = user_repo
        self.db = db

    def can_chat(self, sender: User, recipient: User) -> bool:
        """
        Authorization boundary for chat permissions.
        For MVP, any authenticated user can chat with any other user in their school.
        Future extensions (e.g. role-specific rules) can be configured here without rewriting the chat system.
        """
        return True

    def _get_role_display_name(self, role: UserRole) -> str:
        if role == UserRole.PRINCIPAL:
            return "Principal"
        elif role == UserRole.STAFF:
            return "Staff"
        elif role == UserRole.STUDENT:
            return "Student"
        elif role == UserRole.ADMIN:
            return "Admin"
        return "Member"

    def _build_chat_user_read(self, user: User) -> ChatUserRead:
        return ChatUserRead(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role=user.role,
            role_name=self._get_role_display_name(user.role),
            avatar=None,
            is_online=chat_connection_manager.is_user_online(user.id),
        )

    def search_users(self, current_user: User, search: str | None = None) -> list[ChatUserRead]:
        """Search available contacts within the current user's school."""
        school_id = current_user.school_id
        if not school_id:
            return []

        users = self.chat_repo.search_school_users(
            school_id=school_id,
            current_user_id=current_user.id,
            search=search,
        )
        return [self._build_chat_user_read(u) for u in users]

    def get_or_create_conversation(
        self,
        current_user: User,
        target_user_id: UUID,
    ) -> ConversationRead:
        """Create or retrieve direct conversation with target user within the same school."""
        if target_user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot start a conversation with yourself.",
            )

        school_id = current_user.school_id
        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a school to participate in chat.",
            )

        target_user = self.user_repo.get_by_id(target_user_id)
        if not target_user or not target_user.is_active or target_user.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found or inactive.",
            )

        # STRICT SCHOOL ISOLATION
        if target_user.school_id != school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Communication is restricted to members of the same school.",
            )

        # Future authorization boundary
        if not self.can_chat(current_user, target_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to start a conversation with this user.",
            )

        conv = self.chat_repo.get_or_create_direct_conversation(
            school_id=school_id,
            user_a_id=current_user.id,
            user_b_id=target_user.id,
        )

        # Get latest message
        messages, _ = self.chat_repo.list_messages(conv.id, limit=1)
        last_msg = None
        if messages:
            m = messages[0]
            other_last_read = self.chat_repo.get_other_participant_last_read(conv.id, current_user.id)
            is_read = bool(other_last_read and m.created_at <= other_last_read) if m.sender_id == current_user.id else False
            last_msg = MessageRead(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=m.sender_id,
                content=m.content,
                created_at=m.created_at,
                is_read=is_read,
            )

        return ConversationRead(
            id=conv.id,
            other_participant=self._build_chat_user_read(target_user),
            last_message=last_msg,
            unread_count=0,
            updated_at=conv.updated_at,
        )

    def list_conversations(self, current_user: User) -> list[ConversationRead]:
        """List current user's conversations within their school."""
        school_id = current_user.school_id
        if not school_id:
            return []

        conv_tuples = self.chat_repo.list_user_conversations(
            school_id=school_id,
            user_id=current_user.id,
        )

        response = []
        for conv, other_user, last_message, unread_count in conv_tuples:
            if not other_user:
                continue
            last_msg_read = None
            if last_message:
                is_read = False
                if last_message.sender_id == current_user.id:
                    other_last_read = self.chat_repo.get_other_participant_last_read(conv.id, current_user.id)
                    is_read = bool(other_last_read and last_message.created_at <= other_last_read)
                last_msg_read = MessageRead(
                    id=last_message.id,
                    conversation_id=last_message.conversation_id,
                    sender_id=last_message.sender_id,
                    content=last_message.content,
                    created_at=last_message.created_at,
                    is_read=is_read,
                )
            response.append(
                ConversationRead(
                    id=conv.id,
                    other_participant=self._build_chat_user_read(other_user),
                    last_message=last_msg_read,
                    unread_count=unread_count,
                    updated_at=conv.updated_at,
                )
            )
        return response

    def get_messages(
        self,
        current_user: User,
        conversation_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> ConversationMessagesResponse:
        """Retrieve persisted messages for a conversation that current user participates in."""
        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Verify membership
        if not self.chat_repo.is_participant(conversation_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation.",
            )

        # Verify school tenancy
        if conv.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conversation belongs to another school.",
            )

        messages, has_more = self.chat_repo.list_messages(
            conversation_id=conversation_id,
            limit=limit,
            before=before,
        )

        other_last_read = self.chat_repo.get_other_participant_last_read(conversation_id, current_user.id)
        user_last_read = self.chat_repo.get_participant_last_read(conversation_id, current_user.id)

        next_cursor = messages[0].created_at.isoformat() if has_more and messages else None

        message_reads = []
        for m in messages:
            if m.sender_id == current_user.id:
                is_read = bool(other_last_read and m.created_at <= other_last_read)
            else:
                is_read = bool(user_last_read and m.created_at <= user_last_read)
            message_reads.append(
                MessageRead(
                    id=m.id,
                    conversation_id=m.conversation_id,
                    sender_id=m.sender_id,
                    content=m.content,
                    created_at=m.created_at,
                    is_read=is_read,
                )
            )

        return ConversationMessagesResponse(
            messages=message_reads,
            has_more=has_more,
            next_cursor=next_cursor,
        )

    def send_message(
        self,
        current_user: User,
        conversation_id: UUID,
        content: str,
    ) -> MessageRead:
        """Validate, persist, and return sent message."""
        clean_content = content.strip()
        if not clean_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message content cannot be empty.",
            )

        if len(clean_content) > 5000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message exceeds maximum allowed length of 5000 characters.",
            )

        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Verify participant
        if not self.chat_repo.is_participant(conversation_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to send messages in this conversation.",
            )

        # Verify school tenancy
        if conv.school_id != current_user.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conversation belongs to another school.",
            )

        msg = self.chat_repo.create_message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            content=clean_content,
        )
        return MessageRead.model_validate(msg)

    def mark_conversation_as_read(
        self,
        current_user: User,
        conversation_id: UUID,
    ) -> datetime:
        """Mark a conversation as read by the current user."""
        if not self.chat_repo.is_participant(conversation_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation.",
            )

        return self.chat_repo.mark_as_read(conversation_id, current_user.id)
