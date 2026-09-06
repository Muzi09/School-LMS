import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditMixin, Base

if TYPE_CHECKING:
    from app.models.user import User


class SmtpConfiguration(Base, AuditMixin):
    """
    Per-Admin SMTP email server configuration.
    Stores host, credentials (encrypted password), ports, and sender info.
    """
    __tablename__ = "smtp_configurations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    smtp_host: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    smtp_port: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=587,
    )

    smtp_username: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    smtp_password_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    from_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    from_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="School LMS Platform",
    )

    security: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="TLS",  # TLS (STARTTLS), SSL, or NONE
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    admin: Mapped["User"] = relationship(
        "User",
        back_populates="smtp_configuration",
        foreign_keys=[admin_id],
    )

    __table_args__ = (
        UniqueConstraint("admin_id", name="uq_smtp_admin_id"),
    )

    # Backward compatibility alias
    @property
    def super_admin_id(self):
        return self.admin_id

    @super_admin_id.setter
    def super_admin_id(self, val):
        self.admin_id = val

    @property
    def super_admin(self):
        return self.admin
