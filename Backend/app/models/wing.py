from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.school_class import SchoolClass


class Wing(Base, AuditMixin):
    __tablename__ = "wings"

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
        back_populates="wings",
    )

    wing_classes: Mapped[List["WingClass"]] = relationship(
        "WingClass",
        back_populates="wing",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_wings_school_name",
                cls.school_id,
                cls.name,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_wings_school_id",
                cls.school_id,
            ),
        )


class WingClass(Base, AuditMixin):
    __tablename__ = "wing_classes"

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

    wing_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("wings.id", ondelete="CASCADE"),
        nullable=False,
    )

    class_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("school_classes.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    wing: Mapped["Wing"] = relationship(
        "Wing",
        back_populates="wing_classes",
    )

    school_class: Mapped["SchoolClass"] = relationship(
        "SchoolClass",
        back_populates="wing_classes",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_wing_classes_wing_class",
                cls.wing_id,
                cls.class_id,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_wing_classes_school_id",
                cls.school_id,
            ),
        )
