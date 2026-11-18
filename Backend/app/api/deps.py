from typing import Annotated, Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.browser_session import COOKIE_NAME, SAFE_METHODS, find_browser_user, require_frontend_origin
from app.core.database import get_db
from app.core.permissions import Permission, has_permission
from app.core.security import decode_access_token
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
from app.services.chat_service import ChatService
from app.services.user_service import UserService

security_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------
# Repository Providers
# ---------------------------------------------------------
def get_school_repository(
    db: Annotated[Session, Depends(get_db)],
) -> SchoolRepository:
    return SchoolRepository(db=db)


def get_user_repository(
    db: Annotated[Session, Depends(get_db)],
) -> UserRepository:
    return UserRepository(db=db)


def get_chat_repository(
    db: Annotated[Session, Depends(get_db)],
) -> ChatRepository:
    return ChatRepository(db=db)


# ---------------------------------------------------------
# Service Providers
# ---------------------------------------------------------
def get_user_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    db: Annotated[Session, Depends(get_db)],
) -> UserService:
    return UserService(user_repo=user_repo, db=db)


def get_chat_service(
    chat_repo: Annotated[ChatRepository, Depends(get_chat_repository)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatService:
    return ChatService(chat_repo=chat_repo, user_repo=user_repo, db=db)


# ---------------------------------------------------------
# Authentication & Authorization Dependencies
# ---------------------------------------------------------
def get_current_user_optional(
    request: Request,
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)] = None,
) -> User | None:
    if not bearer:
        token = request.cookies.get(COOKIE_NAME)
        if token and request.method not in SAFE_METHODS:
            require_frontend_origin(request.headers.get("origin"))
        return find_browser_user(user_repo.db, token)
    try:
        user_id = UUID(decode_access_token(bearer.credentials)["sub"])
    except (InvalidTokenError, KeyError, ValueError, TypeError, AttributeError):
        return None
    user = user_repo.get_by_id(user_id)
    return user if user and user.is_active else None


def get_current_user(
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    """Ensure an active authenticated user is present."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_school_id(user: User) -> UUID:
    school_id = user.school_id
    if school_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A school account is required.")
    return school_id


class RoleChecker:
    """
    Role-Based Access Control dependency factory.
    Enforces that current_user has one of the allowed roles.
    """

    def __init__(self, allowed_roles: Sequence[UserRole], require_setup_completed: bool = False):
        self.allowed_roles = set(allowed_roles)
        self.require_setup_completed = require_setup_completed

    def __call__(
        self,
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role.name}",
            )

        if self.require_setup_completed and current_user.role == UserRole.PRINCIPAL:
            if not current_user.school_setup_completed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="School setup has not been completed. Please complete the onboarding wizard first.",
                )

        return current_user


class PermissionChecker:
    """
    Fine-grained permission check dependency.
    Enforces that the current authenticated user's role has the required permission.
    """

    def __init__(self, required_permission: Permission, require_setup_completed: bool = True):
        self.required_permission = required_permission
        self.require_setup_completed = require_setup_completed

    def __call__(
        self,
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not has_permission(current_user.role, self.required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted: missing permission '{self.required_permission.value}'",
            )

        if self.require_setup_completed and current_user.role == UserRole.PRINCIPAL:
            if not current_user.school_setup_completed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="School setup has not been completed. Please complete the onboarding wizard first.",
                )

        return current_user


# Convenience role dependencies
require_admin = RoleChecker([UserRole.ADMIN])
require_principal = RoleChecker([UserRole.PRINCIPAL], require_setup_completed=True)
require_principal_or_admin = RoleChecker([UserRole.ADMIN, UserRole.PRINCIPAL])
require_staff_or_principal = RoleChecker([UserRole.PRINCIPAL, UserRole.STAFF], require_setup_completed=True)
require_any_authenticated = RoleChecker([
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.STAFF,
    UserRole.STUDENT,
    UserRole.SALES_PERSON,
])

# Convenience permission dependencies
require_manage_staff = PermissionChecker(Permission.MANAGE_STAFF)
require_create_staff = PermissionChecker(Permission.CREATE_STAFF)
require_view_staff = PermissionChecker(Permission.VIEW_STAFF)
require_update_staff = PermissionChecker(Permission.UPDATE_STAFF)
require_delete_staff = PermissionChecker(Permission.DELETE_STAFF)
require_resend_staff_setup = PermissionChecker(Permission.RESEND_STAFF_SETUP)
require_view_students = PermissionChecker(Permission.VIEW_STUDENTS)
require_manage_students = PermissionChecker(Permission.MANAGE_STUDENTS)
require_manage_email_setup = PermissionChecker(Permission.MANAGE_EMAIL_SETUP)
require_view_timetable = PermissionChecker(Permission.VIEW_TIMETABLE)
require_manage_timetable = PermissionChecker(Permission.MANAGE_TIMETABLE)
require_manage_school = PermissionChecker(Permission.MANAGE_SCHOOL)

# Backward compatibility aliases
require_super_admin = require_admin
require_principal_or_super_admin = require_principal_or_admin

