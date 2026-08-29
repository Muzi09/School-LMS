from datetime import date
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Gender


# ----------------------------------------------------
# Admin Profile Schemas
# ----------------------------------------------------
class AdminProfileBase(BaseModel):
    employee_code: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    permissions_override: dict[str, Any] | None = Field(default_factory=dict)


class AdminProfileCreate(AdminProfileBase):
    pass


class AdminProfileUpdate(BaseModel):
    employee_code: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    permissions_override: dict[str, Any] | None = None


class AdminProfileRead(AdminProfileBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Teacher Profile Schemas
# ----------------------------------------------------
class TeacherProfileBase(BaseModel):
    employee_code: str = Field(..., max_length=50)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    qualification: str | None = Field(default=None, max_length=255)
    specialization: str | None = Field(default=None, max_length=255)
    experience_years: int | None = Field(default=0, ge=0)
    joining_date: date | None = None
    bio: str | None = None


class TeacherProfileCreate(TeacherProfileBase):
    pass


class TeacherProfileUpdate(BaseModel):
    employee_code: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    qualification: str | None = Field(default=None, max_length=255)
    specialization: str | None = Field(default=None, max_length=255)
    experience_years: int | None = Field(default=None, ge=0)
    joining_date: date | None = None
    bio: str | None = None


class TeacherProfileRead(TeacherProfileBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# Student Profile Schemas
# ----------------------------------------------------
class StudentProfileBase(BaseModel):
    admission_number: str = Field(..., max_length=50)
    roll_number: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    gender: Gender | None = None
    blood_group: str | None = Field(default=None, max_length=10)
    admission_date: date | None = None
    guardian_name: str = Field(..., max_length=150)
    guardian_relation: str | None = Field(default=None, max_length=50)
    guardian_phone: str = Field(..., max_length=20)
    guardian_email: str | None = Field(default=None, max_length=255)
    emergency_contact_name: str | None = Field(default=None, max_length=150)
    emergency_contact_phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    medical_notes: str | None = None


class StudentProfileCreate(StudentProfileBase):
    pass


class StudentProfileUpdate(BaseModel):
    admission_number: str | None = Field(default=None, max_length=50)
    roll_number: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    gender: Gender | None = None
    blood_group: str | None = Field(default=None, max_length=10)
    admission_date: date | None = None
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_relation: str | None = Field(default=None, max_length=50)
    guardian_phone: str | None = Field(default=None, max_length=20)
    guardian_email: str | None = Field(default=None, max_length=255)
    emergency_contact_name: str | None = Field(default=None, max_length=150)
    emergency_contact_phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    medical_notes: str | None = None


class StudentProfileRead(StudentProfileBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)
