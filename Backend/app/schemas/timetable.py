from datetime import datetime, time
from typing import List, Optional
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
    period_number: int
    start_time: str
    end_time: str
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
# Timetable Entry Schemas
# ---------------------------------------------------------------------------


class TimetableEntryCreate(BaseModel):
    section_id: UUID = Field(..., description="Target Section UUID")
    subject_id: UUID = Field(..., description="Subject UUID (must belong to section via ClassSubject)")
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
    section_id: UUID
    period_id: UUID
    period_number: int
    day_of_week: str
    subject: TimetableSubjectRead
    teacher: Optional[TimetableTeacherRead] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    code: str = Field(..., description="Conflict code, e.g. TEACHER_SCHEDULE_CONFLICT or SECTION_SCHEDULE_CONFLICT")
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
