from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.school_class import SchoolClass
    from app.models.section import Section


class Subject(Base, AuditMixin):
    __tablename__ = "subjects"

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

    code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="academic",
        server_default="academic",
    )

    is_academic: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
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
        back_populates="subjects",
    )

    class_subjects: Mapped[List["ClassSubject"]] = relationship(
        "ClassSubject",
        back_populates="subject",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_subjects_school_name",
                cls.school_id,
                cls.name,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_subjects_school_id",
                cls.school_id,
            ),
        )


class ClassSubject(Base, AuditMixin):
    __tablename__ = "class_subjects"

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

    section_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=True,
    )

    subject_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    school_class: Mapped["SchoolClass"] = relationship(
        "SchoolClass",
        back_populates="class_subjects",
    )

    section: Mapped["Section | None"] = relationship(
        "Section",
        back_populates="class_subjects",
    )

    subject: Mapped["Subject"] = relationship(
        "Subject",
        back_populates="class_subjects",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "uq_class_subjects_class_section_subject",
                cls.class_id,
                cls.section_id,
                cls.subject_id,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "idx_class_subjects_school_id",
                cls.school_id,
            ),
            Index(
                "idx_class_subjects_section_id",
                cls.section_id,
            ),
        )
