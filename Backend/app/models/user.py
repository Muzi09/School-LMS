from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.staff import StaffProfile
    from app.models.student import StudentProfile


class User(Base, AuditMixin):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    login_mobile: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Relationships
    staff_profile: Mapped["StaffProfile | None"] = relationship(
        "StaffProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    student_profile: Mapped["StudentProfile | None"] = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_users_email_active",
                func.lower(cls.email),
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & cls.email.is_not(None)),
            ),
            Index(
                "uq_users_login_mobile_active",
                cls.login_mobile,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_users_role",
                cls.role,
            ),
            Index(
                "idx_users_active",
                cls.is_active,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )
