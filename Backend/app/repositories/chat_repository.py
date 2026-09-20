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
                Conversation.user_a_id == u1,
                Conversation.user_b_id == u2,
            )
            .options(
                joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
                joinedload(Conversation.user_a),
                joinedload(Conversation.user_b),
            )
        )
        existing = self.db.scalars(stmt).first()
        if existing:
            return existing

        # Create new conversation and participants
        conversation = Conversation(
            school_id=school_id,
            user_a_id=u1,
            user_b_id=u2,
        )
        self.db.add(conversation)
        self.db.flush()

        now = datetime.now(timezone.utc)
        part1 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=u1,
            joined_at=now,
            last_read_at=now,
        )
        part2 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=u2,
            joined_at=now,
            last_read_at=now,
        )
        self.db.add_all([part1, part2])
        self.db.commit()

        # Re-fetch with relationships loaded
        return self.get_conversation_by_id(conversation.id)

    def get_conversation_by_id(self, conversation_id: UUID) -> Conversation | None:
        """Fetch a conversation by ID with loaded participants and users."""
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(
                joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
                joinedload(Conversation.user_a),
                joinedload(Conversation.user_b),
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
    ) -> List[Tuple[Conversation, User, Message | None, int]]:
        """
        List all conversations for user_id in school_id with other participant, last message, and unread count.
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
            )
            .order_by(Conversation.updated_at.desc())
        )
        conversations = list(self.db.scalars(stmt).unique().all())

        results = []
        for conv in conversations:
            # Identify the other participant
            other_user = None
            for p in conv.participants:
                if p.user_id != user_id:
                    other_user = p.user
                    break

            if not other_user:
                other_user = conv.user_b if conv.user_a_id == user_id else conv.user_a

            # Get latest message
            last_msg_stmt = (
                select(Message)
                .where(Message.conversation_id == conv.id)
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
        stmt = select(Message).where(Message.conversation_id == conversation_id)
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
    ) -> Message:
        """Create and persist a message, updating conversation timestamp and sender last_read_at."""
        now = datetime.now(timezone.utc)
        message = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=content,
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
        # A user belongs to the school if:
        # - PrincipalProfile.school_id == school_id
        # - StaffProfile.school_id == school_id
        # - StudentProfile.school_id == school_id
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
