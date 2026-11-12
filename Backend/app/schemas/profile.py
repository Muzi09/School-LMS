from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Gender


# ----------------------------------------------------
# Principal Profile Schemas
# ----------------------------------------------------
class PrincipalProfileBase(BaseModel):
    school_id: UUID | None = Field(default=None, description="Assigned School ID")
    school_setup_completed: bool = Field(default=False, description="Whether school onboarding setup is complete")


class PrincipalProfileCreate(PrincipalProfileBase):
    pass


class PrincipalProfileUpdate(BaseModel):
    school_id: UUID | None = None
    school_setup_completed: bool | None = None


class PrincipalProfileRead(PrincipalProfileBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Staff Profile Schemas (Replaces Admin & Teacher)
# ----------------------------------------------------
class StaffProfileBase(BaseModel):
    roll_no: str = Field(default="", max_length=50, description="Roll number / Employee Identifier (auto-generated)")
    gender: Gender = Field(..., description="Gender (1=Male, 2=Female, 3=Other)")
    date_of_birth: date = Field(..., description="Date of birth")
    tag: str = Field(default="Teacher", max_length=100, description="Designation tag displayed below teacher name")
    designation: str | None = Field(default=None, max_length=100)
    is_academic: bool = Field(default=True, description="Teaching & academic responsibilities")
    is_non_academic: bool = Field(default=False, description="Administrative / non-academic responsibilities")
    working_shifts: list[dict] = Field(default_factory=list, description="List of working intervals [{'start_time': '08:00', 'end_time': '14:00'}]")
    assigned_wing_ids: list[UUID] = Field(default_factory=list, description="Assigned wing IDs for academic staff")


class StaffProfileCreate(StaffProfileBase):
    pass


class StaffProfileUpdate(BaseModel):
    roll_no: str | None = Field(default=None, min_length=1, max_length=50)
    gender: Gender | None = None
    date_of_birth: date | None = None
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    tag: str | None = Field(default=None, max_length=100)
    is_academic: bool | None = None
    is_non_academic: bool | None = None
    working_shifts: list[dict] | None = None
    assigned_wing_ids: list[UUID] | None = None


class StaffProfileRead(StaffProfileBase):
    id: UUID
    user_id: UUID
    status: str = "PENDING_ACTIVATION"
    school_id: UUID | None = None
    activated_at: datetime | None = None
    department: str | None = None
    designation: str | None = None
    tag: str = "Teacher"
    is_academic: bool = True
    is_non_academic: bool = False
    working_shifts: list[dict] = []
    assigned_wing_ids: list[UUID] = []
    assigned_wings: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Student Profile Schemas
# ----------------------------------------------------
class StudentProfileBase(BaseModel):
    middle_name: str | None = Field(default=None, max_length=100, description="Middle name")
    roll_no: str = Field(default="", max_length=50, description="Roll number (auto-assigned)")
    gender: Gender = Field(..., description="Gender (1=Male, 2=Female, 3=Other)")
    date_of_birth: date = Field(..., description="Date of birth")
    class_name: str = Field(..., min_length=1, max_length=50, description="Class / Grade")
    section: str = Field(..., min_length=1, max_length=50, description="Section")
    house: str = Field(..., min_length=1, max_length=50, description="House")
    father_first_name: str = Field(..., min_length=1, max_length=100, description="Father's first name")
    father_last_name: str = Field(..., min_length=1, max_length=100, description="Father's last name")


class StudentProfileCreate(StudentProfileBase):
    pass


class StudentProfileUpdate(BaseModel):
    middle_name: str | None = Field(default=None, max_length=100)
    roll_no: str | None = Field(default=None, min_length=1, max_length=50)
    gender: Gender | None = None
    date_of_birth: date | None = None
    class_name: str | None = Field(default=None, min_length=1, max_length=50)
    section: str | None = Field(default=None, min_length=1, max_length=50)
    house: str | None = Field(default=None, min_length=1, max_length=50)
    father_first_name: str | None = Field(default=None, min_length=1, max_length=100)
    father_last_name: str | None = Field(default=None, min_length=1, max_length=100)


class StudentProfileRead(StudentProfileBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)
