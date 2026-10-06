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


class TimetableSubjectRead(BaseModel):
    id: UUID
    name: str
    code: Optional[str] = None
    category: Optional[str] = "academic"
    is_academic: Optional[bool] = True
    teacher_id: Optional[UUID] = None
    teacher: Optional[TimetableTeacherRead] = None

    model_config = ConfigDict(from_attributes=True)


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
