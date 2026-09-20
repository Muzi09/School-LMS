from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.house import House
    from app.models.principal import PrincipalProfile
    from app.models.school_class import SchoolClass
    from app.models.section import Section
    from app.models.subject import Subject
    from app.models.wing import Wing


class School(Base, AuditMixin):
    __tablename__ = "schools"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    setup_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    primary_color: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    emblem_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    classes: Mapped[List["SchoolClass"]] = relationship(
        "SchoolClass",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    sections: Mapped[List["Section"]] = relationship(
        "Section",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    houses: Mapped[List["House"]] = relationship(
        "House",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    subjects: Mapped[List["Subject"]] = relationship(
        "Subject",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    wings: Mapped[List["Wing"]] = relationship(
        "Wing",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    principal: Mapped["PrincipalProfile | None"] = relationship(
        "PrincipalProfile",
        back_populates="school",
        uselist=False,
        foreign_keys="PrincipalProfile.school_id",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_schools_code_active",
                func.lower(cls.code),
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_schools_active",
                cls.is_active,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_schools_setup_completed",
                cls.setup_completed,
            ),
        )