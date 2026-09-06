from typing import Annotated, Sequence
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
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


# ---------------------------------------------------------
# Service Providers
# ---------------------------------------------------------
def get_user_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    db: Annotated[Session, Depends(get_db)],
) -> UserService:
    return UserService(user_repo=user_repo, db=db)


# ---------------------------------------------------------
# Authentication & Authorization Dependencies
# ---------------------------------------------------------
def get_current_user_optional(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)] = None,
    x_user_id: Annotated[UUID | None, Header(
        description="Authenticated User ID header for testing context")] = None,
) -> User | None:
    """
    Resolve current user context.
    1. First checks Authorization: Bearer <JWT>
    2. Fallback to X-User-Id header if present in testing
    """
    if bearer and bearer.credentials:
        try:
            payload = decode_access_token(bearer.credentials)
            user_id_str = payload.get("sub")
            if user_id_str:
                user_id = UUID(user_id_str)
                user = user_repo.get_by_id(user_id)
                if user and user.is_active:
                    return user
        except Exception:
            return None

    if x_user_id:
        user = user_repo.get_by_id(x_user_id)
        if user and user.is_active:
            return user

    return None


def get_current_user(
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    """Ensure an active authenticated user is present."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid session token.",
        )
    return current_user


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

# Backward compatibility aliases
require_super_admin = require_admin
require_principal_or_super_admin = require_principal_or_admin
