from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Date, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base
from app.models.enums import Gender

if TYPE_CHECKING:
    from app.models.user import User


class StudentProfile(Base):
    __tablename__ = "student_profiles"

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

    admission_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    roll_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    gender: Mapped[Gender | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )

    blood_group: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    admission_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    guardian_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    guardian_relation: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    guardian_phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    guardian_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    emergency_contact_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    emergency_contact_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    medical_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="student_profile",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_student_profiles_admission_number",
                cls.admission_number,
            ),
            Index(
                "idx_student_profiles_roll_number",
                cls.roll_number,
            ),
            Index(
                "idx_student_profiles_dob",
                cls.date_of_birth,
            ),
        )
