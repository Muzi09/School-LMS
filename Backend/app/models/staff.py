from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base
from app.models.enums import Gender

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.user import User


class StaffProfile(Base):
    __tablename__ = "staff_profiles"

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
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    roll_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    gender: Mapped[Gender] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    father_first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    father_last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    pin_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING_ACTIVATION",
        server_default="PENDING_ACTIVATION",
    )

    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="staff_profile",
    )

    school: Mapped["School | None"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_staff_profiles_roll_no",
                cls.roll_no,
            ),
            Index(
                "idx_staff_profiles_status",
                cls.status,
            ),
            Index(
                "idx_staff_profiles_school_id",
                cls.school_id,
            ),
        )
