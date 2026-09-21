from datetime import datetime
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.user import User


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    school_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "schools.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    # Conversation type: DIRECT, GROUP, BROADCAST
    type: Mapped[str] = mapped_column(
        String(20),
        default="DIRECT",
        nullable=False,
    )

    # Name for GROUP or BROADCAST conversations
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Creator/owner of the group or broadcast
    created_by_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # For DIRECT chats: user_a_id and user_b_id are stored with user_a_id < user_b_id.
    # Nullable for GROUP and BROADCAST conversations.
    user_a_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    user_b_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )

    user_a: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_a_id],
    )

    user_b: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_b_id],
    )

    participants: Mapped[List["ConversationParticipant"]] = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at.asc()",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_conversations_direct_user_pair",
                "user_a_id",
                "user_b_id",
                unique=True,
                postgresql_where=text("type = 'DIRECT'"),
            ),
            Index(
                "idx_conversations_school_id",
                cls.school_id,
            ),
            Index(
                "idx_conversations_updated_at",
                cls.updated_at,
            ),
            Index(
                "idx_conversations_type",
                cls.type,
            ),
            Index(
                "idx_conversations_created_by_id",
                cls.created_by_id,
            ),
        )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    conversation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    # Participant role: ADMIN (creator/manager) or MEMBER
    role: Mapped[str] = mapped_column(
        String(20),
        default="MEMBER",
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="participants",
    )

    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_conversation_participants",
                cls.conversation_id,
                cls.user_id,
                unique=True,
            ),
            Index(
                "idx_conversation_participants_user_id",
                cls.user_id,
            ),
            Index(
                "idx_conversation_participants_conv_id",
                cls.conversation_id,
            ),
        )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    conversation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    sender_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Message type: TEXT or SYSTEM
    message_type: Mapped[str] = mapped_column(
        String(20),
        default="TEXT",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )

    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_messages_conversation_created",
                cls.conversation_id,
                cls.created_at,
            ),
            Index(
                "idx_messages_sender_id",
                cls.sender_id,
            ),
        )

