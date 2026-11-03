from datetime import datetime, time
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.timetable import DayOfWeek


# ---------------------------------------------------------------------------
# Period Schemas
# ---------------------------------------------------------------------------


class TimetablePeriodBase(BaseModel):
    period_number: int = Field(..., ge=1, description="Period number (1, 2, 3...)")
    start_time: str = Field(..., description="Start time formatted as HH:MM or HH:MM:SS")
    end_time: str = Field(..., description="End time formatted as HH:MM or HH:MM:SS")
    is_break: bool = Field(False, description="Whether this slot is a break/recess/assembly")
    label: Optional[str] = Field(None, description="Custom label e.g. 'RECESS', 'Lunch', 'Assembly'")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_str(cls, v: str) -> str:
        parts = v.strip().split(":")
        if len(parts) < 2 or len(parts) > 3:
            raise ValueError("Time must be in HH:MM or HH:MM:SS format")
        try:
            hour = int(parts[0])
            minute = int(parts[1])
            second = int(parts[2]) if len(parts) == 3 else 0
            if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
                raise ValueError("Hour must be 0-23 and minute 0-59")
            return f"{hour:02d}:{minute:02d}"
        except ValueError as e:
            raise ValueError(f"Invalid time format: {e}")


class TimetablePeriodCreate(TimetablePeriodBase):
    pass


class TimetablePeriodUpdate(BaseModel):
    period_number: Optional[int] = Field(None, ge=1)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_break: Optional[bool] = None
    label: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_str(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        parts = v.strip().split(":")
        if len(parts) < 2 or len(parts) > 3:
            raise ValueError("Time must be in HH:MM or HH:MM:SS format")
        try:
            hour = int(parts[0])
            minute = int(parts[1])
            second = int(parts[2]) if len(parts) == 3 else 0
            if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
                raise ValueError("Hour must be 0-23 and minute 0-59")
            return f"{hour:02d}:{minute:02d}"
        except ValueError as e:
            raise ValueError(f"Invalid time format: {e}")


class TimetablePeriodRead(BaseModel):
    id: UUID
    school_id: UUID
    timetable_id: Optional[UUID] = None
    setup_id: Optional[UUID] = None
    period_number: int
    start_time: str
    end_time: str
    is_break: bool = False
    label: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auxiliary Display Schemas
# ---------------------------------------------------------------------------


class TimetableTeacherRead(BaseModel):
    id: UUID
    name: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    roll_no: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TimetableSubjectRead(BaseModel):
    id: UUID
    name: str
    code: Optional[str] = None
    category: Optional[str] = "academic"
    is_academic: Optional[bool] = True
    teacher_id: Optional[UUID] = None
    teacher: Optional[TimetableTeacherRead] = None

    model_config = ConfigDict(from_attributes=True)


class TimetableSectionRead(BaseModel):
    id: UUID
    class_id: UUID
    class_name: str
    section_name: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Timetable CRUD Schemas
# ---------------------------------------------------------------------------


class TimetableCreate(BaseModel):
    name: str = Field(..., max_length=255, description="Timetable display name")
    description: Optional[str] = Field(None, description="Timetable description")
    academic_year: Optional[str] = Field(None, max_length=50, description="Academic Year e.g. 2026-27")
    type: Optional[str] = Field("Academic", description="Academic, Winter, Exam, or Custom")
    start_option: Optional[str] = Field("blank", description="blank, duplicate, or copy_bell")
    source_timetable_id: Optional[UUID] = Field(None, description="Source timetable ID to duplicate from")
    is_active: Optional[bool] = Field(False, description="Set as active timetable")


class TimetableUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    academic_year: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class TimetableRead(BaseModel):
    id: UUID
    school_id: UUID
    name: str
    description: Optional[str] = None
    academic_year: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Setup & Bell Schedule Schemas
# ---------------------------------------------------------------------------


class SetupPeriodItem(BaseModel):
    id: Optional[UUID] = None
    period_number: int = Field(..., ge=1)
    start_time: str
    end_time: str
    is_break: bool = False
    label: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        parts = v.strip().split(":")
        if len(parts) < 2:
            raise ValueError("Time must be in HH:MM format")
        h = int(parts[0])
        m = int(parts[1])
        return f"{h:02d}:{m:02d}"


class SetupScheduleItem(BaseModel):
    """Day schedule group e.g. Mon-Fri or Sat"""
    id: Optional[str] = None
    days: List[str] = Field(default_factory=list)
    periods: List[SetupPeriodItem] = Field(default_factory=list)


class TimetableSetupCreate(BaseModel):
    timetable_id: UUID
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    is_default: bool = False
    applicable_days: Optional[List[str]] = None
    periods: Optional[List[SetupPeriodItem]] = None
    schedules: Optional[List[SetupScheduleItem]] = None


class TimetableSetupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    applicable_days: Optional[List[str]] = None
    periods: Optional[List[SetupPeriodItem]] = None
    schedules: Optional[List[SetupScheduleItem]] = None


class TimetableSetupRead(BaseModel):
    id: UUID
    school_id: UUID
    timetable_id: UUID
    name: str
    description: Optional[str] = None
    is_default: bool
    applicable_days: List[str] = Field(default_factory=list)
    periods: List[TimetablePeriodRead] = Field(default_factory=list)
    schedules: List[SetupScheduleItem] = Field(default_factory=list)
    assigned_classes_count: int = 0
    assigned_section_ids: List[UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SetupAssignmentTarget(BaseModel):
    setup_id: UUID
    target_type: str = Field(..., description="'WING', 'CLASS', or 'SECTION'")
    target_id: UUID


class BatchSetupAssignmentsRequest(BaseModel):
    timetable_id: UUID
    setups: List[Dict[str, Any]] = Field(..., description="List of setups with day schedules and periods")
    assignments: List[SetupAssignmentTarget] = Field(..., description="Mapping of sections/classes/wings to setup IDs")


class ImpactPreviewResponse(BaseModel):
    affected_slots_count: int
    affected_entries: List[Dict[str, Any]] = Field(default_factory=list)
    message: str


# ---------------------------------------------------------------------------
# Timetable Entry Schemas
# ---------------------------------------------------------------------------


class TimetableEntryCreate(BaseModel):
    timetable_id: Optional[UUID] = Field(None, description="Timetable UUID")
    section_id: UUID = Field(..., description="Target Section UUID")
    subject_id: UUID = Field(..., description="Subject UUID")
    teacher_user_id: Optional[UUID] = Field(None, description="Assigned active teaching staff User UUID")
    period_id: UUID = Field(..., description="Period UUID")
    day_of_week: DayOfWeek = Field(..., description="Day of week (MONDAY through SATURDAY)")
    overwrite: Optional[bool] = Field(False, description="Whether to overwrite existing slot if already scheduled")


class TimetableEntryUpdate(BaseModel):
    subject_id: Optional[UUID] = None
    teacher_user_id: Optional[UUID] = None
    period_id: Optional[UUID] = None
    day_of_week: Optional[DayOfWeek] = None


class TimetableEntryRead(BaseModel):
    id: UUID
    school_id: UUID
    timetable_id: Optional[UUID] = None
    section_id: UUID
    period_id: UUID
    period_number: int
    day_of_week: str
    subject: TimetableSubjectRead
    teacher: Optional[TimetableTeacherRead] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkSlotAssignRequest(BaseModel):
    timetable_id: UUID
    section_id: UUID
    day_of_week: str
    period_id: UUID
    subject_id: Optional[UUID] = None  # None indicates clearing / unassigning
    teacher_user_id: Optional[UUID] = None
    kind: Optional[str] = "teaching"  # "teaching", "free", "library", "assembly", "activity"
    scope: str = "SLOT"  # "SLOT", "WEEKDAYS", "CLASS_SECTIONS", "FILL_TARGET"
    overwrite: bool = True


class ConflictCheckRequest(BaseModel):
    timetable_id: UUID
    teacher_user_id: UUID
    day_of_week: str
    period_id: Optional[UUID] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    exclude_entry_id: Optional[UUID] = None


class ConflictCheckResponse(BaseModel):
    has_conflict: bool
    message: Optional[str] = None
    conflicting_entry: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Class-Wise Aggregated View Schemas
# ---------------------------------------------------------------------------


class SectionSummary(BaseModel):
    id: UUID
    name: str
    class_id: UUID
    class_name: str
    setup_id: Optional[UUID] = None
    assigned_slots: int = 0
    total_slots: int = 0
    unassigned_slots: int = 0
    subject_stats: List[Dict[str, Any]] = Field(default_factory=list)


class ClassSummary(BaseModel):
    id: UUID
    name: str
    wing_id: Optional[UUID] = None
    wing_name: Optional[str] = None
    sections: List[SectionSummary] = Field(default_factory=list)


class WingSummary(BaseModel):
    id: UUID
    name: str
    order_index: int = 0
    classes: List[ClassSummary] = Field(default_factory=list)
    total_classes: int = 0
    total_sections: int = 0


class ClassWiseTimetableResponse(BaseModel):
    timetable: TimetableRead
    timetables: List[TimetableRead] = Field(default_factory=list)
    wings: List[WingSummary] = Field(default_factory=list)
    setups: List[TimetableSetupRead] = Field(default_factory=list)
    entries: List[TimetableEntryRead] = Field(default_factory=list)
    eligible_teachers: List[TimetableTeacherRead] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Timetable Grid Response (Single Section)
# ---------------------------------------------------------------------------


class TimetableGridResponse(BaseModel):
    section: TimetableSectionRead
    periods: List[TimetablePeriodRead]
    entries: List[TimetableEntryRead]
    subjects: List[TimetableSubjectRead]

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Structured Conflict Error Details
# ---------------------------------------------------------------------------


class ScheduleConflictDetails(BaseModel):
    teacher_name: Optional[str] = None
    class_name: Optional[str] = None
    section_name: Optional[str] = None
    day: Optional[str] = None
    period: Optional[int] = None
    subject_name: Optional[str] = None
    existing_entry_id: Optional[str] = None


class ScheduleConflictResponse(BaseModel):
    code: str = Field(..., description="Conflict code")
    message: str
    details: ScheduleConflictDetails


# ---------------------------------------------------------------------------
# Multi-View & Insights Schemas
# ---------------------------------------------------------------------------


class TeacherScheduleEntryRead(BaseModel):
    id: UUID
    school_id: UUID
    section_id: UUID
    class_id: Optional[UUID] = None
    class_name: str
    section_name: str
    period_id: UUID
    period_number: int
    day_of_week: str
    start_time: str
    end_time: str
    subject: TimetableSubjectRead

    model_config = ConfigDict(from_attributes=True)


class TeacherScheduleResponse(BaseModel):
    teacher: TimetableTeacherRead
    periods: List[TimetablePeriodRead]
    entries: List[TeacherScheduleEntryRead]
    total_teaching_periods: int

    model_config = ConfigDict(from_attributes=True)


class OccupiedTeacherDetail(BaseModel):
    teacher: TimetableTeacherRead
    section: TimetableSectionRead
    subject: TimetableSubjectRead

    model_config = ConfigDict(from_attributes=True)


class FreeTeacherSlotInfo(BaseModel):
    period_id: UUID
    period_number: int
    start_time: str
    end_time: str
    free_teachers: List[TimetableTeacherRead]
    occupied_teachers: List[OccupiedTeacherDetail]
    free_count: int
    occupied_count: int

    model_config = ConfigDict(from_attributes=True)


class FreeTeachersDayResponse(BaseModel):
    day_of_week: str
    periods: List[FreeTeacherSlotInfo]

    model_config = ConfigDict(from_attributes=True)


class FreeTeachersResponse(BaseModel):
    periods: List[TimetablePeriodRead]
    days: List[FreeTeachersDayResponse]
    total_teachers: int

    model_config = ConfigDict(from_attributes=True)


class MasterTimetableSectionInfo(BaseModel):
    id: UUID
    class_id: UUID
    class_name: str
    section_name: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class MasterTimetableEntryRead(BaseModel):
    id: UUID
    school_id: UUID
    section_id: UUID
    period_id: UUID
    period_number: int
    day_of_week: str
    start_time: str
    end_time: str
    subject: TimetableSubjectRead
    teacher: Optional[TimetableTeacherRead] = None

    model_config = ConfigDict(from_attributes=True)


class MasterTimetableResponse(BaseModel):
    periods: List[TimetablePeriodRead]
    sections: List[MasterTimetableSectionInfo]
    entries: List[MasterTimetableEntryRead]

    model_config = ConfigDict(from_attributes=True)


class ConflictItem(BaseModel):
    type: str  # "TEACHER_CONFLICT" | "SECTION_CONFLICT"
    day_of_week: str
    period_number: int
    start_time: str
    end_time: str
    description: str
    section_id: Optional[UUID] = None
    class_name: Optional[str] = None
    section_name: Optional[str] = None
    teacher_id: Optional[UUID] = None
    teacher_name: Optional[str] = None
    entry_ids: List[UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SectionCoverageItem(BaseModel):
    section_id: UUID
    class_id: UUID
    class_name: str
    section_name: str
    scheduled_periods: int
    expected_periods: int
    completion_percentage: float
    status: str  # "COMPLETE" | "PARTIAL" | "MISSING"

    model_config = ConfigDict(from_attributes=True)


class CoverageSummary(BaseModel):
    complete_count: int
    partial_count: int
    missing_count: int
    sections: List[SectionCoverageItem]

    model_config = ConfigDict(from_attributes=True)


class TimetableInsightsResponse(BaseModel):
    is_configured: bool
    total_scheduled_periods: int
    total_expected_slots: Optional[int] = None
    assignment_completion_percentage: Optional[float] = None
    unassigned_slots: Optional[int] = None
    total_teachers: int
    teacher_utilization_percentage: Optional[float] = None
    free_teachers_now_count: Optional[int] = None
    conflict_count: int
    conflicts: List[ConflictItem]
    coverage_summary: CoverageSummary

    model_config = ConfigDict(from_attributes=True)
