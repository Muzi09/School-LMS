from typing import List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.profile import StudentProfileCreate, StudentProfileRead, StudentProfileUpdate


class CreateStudentRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr | None = Field(default=None, description="Optional email for Student")
    password: str | None = Field(default=None, min_length=8, description="Password (optional, set on first login)")
    profile: StudentProfileCreate = Field(..., description="Student profile details")
    subjects: List[str] | None = Field(default=None, description="Optional list of subjects chosen for this student")


class RollNumberCalculateResponse(BaseModel):
    roll_no: str
    class_name: str
    section: str
    total_students: int


class StudentUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    login_mobile: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=8)
    is_active: bool | None = None
    profile: StudentProfileUpdate | None = None
    subjects: List[str] | None = Field(default=None, description="Optional list of subjects chosen for this student")


class StudentDetailRead(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    login_mobile: str
    email: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    student_profile: StudentProfileRead | None = None

    model_config = ConfigDict(from_attributes=True)
