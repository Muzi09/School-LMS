# Re-export from admin schema for full backward compatibility
from app.schemas.admin import (
    AdminDashboardStats,
    CreateAdminRequest,
    CreatePrincipalRequest,
    CreateSalesPersonRequest,
    CreateSuperAdminRequest,
    PrincipalListItem,
    SuperAdminDashboardStats,
)

__all__ = [
    "CreateAdminRequest",
    "CreateSuperAdminRequest",
    "CreateSalesPersonRequest",
    "CreatePrincipalRequest",
    "PrincipalListItem",
    "AdminDashboardStats",
    "SuperAdminDashboardStats",
]
