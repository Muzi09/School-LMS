from datetime import datetime
from typing import TYPE_CHECKING, List
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
    from app.models.onboarding_token import PrincipalOnboardingToken
    from app.models.principal import PrincipalProfile
    from app.models.smtp_configuration import SmtpConfiguration
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

    password_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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
    principal_profile: Mapped["PrincipalProfile | None"] = relationship(
        "PrincipalProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

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

    onboarding_tokens: Mapped[List["PrincipalOnboardingToken"]] = relationship(
        "PrincipalOnboardingToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    smtp_configuration: Mapped["SmtpConfiguration | None"] = relationship(
        "SmtpConfiguration",
        back_populates="admin",
        foreign_keys="[SmtpConfiguration.admin_id]",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # Backward compatibility properties
    @property
    def school_id(self) -> UUID | None:
        if self.principal_profile:
            return self.principal_profile.school_id
        return None

    @property
    def pin_hash(self) -> str | None:
        if self.principal_profile:
            return self.principal_profile.pin_hash
        return None

    @property
    def school_setup_completed(self) -> bool:
        if self.principal_profile:
            return self.principal_profile.school_setup_completed
        return False

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
