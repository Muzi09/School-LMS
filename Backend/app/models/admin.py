from typing import Any, TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

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

    employee_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    permissions_override: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="admin_profile",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_admin_profiles_employee_code",
                cls.employee_code,
            ),
            Index(
                "idx_admin_profiles_department",
                cls.department,
            ),
        )
