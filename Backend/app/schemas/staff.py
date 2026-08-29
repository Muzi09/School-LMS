from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.profile import StaffProfileCreate, StaffProfileRead, StaffProfileUpdate


class CreateStaffRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr = Field(..., description="Mandatory email for Staff")
    password: str = Field(..., min_length=8, description="Password")
    profile: StaffProfileCreate = Field(..., description="Staff profile details")


class StaffUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    login_mobile: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=8)
    is_active: bool | None = None
    profile: StaffProfileUpdate | None = None


class StaffDetailRead(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    login_mobile: str
    email: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    staff_profile: StaffProfileRead | None = None

    model_config = ConfigDict(from_attributes=True)
