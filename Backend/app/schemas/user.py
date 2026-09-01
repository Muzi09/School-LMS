from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.profile import (
    StaffProfileCreate,
    StaffProfileRead,
    StaffProfileUpdate,
    StudentProfileCreate,
    StudentProfileRead,
    StudentProfileUpdate,
)


# ----------------------------------------------------
# Base User Schemas
# ----------------------------------------------------
class UserBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20, description="Login mobile number")
    email: EmailStr | None = Field(default=None, description="Email address")


# ----------------------------------------------------
# User Creation Schemas per Role
# ----------------------------------------------------
class CreateStaffRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr = Field(..., description="Mandatory email for Staff")
    password: str = Field(..., min_length=8, description="Plaintext password to be hashed")
    profile: StaffProfileCreate = Field(..., description="Staff profile details")


class CreateStudentRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr | None = Field(default=None, description="Optional email for Student")
    password: str = Field(..., min_length=8, description="Plaintext password to be hashed")
    profile: StudentProfileCreate = Field(..., description="Student profile details")


# ----------------------------------------------------
# User Update Schemas
# ----------------------------------------------------
class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    login_mobile: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=8)
    is_active: bool | None = None

    staff_profile: StaffProfileUpdate | None = None
    student_profile: StudentProfileUpdate | None = None


class UserStatusUpdate(BaseModel):
    is_active: bool


# ----------------------------------------------------
# User Read / Response Schemas
# ----------------------------------------------------
class UserRead(UserBase):
    id: UUID
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None
    deleted_at: datetime | None = None
    deleted_by: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class UserDetailRead(UserRead):
    staff_profile: StaffProfileRead | None = None
    student_profile: StudentProfileRead | None = None

    model_config = ConfigDict(from_attributes=True)
