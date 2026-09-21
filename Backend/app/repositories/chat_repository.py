from datetime import datetime, timezone
from typing import List, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.chat import Conversation, ConversationParticipant, Message
from app.models.principal import PrincipalProfile
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.user import User


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_direct_conversation(
        self,
        school_id: UUID,
        user_a_id: UUID,
        user_b_id: UUID,
    ) -> Conversation:
        """
        Atomically retrieve or create a unique direct 1-to-1 conversation between two users.
        Ensures user_a_id < user_b_id ordering to satisfy the database unique constraint.
        """
        u1, u2 = (user_a_id, user_b_id) if user_a_id < user_b_id else (user_b_id, user_a_id)

        stmt = (
            select(Conversation)
            .where(
                Conversation.type == "DIRECT",
                Conversation.user_a_id == u1,
                Conversation.user_b_id == u2,
            )
            .options(
                joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
                joinedload(Conversation.user_a),
                joinedload(Conversation.user_b),
                joinedload(Conversation.creator),
            )
        )
        existing = self.db.scalars(stmt).first()
        if existing:
            return existing

        # Create new direct conversation and participants
        conversation = Conversation(
            school_id=school_id,
            type="DIRECT",
            user_a_id=u1,
            user_b_id=u2,
        )
        self.db.add(conversation)
        self.db.flush()

        now = datetime.now(timezone.utc)
        part1 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=u1,
            role="MEMBER",
            joined_at=now,
            last_read_at=now,
        )
        part2 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=u2,
            role="MEMBER",
            joined_at=now,
            last_read_at=now,
        )
        self.db.add_all([part1, part2])
        self.db.commit()

        # Re-fetch with relationships loaded
        return self.get_conversation_by_id(conversation.id)

    def create_group_conversation(
        self,
        school_id: UUID,
        name: str,
        creator_id: UUID,
        participant_ids: List[UUID],
    ) -> Conversation:
        """
        Create a new GROUP conversation with creator as ADMIN and others as MEMBER.
        Persists an initial system message documenting group creation.
        """
        now = datetime.now(timezone.utc)
        conversation = Conversation(
            school_id=school_id,
            type="GROUP",
            name=name,
            created_by_id=creator_id,
            created_at=now,
            updated_at=now,
        )
        self.db.add(conversation)
        self.db.flush()

        # Creator as ADMIN
        creator_part = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=creator_id,
            role="ADMIN",
            joined_at=now,
            last_read_at=now,
        )
        self.db.add(creator_part)

        # Other participants as MEMBER (skip duplicates)
        seen_users = {creator_id}
        for uid in participant_ids:
            if uid not in seen_users:
                seen_users.add(uid)
                self.db.add(
                    ConversationParticipant(
                        conversation_id=conversation.id,
                        user_id=uid,
                        role="MEMBER",
                        joined_at=now,
                        last_read_at=now,
                    )
                )

        creator = self.db.get(User, creator_id)
        creator_name = f"{creator.first_name} {creator.last_name}" if creator else "Admin"
        sys_msg = Message(
            conversation_id=conversation.id,
            sender_id=creator_id,
            content=f"{creator_name} created group \"{name}\"",
            message_type="SYSTEM",
            created_at=now,
            updated_at=now,
        )
        self.db.add(sys_msg)

        self.db.commit()
        return self.get_conversation_by_id(conversation.id)

    def create_broadcast_conversation(
        self,
        school_id: UUID,
        name: str,
        creator_id: UUID,
        recipient_ids: List[UUID],
    ) -> Conversation:
        """
        Create a new BROADCAST conversation with creator as ADMIN and recipients as MEMBER.
        Persists an initial system message.
        """
        now = datetime.now(timezone.utc)
        conversation = Conversation(
            school_id=school_id,
            type="BROADCAST",
            name=name,
            created_by_id=creator_id,
            created_at=now,
            updated_at=now,
        )
        self.db.add(conversation)
        self.db.flush()

        # Creator as ADMIN
        creator_part = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=creator_id,
            role="ADMIN",
            joined_at=now,
            last_read_at=now,
        )
        self.db.add(creator_part)

        # Recipients as MEMBER
        seen_users = {creator_id}
        for uid in recipient_ids:
            if uid not in seen_users:
                seen_users.add(uid)
                self.db.add(
                    ConversationParticipant(
                        conversation_id=conversation.id,
                        user_id=uid,
                        role="MEMBER",
                        joined_at=now,
                        last_read_at=now,
                    )
                )

        creator = self.db.get(User, creator_id)
        creator_name = f"{creator.first_name} {creator.last_name}" if creator else "Admin"
        sys_msg = Message(
            conversation_id=conversation.id,
            sender_id=creator_id,
            content=f"{creator_name} created broadcast \"{name}\"",
            message_type="SYSTEM",
            created_at=now,
            updated_at=now,
        )
        self.db.add(sys_msg)

        self.db.commit()
        return self.get_conversation_by_id(conversation.id)

    def get_conversation_by_id(self, conversation_id: UUID) -> Conversation | None:
        """Fetch a conversation by ID with loaded participants, users, and creator."""
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(
                joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
                joinedload(Conversation.user_a),
                joinedload(Conversation.user_b),
                joinedload(Conversation.creator),
            )
        )
        return self.db.scalars(stmt).first()

    def is_participant(self, conversation_id: UUID, user_id: UUID) -> bool:
        """Check if user_id is a participant in conversation_id."""
        stmt = select(func.count(ConversationParticipant.id)).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        return (self.db.scalar(stmt) or 0) > 0

    def get_participant_ids(self, conversation_id: UUID) -> List[UUID]:
        """Return all participant user IDs for a conversation."""
        stmt = select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
        return list(self.db.scalars(stmt).all())

    def get_participant_role(self, conversation_id: UUID, user_id: UUID) -> str | None:
        """Return role of participant in conversation (ADMIN or MEMBER)."""
        stmt = select(ConversationParticipant.role).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def add_participants(
        self,
        conversation_id: UUID,
        user_ids: List[UUID],
        role: str = "MEMBER",
    ) -> List[UUID]:
        """Add new participants to conversation, returning list of newly added user IDs."""
        existing_ids = set(self.get_participant_ids(conversation_id))
        added = []
        now = datetime.now(timezone.utc)
        for uid in user_ids:
            if uid not in existing_ids:
                existing_ids.add(uid)
                self.db.add(
                    ConversationParticipant(
                        conversation_id=conversation_id,
                        user_id=uid,
                        role=role,
                        joined_at=now,
                        last_read_at=now,
                    )
                )
                added.append(uid)
        if added:
            conv = self.db.get(Conversation, conversation_id)
            if conv:
                conv.updated_at = now
            self.db.commit()
        return added

    def remove_participant(self, conversation_id: UUID, user_id: UUID) -> bool:
        """Remove a participant from a conversation."""
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        part = self.db.scalars(stmt).first()
        if part:
            self.db.delete(part)
            conv = self.db.get(Conversation, conversation_id)
            if conv:
                conv.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False

    def update_conversation_name(self, conversation_id: UUID, name: str) -> None:
        """Update conversation name."""
        conv = self.db.get(Conversation, conversation_id)
        if conv:
            conv.name = name
            conv.updated_at = datetime.now(timezone.utc)
            self.db.commit()

    def update_conversation_owner(self, conversation_id: UUID, new_owner_id: UUID) -> None:
        """Transfer conversation ownership to a new administrator."""
        conv = self.db.get(Conversation, conversation_id)
        if conv:
            old_owner_id = conv.created_by_id
            conv.created_by_id = new_owner_id
            conv.updated_at = datetime.now(timezone.utc)

            # Demote old owner to MEMBER if still in participants
            if old_owner_id:
                old_part = self.db.scalars(
                    select(ConversationParticipant).where(
                        ConversationParticipant.conversation_id == conversation_id,
                        ConversationParticipant.user_id == old_owner_id,
                    )
                ).first()
                if old_part:
                    old_part.role = "MEMBER"

            # Promote new owner to ADMIN
            new_part = self.db.scalars(
                select(ConversationParticipant).where(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == new_owner_id,
                )
            ).first()
            if new_part:
                new_part.role = "ADMIN"

            self.db.commit()

    def get_participant_last_read(self, conversation_id: UUID, user_id: UUID) -> datetime | None:
        """Return the last_read_at timestamp for a specific participant."""
        stmt = select(ConversationParticipant.last_read_at).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def get_other_participant_last_read(self, conversation_id: UUID, current_user_id: UUID) -> datetime | None:
        """Return the last_read_at timestamp for the other participant in a direct conversation."""
        stmt = select(ConversationParticipant.last_read_at).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != current_user_id,
        )
        return self.db.scalar(stmt)

    def list_user_conversations(
        self,
        school_id: UUID,
        user_id: UUID,
    ) -> List[Tuple[Conversation, User | None, Message | None, int]]:
        """
        List all conversations for user_id in school_id with other participant (if DIRECT),
        last message, and unread count.
        """
        # Find all conversations current user participates in
        part_stmt = (
            select(ConversationParticipant.conversation_id, ConversationParticipant.last_read_at)
            .where(ConversationParticipant.user_id == user_id)
        )
        user_parts = {row[0]: row[1] for row in self.db.execute(part_stmt).all()}

        if not user_parts:
            return []

        conv_ids = list(user_parts.keys())
        stmt = (
            select(Conversation)
            .where(
                Conversation.id.in_(conv_ids),
                Conversation.school_id == school_id,
            )
            .options(
                joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
                joinedload(Conversation.user_a),
                joinedload(Conversation.user_b),
                joinedload(Conversation.creator),
            )
            .order_by(Conversation.updated_at.desc())
        )
        conversations = list(self.db.scalars(stmt).unique().all())

        results = []
        for conv in conversations:
            other_user = None
            if conv.type == "DIRECT":
                for p in conv.participants:
                    if p.user_id != user_id:
                        other_user = p.user
                        break
                if not other_user:
                    other_user = conv.user_b if conv.user_a_id == user_id else conv.user_a

            # Get latest message with sender loaded
            last_msg_stmt = (
                select(Message)
                .where(Message.conversation_id == conv.id)
                .options(joinedload(Message.sender))
                .order_by(Message.created_at.desc())
                .limit(1)
            )
            last_message = self.db.scalars(last_msg_stmt).first()

            # Calculate unread count
            user_last_read = user_parts.get(conv.id)
            unread_conditions = [
                Message.conversation_id == conv.id,
                Message.sender_id != user_id,
            ]
            if user_last_read:
                unread_conditions.append(Message.created_at > user_last_read)

            unread_stmt = select(func.count(Message.id)).where(and_(*unread_conditions))
            unread_count = self.db.scalar(unread_stmt) or 0

            results.append((conv, other_user, last_message, unread_count))

        return results

    def list_messages(
        self,
        conversation_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> Tuple[List[Message], bool]:
        """
        Retrieve persisted messages for a conversation, ordered chronologically.
        Returns (messages, has_more).
        """
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(joinedload(Message.sender))
        )
        if before:
            stmt = stmt.where(Message.created_at < before)

        # Fetch limit + 1 to check if there are more
        stmt = stmt.order_by(Message.created_at.desc()).limit(limit + 1)
        fetched = list(self.db.scalars(stmt).all())

        has_more = len(fetched) > limit
        messages = fetched[:limit]
        # Return in ascending chronological order
        messages.reverse()
        return messages, has_more

    def create_message(
        self,
        conversation_id: UUID,
        sender_id: UUID,
        content: str,
        message_type: str = "TEXT",
    ) -> Message:
        """Create and persist a message, updating conversation timestamp and sender last_read_at."""
        now = datetime.now(timezone.utc)
        message = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=content,
            message_type=message_type,
            created_at=now,
            updated_at=now,
        )
        self.db.add(message)

        # Update conversation updated_at
        conv = self.db.get(Conversation, conversation_id)
        if conv:
            conv.updated_at = now

        # Update sender's last_read_at so their own message is considered read
        stmt = (
            select(ConversationParticipant)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == sender_id,
            )
        )
        sender_part = self.db.scalars(stmt).first()
        if sender_part:
            sender_part.last_read_at = now

        self.db.commit()
        self.db.refresh(message)
        # Load sender
        self.db.refresh(message, ["sender"])
        return message

    def mark_as_read(self, conversation_id: UUID, user_id: UUID) -> datetime:
        """Mark a conversation as read by setting user's last_read_at to now."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(ConversationParticipant)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
            )
        )
        participant = self.db.scalars(stmt).first()
        if participant:
            participant.last_read_at = now
            self.db.commit()
        return now

    def search_school_users(
        self,
        school_id: UUID,
        current_user_id: UUID,
        search: str | None = None,
        limit: int = 30,
    ) -> List[User]:
        """
        Search active users in the same school (Principal, Staff, Student) excluding the current user.
        Strict multi-tenant boundary: only users matching school_id are returned.
        """
        stmt = (
            select(User)
            .outerjoin(PrincipalProfile, User.id == PrincipalProfile.user_id)
            .outerjoin(StaffProfile, User.id == StaffProfile.user_id)
            .outerjoin(StudentProfile, User.id == StudentProfile.user_id)
            .where(
                User.deleted_at.is_(None),
                User.is_active == True,
                User.id != current_user_id,
                or_(
                    PrincipalProfile.school_id == school_id,
                    StaffProfile.school_id == school_id,
                    StudentProfile.school_id == school_id,
                ),
            )
        )

        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.email.ilike(term),
                    User.login_mobile.ilike(term),
                )
            )

        stmt = stmt.order_by(User.first_name.asc(), User.last_name.asc()).limit(limit)
        return list(self.db.scalars(stmt).unique().all())

