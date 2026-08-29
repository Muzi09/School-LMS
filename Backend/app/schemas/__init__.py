from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.profile import (
    StaffProfileCreate,
    StaffProfileRead,
    StaffProfileUpdate,
    StudentProfileCreate,
    StudentProfileRead,
    StudentProfileUpdate,
)
from app.schemas.staff import StaffDetailRead
from app.schemas.student import StudentDetailRead
from app.schemas.user import (
    CreateStaffRequest,
    CreateStudentRequest,
    UserBase,
    UserDetailRead,
    UserRead,
    UserStatusUpdate,
    UserUpdate,
)

__all__ = [
    "PaginatedResponse",
    "MessageResponse",
    "StaffProfileCreate",
    "StaffProfileRead",
    "StaffProfileUpdate",
    "StudentProfileCreate",
    "StudentProfileRead",
    "StudentProfileUpdate",
    "StaffDetailRead",
    "StudentDetailRead",
    "UserBase",
    "CreateStaffRequest",
    "CreateStudentRequest",
    "UserUpdate",
    "UserStatusUpdate",
    "UserRead",
    "UserDetailRead",
]
