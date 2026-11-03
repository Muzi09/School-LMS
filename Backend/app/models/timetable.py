from datetime import datetime, time
from enum import Enum
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin

if TYPE_CHECKING:
    from app.models.school import School
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


class Timetable(Base, AuditMixin):
    """
    Timetable model representing an academic, winter, exam, or custom schedule.
    Exactly one active timetable is supported per school at any time.
    """
    __tablename__ = "timetables"

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
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    academic_year: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    setups: Mapped[List["TimetableSetup"]] = relationship(
        "TimetableSetup",
        back_populates="timetable",
        cascade="all, delete-orphan",
    )

    periods: Mapped[List["TimetablePeriod"]] = relationship(
        "TimetablePeriod",
        back_populates="timetable",
        cascade="all, delete-orphan",
    )

    entries: Mapped[List["TimetableEntry"]] = relationship(
        "TimetableEntry",
        back_populates="timetable",
        cascade="all, delete-orphan",
    )

    assignments: Mapped[List["TimetableSetupAssignment"]] = relationship(
        "TimetableSetupAssignment",
        back_populates="timetable",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index("idx_timetables_school_id", cls.school_id),
            Index(
                "uq_timetables_school_active",
                cls.school_id,
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & (cls.is_active == True)),
            ),
        )


class TimetableSetup(Base, AuditMixin):
    """
    Bell Schedule Setup model defining bell timings and periods.
    A timetable can contain multiple setups (e.g. Setup 1 for Nursery-5, Setup 2 for 6-12).
    """
    __tablename__ = "timetable_setups"

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

    timetable_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    applicable_days: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        default='["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]',
    )

    # Relationships
    timetable: Mapped["Timetable"] = relationship(
        "Timetable",
        back_populates="setups",
        foreign_keys=[timetable_id],
    )

    periods: Mapped[List["TimetablePeriod"]] = relationship(
        "TimetablePeriod",
        back_populates="setup",
        cascade="all, delete-orphan",
        order_by="TimetablePeriod.period_number",
    )

    assignments: Mapped[List["TimetableSetupAssignment"]] = relationship(
        "TimetableSetupAssignment",
        back_populates="setup",
        cascade="all, delete-orphan",
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index("idx_timetable_setups_school_id", cls.school_id),
            Index("idx_timetable_setups_timetable_id", cls.timetable_id),
        )


class TimetableSetupAssignment(Base, AuditMixin):
    """
    Mapping indicating which Wing, Class, or Section is bound to a specific Bell Setup.
    """
    __tablename__ = "timetable_setup_assignments"

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

    timetable_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        nullable=False,
    )

    setup_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetable_setups.id", ondelete="CASCADE"),
        nullable=False,
    )

    target_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )  # 'WING', 'CLASS', 'SECTION'

    target_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )

    # Relationships
    timetable: Mapped["Timetable"] = relationship(
        "Timetable",
        back_populates="assignments",
        foreign_keys=[timetable_id],
    )

    setup: Mapped["TimetableSetup"] = relationship(
        "TimetableSetup",
        back_populates="assignments",
        foreign_keys=[setup_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            CheckConstraint("target_type IN ('WING', 'CLASS', 'SECTION')", name="chk_timetable_setup_assignments_target_type"),
            Index("idx_timetable_setup_assignments_school_id", cls.school_id),
            Index("idx_timetable_setup_assignments_timetable_id", cls.timetable_id),
            Index("idx_timetable_setup_assignments_setup_id", cls.setup_id),
            Index(
                "uq_timetable_setup_assignments_target",
                cls.timetable_id,
                cls.target_type,
                cls.target_id,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )


class TimetablePeriod(Base, AuditMixin):
    """
    School timetable period model (e.g., Period 1 from 08:30 to 09:15, or Recess).
    Configurable per timetable and setup.
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

    timetable_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        nullable=True,
    )

    setup_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetable_setups.id", ondelete="CASCADE"),
        nullable=True,
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

    is_break: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    label: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Relationships
    school: Mapped["School"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    timetable: Mapped["Timetable | None"] = relationship(
        "Timetable",
        back_populates="periods",
        foreign_keys=[timetable_id],
    )

    setup: Mapped["TimetableSetup | None"] = relationship(
        "TimetableSetup",
        back_populates="periods",
        foreign_keys=[setup_id],
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
            Index("idx_timetable_periods_timetable_id", cls.timetable_id),
            Index("idx_timetable_periods_setup_id", cls.setup_id),
            Index(
                "uq_timetable_periods_setup_period_num",
                cls.setup_id,
                cls.period_number,
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & cls.setup_id.is_not(None)),
            ),
        )


class TimetableEntry(Base, AuditMixin):
    """
    Core timetable entry model representing:
    WHO (teacher_user_id) teaches WHAT (subject_id),
    WHEN (day_of_week + period_id),
    TO WHOM (section_id),
    UNDER WHICH TIMETABLE (timetable_id).
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

    timetable_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("timetables.id", ondelete="CASCADE"),
        nullable=True,
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

    timetable: Mapped["Timetable | None"] = relationship(
        "Timetable",
        back_populates="entries",
        foreign_keys=[timetable_id],
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
            Index("idx_timetable_entries_timetable_id", cls.timetable_id),
            Index("idx_timetable_entries_section_id", cls.section_id),
            Index("idx_timetable_entries_teacher_user_id", cls.teacher_user_id),
            Index("idx_timetable_entries_period_id", cls.period_id),
            Index("idx_timetable_entries_day_of_week", cls.day_of_week),
            Index(
                "uq_timetable_entries_slot_with_tt",
                cls.timetable_id,
                cls.section_id,
                cls.day_of_week,
                cls.period_id,
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & cls.timetable_id.is_not(None)),
            ),
            Index(
                "uq_timetable_entries_teacher_with_tt",
                cls.timetable_id,
                cls.teacher_user_id,
                cls.day_of_week,
                cls.period_id,
                unique=True,
                postgresql_where=(cls.deleted_at.is_(None) & cls.teacher_user_id.is_not(None) & cls.timetable_id.is_not(None)),
            ),
        )
