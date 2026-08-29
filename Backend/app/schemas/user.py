from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.profile import (
    AdminProfileCreate,
    AdminProfileRead,
    AdminProfileUpdate,
    StudentProfileCreate,
    StudentProfileRead,
    StudentProfileUpdate,
    TeacherProfileCreate,
    TeacherProfileRead,
    TeacherProfileUpdate,
)


# ----------------------------------------------------
# Base User Schemas
# ----------------------------------------------------
class UserBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)


# ----------------------------------------------------
# User Creation Schemas per Role
# ----------------------------------------------------
class CreateAdminRequest(UserBase):
    password: str = Field(..., min_length=8, description="Plaintext password to be hashed")
    school_id: UUID = Field(..., description="The school to which the admin belongs")
    profile: AdminProfileCreate | None = Field(default_factory=AdminProfileCreate)


class CreateTeacherRequest(UserBase):
    password: str = Field(..., min_length=8, description="Plaintext password to be hashed")
    school_id: UUID = Field(..., description="The school to which the teacher belongs")
    profile: TeacherProfileCreate = Field(..., description="Teacher profile details")


class CreateStudentRequest(UserBase):
    password: str = Field(..., min_length=8, description="Plaintext password to be hashed")
    school_id: UUID = Field(..., description="The school to which the student belongs")
    profile: StudentProfileCreate = Field(..., description="Student profile details")


# ----------------------------------------------------
# User Update Schemas
# ----------------------------------------------------
class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=8)
    is_active: bool | None = None
    is_verified: bool | None = None

    admin_profile: AdminProfileUpdate | None = None
    teacher_profile: TeacherProfileUpdate | None = None
    student_profile: StudentProfileUpdate | None = None


class UserStatusUpdate(BaseModel):
    is_active: bool


# ----------------------------------------------------
# User Read / Response Schemas
# ----------------------------------------------------
class UserRead(UserBase):
    id: UUID
    role: UserRole
    school_id: UUID | None = None
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserDetailRead(UserRead):
    admin_profile: AdminProfileRead | None = None
    teacher_profile: TeacherProfileRead | None = None
    student_profile: StudentProfileRead | None = None

    model_config = ConfigDict(from_attributes=True)
