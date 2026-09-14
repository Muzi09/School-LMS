from datetime import date
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
    roll_no: str = Field(..., min_length=1, max_length=50, description="Roll number / Employee Identifier")
    gender: Gender = Field(..., description="Gender (1=Male, 2=Female, 3=Other)")
    date_of_birth: date = Field(..., description="Date of birth")
    father_first_name: str = Field(..., min_length=1, max_length=100, description="Father's first name")
    father_last_name: str = Field(..., min_length=1, max_length=100, description="Father's last name")


class StaffProfileCreate(StaffProfileBase):
    pass


class StaffProfileUpdate(BaseModel):
    roll_no: str | None = Field(default=None, min_length=1, max_length=50)
    gender: Gender | None = None
    date_of_birth: date | None = None
    father_first_name: str | None = Field(default=None, min_length=1, max_length=100)
    father_last_name: str | None = Field(default=None, min_length=1, max_length=100)


class StaffProfileRead(StaffProfileBase):
    id: UUID
    user_id: UUID

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
