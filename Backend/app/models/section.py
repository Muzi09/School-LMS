from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.school_class import SchoolClass
    from app.models.subject import ClassSubject


class Section(Base, AuditMixin):
    __tablename__ = "sections"

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

    class_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("school_classes.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        back_populates="sections",
    )

    school_class: Mapped["SchoolClass"] = relationship(
        "SchoolClass",
        back_populates="sections",
    )

    class_subjects: Mapped[List["ClassSubject"]] = relationship(
        "ClassSubject",
        back_populates="section",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_sections_class_name",
                cls.class_id,
                cls.name,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_sections_school_id",
                cls.school_id,
            ),
        )
