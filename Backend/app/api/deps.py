from typing import Annotated, Sequence
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService


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
    x_user_id: Annotated[UUID | None, Header(
        description="Authenticated User ID header for development/context")] = None,
) -> User | None:
    """
    Resolve current user context.
    If X-User-Id header is supplied, look up the active user from the database.
    """
    if not x_user_id:
        return None

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
            detail="Authentication required. Please provide a valid user session.",
        )
    return current_user


class RoleChecker:
    """
    Role-Based Access Control dependency factory.
    Enforces that current_user has one of the allowed roles.
    """

    def __init__(self, allowed_roles: Sequence[UserRole]):
        self.allowed_roles = set(allowed_roles)

    def __call__(
        self,
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role.name}",
            )
        return current_user


# Convenience role dependencies
require_principal = RoleChecker([UserRole.PRINCIPAL])
require_staff_or_principal = RoleChecker([UserRole.PRINCIPAL, UserRole.STAFF])
