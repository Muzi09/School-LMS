from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School


class House(Base, AuditMixin):
    __tablename__ = "houses"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    school_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    color: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    emblem_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        back_populates="houses",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_houses_school_name",
                cls.school_id,
                cls.name,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )
