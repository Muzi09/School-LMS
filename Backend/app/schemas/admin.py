from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class CreateAdminRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Admin email")
    login_mobile: str = Field(..., min_length=5, max_length=20)
    password: str = Field(..., min_length=8, max_length=100)


# Backward compatibility alias
CreateSuperAdminRequest = CreateAdminRequest


class CreateSalesPersonRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Sales person email")
    login_mobile: str = Field(..., min_length=5, max_length=20)
    password: str = Field(..., min_length=8, max_length=100)


class CreatePrincipalRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr = Field(..., description="Principal email address for invitation")
    login_mobile: str = Field(..., min_length=5, max_length=20)


class PrincipalListItem(BaseModel):
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
    school_code: str | None = None
    created_at: datetime
    onboarding_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminDashboardStats(BaseModel):
    total_schools: int
    total_principals: int
    total_active_schools: int
    total_pending_setups: int
    total_sales_persons: int


# Backward compatibility alias
SuperAdminDashboardStats = AdminDashboardStats
