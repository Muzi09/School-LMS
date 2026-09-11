from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.user import User


class PrincipalProfile(Base):
    __tablename__ = "principal_profiles"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
    )

    school_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "schools.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    pin_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    school_setup_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="principal_profile",
    )

    school: Mapped["School | None"] = relationship(
        "School",
        back_populates="principals",
        foreign_keys=[school_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_principal_profiles_school_id",
                cls.school_id,
            ),
            Index(
                "idx_principal_profiles_setup_completed",
                cls.school_setup_completed,
            ),
        )
