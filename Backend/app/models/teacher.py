from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Date, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

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

    employee_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    qualification: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    specialization: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    experience_years: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
        default=0,
        server_default="0",
    )

    joining_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="teacher_profile",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_teacher_profiles_employee_code",
                cls.employee_code,
            ),
            Index(
                "idx_teacher_profiles_department",
                cls.department,
            ),
            Index(
                "idx_teacher_profiles_designation",
                cls.designation,
            ),
        )
