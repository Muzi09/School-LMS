from app.schemas.common import MessageResponse, PaginatedResponse
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
from app.schemas.user import (
    CreateAdminRequest,
    CreateStudentRequest,
    CreateTeacherRequest,
    UserBase,
    UserDetailRead,
    UserRead,
    UserStatusUpdate,
    UserUpdate,
)

__all__ = [
    "PaginatedResponse",
    "MessageResponse",
    "AdminProfileCreate",
    "AdminProfileRead",
    "AdminProfileUpdate",
    "TeacherProfileCreate",
    "TeacherProfileRead",
    "TeacherProfileUpdate",
    "StudentProfileCreate",
    "StudentProfileRead",
    "StudentProfileUpdate",
    "UserBase",
    "CreateAdminRequest",
    "CreateTeacherRequest",
    "CreateStudentRequest",
    "UserUpdate",
    "UserStatusUpdate",
    "UserRead",
    "UserDetailRead",
]
