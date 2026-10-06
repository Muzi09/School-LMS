from datetime import datetime, time
from enum import Enum
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.school_class import SchoolClass
    from app.models.section import Section
    from app.models.subject import Subject
    from app.models.user import User


class DayOfWeek(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"


class TimetablePeriod(Base, AuditMixin):
    """
    School timetable period model (e.g., Period 1 from 08:00 to 08:45).
    Configurable per school.
    """
    __tablename__ = "timetable_periods"

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

    period_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    entries: Mapped[List["TimetableEntry"]] = relationship(
        "TimetableEntry",
        back_populates="period",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            CheckConstraint("period_number > 0", name="chk_timetable_periods_period_number_pos"),
            CheckConstraint("start_time < end_time", name="chk_timetable_periods_time_order"),
            Index("idx_timetable_periods_school_id", cls.school_id),
            Index(
                "uq_timetable_periods_school_period_num",
                cls.school_id,
                cls.period_number,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )


class TimetableEntry(Base, AuditMixin):
    """
    Core timetable entry model representing:
    WHO (teacher_user_id) teaches WHAT (subject_id),
    WHEN (day_of_week + period_id),
    TO WHOM (section_id).
    """
    __tablename__ = "timetable_entries"

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

    section_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
    )

    subject_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )

    teacher_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    period_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetable_periods.id", ondelete="CASCADE"),
        nullable=False,
    )

    day_of_week: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    section: Mapped["Section"] = relationship(
        "Section",
        foreign_keys=[section_id],
    )

    subject: Mapped["Subject"] = relationship(
        "Subject",
        foreign_keys=[subject_id],
    )

    teacher: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[teacher_user_id],
    )

    period: Mapped["TimetablePeriod"] = relationship(
        "TimetablePeriod",
        back_populates="entries",
        foreign_keys=[period_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            CheckConstraint(
                "day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')",
                name="chk_timetable_entries_day_of_week",
            ),
            Index("idx_timetable_entries_school_id", cls.school_id),
            Index("idx_timetable_entries_section_id", cls.section_id),
            Index("idx_timetable_entries_teacher_user_id", cls.teacher_user_id),
            Index("idx_timetable_entries_period_id", cls.period_id),
            Index("idx_timetable_entries_day_of_week", cls.day_of_week),
            Index(
                "uq_timetable_entries_section_slot",
                cls.school_id,
                cls.section_id,
                cls.day_of_week,
                cls.period_id,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
            Index(
                "uq_timetable_entries_teacher_slot",
                cls.school_id,
                cls.teacher_user_id,
                cls.day_of_week,
                cls.period_id,
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & cls.teacher_user_id.isnot(None)),
            ),
        )
