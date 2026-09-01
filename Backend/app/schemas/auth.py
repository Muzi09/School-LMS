from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User plaintext password")


class QuickLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Principal email address")
    pin: str = Field(..., min_length=4, max_length=10, description="Principal quick login PIN")


class AuthUserResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str | None = None
    login_mobile: str
    role: UserRole
    is_active: bool
    school_setup_completed: bool
    school_id: UUID | None = None
    school_name: str | None = None
    school_primary_color: str | None = None
    school_emblem_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse
