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

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="admin_profile",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_admin_profiles_roll_no",
                cls.roll_no,
            ),
        )


