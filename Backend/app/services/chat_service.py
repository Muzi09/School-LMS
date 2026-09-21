from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.connection_manager import chat_connection_manager
from app.models.chat import Conversation, ConversationParticipant, Message
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository
from app.schemas.chat import (
    ChatUserRead,
    ConversationDetailsResponse,
    ConversationMessagesResponse,
    ConversationParticipantRead,
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
        Authorization boundary for direct chat permissions.
        For MVP, any authenticated user can chat with any other user in their school.
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
            last_seen_at=getattr(user, "last_seen_at", None),
        )

    def _build_participant_read(self, part: ConversationParticipant) -> ConversationParticipantRead:
        u = part.user
        return ConversationParticipantRead(
            user_id=part.user_id,
            first_name=u.first_name if u else "",
            last_name=u.last_name if u else "",
            email=u.email if u else None,
            role_name=self._get_role_display_name(u.role) if u else "Member",
            group_role=part.role,
            is_online=chat_connection_manager.is_user_online(part.user_id),
            last_seen_at=getattr(u, "last_seen_at", None),
        )

    def _build_message_read(self, msg: Message, is_read: bool = False) -> MessageRead:
        sender_name = None
        sender_role = None
        if msg.sender:
            sender_name = f"{msg.sender.first_name} {msg.sender.last_name}".strip()
            sender_role = self._get_role_display_name(msg.sender.role)

        return MessageRead(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            sender_role=sender_role,
            content=msg.content,
            message_type=getattr(msg, "message_type", "TEXT"),
            created_at=msg.created_at,
            is_read=is_read,
        )

    # --- Authorization Boundaries ---

    def can_view_conversation(self, current_user: User, conv: Conversation) -> bool:
        """Check if user is an active participant and belongs to the same school."""
        if conv.school_id != current_user.school_id:
            return False
        return self.chat_repo.is_participant(conv.id, current_user.id)

    def can_send_message(self, current_user: User, conv: Conversation) -> bool:
        """
        Check if user can send messages in this conversation.
        - DIRECT / GROUP: Any active participant can send.
        - BROADCAST: ONLY the broadcast creator/owner can send. Recipients are read-only.
        """
        if not self.can_view_conversation(current_user, conv):
            return False
        if conv.type == "BROADCAST":
            return conv.created_by_id == current_user.id
        return True

    def can_manage_group(self, current_user: User, conv: Conversation) -> bool:
        """Check if user has administrative rights over the group."""
        if conv.school_id != current_user.school_id or conv.type != "GROUP":
            return False
        if conv.created_by_id == current_user.id:
            return True
        role = self.chat_repo.get_participant_role(conv.id, current_user.id)
        return role == "ADMIN"

    def can_manage_broadcast(self, current_user: User, conv: Conversation) -> bool:
        """Check if user is the creator/owner of the broadcast list."""
        if conv.school_id != current_user.school_id or conv.type != "BROADCAST":
            return False
        return conv.created_by_id == current_user.id

    # --- User Search ---

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

    # --- Conversation CRUD ---

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
            last_msg = self._build_message_read(m, is_read=is_read)

        participants_read = [
            self._build_participant_read(p) for p in (conv.participants or [])
        ]

        return ConversationRead(
            id=conv.id,
            type="DIRECT",
            name=None,
            created_by_id=None,
            is_owner=False,
            participant_count=2,
            other_participant=self._build_chat_user_read(target_user),
            participants=participants_read,
            last_message=last_msg,
            unread_count=0,
            updated_at=conv.updated_at,
        )

    def create_group(
        self,
        current_user: User,
        name: str,
        participant_ids: list[UUID],
    ) -> ConversationRead:
        """Create a new GROUP conversation with creator as admin."""
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group name cannot be empty.",
            )
        if len(clean_name) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group name cannot exceed 100 characters.",
            )

        school_id = current_user.school_id
        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a school to create a group.",
            )

        # Deduplicate and exclude self
        valid_uids = list({uid for uid in participant_ids if uid != current_user.id})
        if not valid_uids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one other participant must be selected.",
            )

        # Validate that all participants exist, are active, and belong to the same school
        for uid in valid_uids:
            u = self.user_repo.get_by_id(uid)
            if not u or not u.is_active or u.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User {uid} not found or inactive.",
                )
            if u.school_id != school_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User {uid} belongs to a different school.",
                )

        conv = self.chat_repo.create_group_conversation(
            school_id=school_id,
            name=clean_name,
            creator_id=current_user.id,
            participant_ids=valid_uids,
        )

        participants_read = [
            self._build_participant_read(p) for p in (conv.participants or [])
        ]
        return ConversationRead(
            id=conv.id,
            type="GROUP",
            name=conv.name,
            created_by_id=conv.created_by_id,
            is_owner=True,
            participant_count=len(conv.participants) if conv.participants else len(valid_uids) + 1,
            other_participant=None,
            participants=participants_read,
            last_message=None,
            unread_count=0,
            updated_at=conv.updated_at,
        )

    def create_broadcast(
        self,
        current_user: User,
        name: str,
        recipient_ids: list[UUID],
    ) -> ConversationRead:
        """Create a new BROADCAST conversation with creator as sender/owner."""
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broadcast name cannot be empty.",
            )
        if len(clean_name) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broadcast name cannot exceed 100 characters.",
            )

        school_id = current_user.school_id
        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to a school to create a broadcast list.",
            )

        valid_uids = list({uid for uid in recipient_ids if uid != current_user.id})
        if not valid_uids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one recipient must be selected.",
            )

        for uid in valid_uids:
            u = self.user_repo.get_by_id(uid)
            if not u or not u.is_active or u.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recipient {uid} not found or inactive.",
                )
            if u.school_id != school_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Recipient {uid} belongs to a different school.",
                )

        conv = self.chat_repo.create_broadcast_conversation(
            school_id=school_id,
            name=clean_name,
            creator_id=current_user.id,
            recipient_ids=valid_uids,
        )

        participants_read = [
            self._build_participant_read(p) for p in (conv.participants or [])
        ]
        return ConversationRead(
            id=conv.id,
            type="BROADCAST",
            name=conv.name,
            created_by_id=conv.created_by_id,
            is_owner=True,
            participant_count=len(conv.participants) if conv.participants else len(valid_uids) + 1,
            other_participant=None,
            participants=participants_read,
            last_message=None,
            unread_count=0,
            updated_at=conv.updated_at,
        )

    def list_conversations(self, current_user: User) -> list[ConversationRead]:
        """List current user's conversations (DIRECT, GROUP, BROADCAST) within their school."""
        school_id = current_user.school_id
        if not school_id:
            return []

        conv_tuples = self.chat_repo.list_user_conversations(
            school_id=school_id,
            user_id=current_user.id,
        )

        response = []
        for conv, other_user, last_message, unread_count in conv_tuples:
            if conv.type == "DIRECT" and not other_user:
                continue

            last_msg_read = None
            if last_message:
                is_read = False
                if last_message.sender_id == current_user.id:
                    if conv.type == "DIRECT":
                        other_last_read = self.chat_repo.get_other_participant_last_read(conv.id, current_user.id)
                        is_read = bool(other_last_read and last_message.created_at <= other_last_read)
                last_msg_read = self._build_message_read(last_message, is_read=is_read)

            participants_read = [
                self._build_participant_read(p)
                for p in (conv.participants or [])
            ]

            response.append(
                ConversationRead(
                    id=conv.id,
                    type=conv.type,
                    name=conv.name,
                    created_by_id=conv.created_by_id,
                    is_owner=(conv.created_by_id == current_user.id),
                    participant_count=len(conv.participants) if conv.participants else 0,
                    other_participant=self._build_chat_user_read(other_user) if other_user else None,
                    participants=participants_read,
                    last_message=last_msg_read,
                    unread_count=unread_count,
                    updated_at=conv.updated_at,
                )
            )
        return response

    def get_conversation_details(
        self,
        current_user: User,
        conversation_id: UUID,
    ) -> ConversationDetailsResponse:
        """Retrieve full details and participant list for a conversation."""
        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if not self.can_view_conversation(current_user, conv):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation.",
            )

        participants_read = [
            self._build_participant_read(p)
            for p in (conv.participants or [])
        ]

        return ConversationDetailsResponse(
            id=conv.id,
            type=conv.type,
            name=conv.name,
            created_by_id=conv.created_by_id,
            is_owner=(conv.created_by_id == current_user.id),
            created_at=conv.created_at,
            participants=participants_read,
        )

    def add_group_participants(
        self,
        current_user: User,
        conversation_id: UUID,
        user_ids: list[UUID],
    ) -> list[UUID]:
        """Add participants to a group or broadcast (Admin/Owner only)."""
        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.type == "GROUP":
            if not self.can_manage_group(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the group administrator can add participants.",
                )
        elif conv.type == "BROADCAST":
            if not self.can_manage_broadcast(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the broadcast creator can add recipients.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add participants to a direct conversation.",
            )

        # Validate target users
        valid_uids = []
        added_names = []
        for uid in set(user_ids):
            u = self.user_repo.get_by_id(uid)
            if not u or not u.is_active or u.deleted_at is not None:
                continue
            if u.school_id != current_user.school_id:
                continue
            valid_uids.append(uid)
            added_names.append(f"{u.first_name} {u.last_name}".strip())

        if not valid_uids:
            return []

        added = self.chat_repo.add_participants(conversation_id, valid_uids, role="MEMBER")

        # Persist system message
        if added and conv.type == "GROUP":
            names_str = ", ".join(added_names[:3])
            if len(added_names) > 3:
                names_str += f" and {len(added_names) - 3} others"
            sys_content = f"{current_user.first_name} added {names_str} to the group."
            self.chat_repo.create_message(
                conversation_id=conversation_id,
                sender_id=current_user.id,
                content=sys_content,
                message_type="SYSTEM",
            )

        return added

    def remove_group_participant(
        self,
        current_user: User,
        conversation_id: UUID,
        target_user_id: UUID,
    ) -> None:
        """Remove a participant from a group or broadcast (Admin/Owner only)."""
        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.type == "GROUP":
            if not self.can_manage_group(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the group administrator can remove participants.",
                )
        elif conv.type == "BROADCAST":
            if not self.can_manage_broadcast(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the broadcast creator can remove recipients.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove participants from a direct conversation.",
            )

        if target_user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove yourself using this action. Use leave instead.",
            )

        target_user = self.user_repo.get_by_id(target_user_id)
        target_name = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else "User"

        success = self.chat_repo.remove_participant(conversation_id, target_user_id)
        if success and conv.type == "GROUP":
            sys_content = f"{current_user.first_name} removed {target_name} from the group."
            self.chat_repo.create_message(
                conversation_id=conversation_id,
                sender_id=current_user.id,
                content=sys_content,
                message_type="SYSTEM",
            )

    def leave_group(
        self,
        current_user: User,
        conversation_id: UUID,
        new_owner_id: UUID | None = None,
    ) -> None:
        """Leave a group conversation safely, transferring ownership if the leaver is the owner."""
        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if not self.chat_repo.is_participant(conversation_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this conversation.",
            )

        if conv.type not in ["GROUP", "BROADCAST"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot leave a direct conversation.",
            )

        all_pids = self.chat_repo.get_participant_ids(conversation_id)
        remaining_pids = [uid for uid in all_pids if uid != current_user.id]

        # If user is owner/creator and other members remain, transfer ownership
        if conv.created_by_id == current_user.id and remaining_pids:
            target_owner = new_owner_id if (new_owner_id and new_owner_id in remaining_pids) else remaining_pids[0]
            self.chat_repo.update_conversation_owner(conversation_id, target_owner)
            new_owner_user = self.user_repo.get_by_id(target_owner)
            new_owner_name = f"{new_owner_user.first_name} {new_owner_user.last_name}".strip() if new_owner_user else "Admin"
            self.chat_repo.create_message(
                conversation_id=conversation_id,
                sender_id=current_user.id,
                content=f"{new_owner_name} is now a group administrator.",
                message_type="SYSTEM",
            )

        # Remove leaver
        self.chat_repo.remove_participant(conversation_id, current_user.id)

        # Post system message
        self.chat_repo.create_message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            content=f"{current_user.first_name} {current_user.last_name} left the group.",
            message_type="SYSTEM",
        )

    def update_group_name(
        self,
        current_user: User,
        conversation_id: UUID,
        name: str,
    ) -> None:
        """Update group or broadcast name (Admin/Owner only)."""
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty.",
            )
        if len(clean_name) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot exceed 100 characters.",
            )

        conv = self.chat_repo.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.type == "GROUP":
            if not self.can_manage_group(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group administrators can rename the group.",
                )
        elif conv.type == "BROADCAST":
            if not self.can_manage_broadcast(current_user, conv):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the broadcast creator can rename the broadcast list.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rename a direct conversation.",
            )

        self.chat_repo.update_conversation_name(conversation_id, clean_name)

        if conv.type == "GROUP":
            self.chat_repo.create_message(
                conversation_id=conversation_id,
                sender_id=current_user.id,
                content=f"{current_user.first_name} changed the group name to \"{clean_name}\".",
                message_type="SYSTEM",
            )

    # --- Messaging ---

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

        if not self.can_view_conversation(current_user, conv):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation.",
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
            is_read = False
            if m.sender_id == current_user.id:
                if conv.type == "DIRECT":
                    is_read = bool(other_last_read and m.created_at <= other_last_read)
            else:
                is_read = bool(user_last_read and m.created_at <= user_last_read)
            message_reads.append(self._build_message_read(m, is_read=is_read))

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

        if not self.can_send_message(current_user, conv):
            if conv.type == "BROADCAST":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the broadcast creator can send messages to this broadcast list.",
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to send messages in this conversation.",
            )

        msg = self.chat_repo.create_message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            content=clean_content,
            message_type="TEXT",
        )
        return self._build_message_read(msg, is_read=False)

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

