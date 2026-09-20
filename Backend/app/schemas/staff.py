from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.profile import StaffProfileCreate, StaffProfileRead, StaffProfileUpdate


class CreateStaffRequest(BaseModel):
    """
    Staff creation schema by Principal.
    Password and PIN are strictly NOT collected here;
    they are created by the Staff member themselves during first login setup.
    """
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    login_mobile: str = Field(..., min_length=5, max_length=20)
    email: EmailStr = Field(..., description="Mandatory email for Staff")
    profile: StaffProfileCreate = Field(..., description="Staff profile details")


class StaffUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    login_mobile: str | None = Field(default=None, max_length=20)
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
    status: str = "PENDING_ACTIVATION"
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    created_by_name: str | None = None
    staff_profile: StaffProfileRead | None = None

    model_config = ConfigDict(from_attributes=True)


class StaffCreationResponse(BaseModel):
    staff: StaffDetailRead
    setup_url: str
    email_sent: bool
    email_configured: bool
    email_error: str | None = None
    message: str


class StaffResendSetupResponse(BaseModel):
    setup_url: str
    email_sent: bool
    message: str


class StaffSetupValidateResponse(BaseModel):
    staff_id: UUID
    first_name: str
    last_name: str
    email: str | None
    school_name: str | None
    is_valid: bool
    message: str


class StaffCompleteSetupRequest(BaseModel):
    token: str = Field(..., description="Single-use setup token from invitation")
    password: str = Field(..., min_length=8, description="Password created by Staff")
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$", description="4-digit numeric Quick Login PIN created by Staff")
