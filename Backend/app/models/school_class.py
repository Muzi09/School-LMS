from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.section import Section
    from app.models.subject import ClassSubject
    from app.models.wing import WingClass


class SchoolClass(Base, AuditMixin):
    __tablename__ = "school_classes"

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

    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        back_populates="classes",
    )

    sections: Mapped[List["Section"]] = relationship(
        "Section",
        back_populates="school_class",
        cascade="all, delete-orphan",
    )

    class_subjects: Mapped[List["ClassSubject"]] = relationship(
        "ClassSubject",
        back_populates="school_class",
        cascade="all, delete-orphan",
    )

    wing_classes: Mapped[List["WingClass"]] = relationship(
        "WingClass",
        back_populates="school_class",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_school_classes_school_name",
                cls.school_id,
                cls.name,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_school_classes_school_order",
                cls.school_id,
                cls.order_index,
            ),
        )
