from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Date, ForeignKey, Index, SmallInteger, String
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

    middle_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
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

    class_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    section: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    house: Mapped[str] = mapped_column(
        String(50),
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

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="student_profile",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_student_profiles_roll_no",
                cls.roll_no,
            ),
            Index(
                "idx_student_profiles_class_section",
                cls.class_name,
                cls.section,
            ),
            Index(
                "idx_student_profiles_dob",
                cls.date_of_birth,
            ),
        )


