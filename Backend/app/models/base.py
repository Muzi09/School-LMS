from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class TimestampMixin:
    """Mixin for audit timestamp fields (creation and modification)."""

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


class SoftDeleteMixin:
    """Mixin for soft deletion timestamp, user tracking, and relationship."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    deleted_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    @declared_attr
    def deleted_by_user(cls) -> Mapped["User | None"]:
        if cls.__name__ == "User":
            return relationship(
                "User",
                remote_side="User.id",
                foreign_keys=[cls.deleted_by],
            )
        return relationship(
            "User",
            foreign_keys=[cls.deleted_by],
        )


class UserAuditMixin:
    """Mixin for creator and modifier user tracking and relationships."""

    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    updated_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    @declared_attr
    def created_by_user(cls) -> Mapped["User | None"]:
        if cls.__name__ == "User":
            return relationship(
                "User",
                remote_side="User.id",
                foreign_keys=[cls.created_by],
            )
        return relationship(
            "User",
            foreign_keys=[cls.created_by],
        )

    @declared_attr
    def updated_by_user(cls) -> Mapped["User | None"]:
        if cls.__name__ == "User":
            return relationship(
                "User",
                remote_side="User.id",
                foreign_keys=[cls.updated_by],
            )
        return relationship(
            "User",
            foreign_keys=[cls.updated_by],
        )


class AuditMixin(TimestampMixin, UserAuditMixin, SoftDeleteMixin):
    """
    Unified audit mixin providing timestamps, user tracking,
    and soft deletion columns and relationships.
    """
    pass


__all__ = [
    "Base",
    "TimestampMixin",
    "SoftDeleteMixin",
    "UserAuditMixin",
    "AuditMixin",
]
