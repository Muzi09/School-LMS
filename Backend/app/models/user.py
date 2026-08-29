from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
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
    from app.models.admin import AdminProfile
    from app.models.school import School
    from app.models.student import StudentProfile
    from app.models.teacher import TeacherProfile


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

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    school_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "schools.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    school: Mapped["School | None"] = relationship(
        "School",
        back_populates="users",
        foreign_keys=[school_id],
    )

    admin_profile: Mapped["AdminProfile | None"] = relationship(
        "AdminProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    teacher_profile: Mapped["TeacherProfile | None"] = relationship(
        "TeacherProfile",
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
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_users_school_id",
                cls.school_id,
            ),
            Index(
                "idx_users_role",
                cls.role,
            ),
            Index(
                "idx_users_school_role",
                cls.school_id,
                cls.role,
            ),
            Index(
                "idx_users_active",
                cls.is_active,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )