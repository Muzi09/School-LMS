from uuid import UUID

from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.user import (
    CreatePrincipalRequest,
    CreateStaffRequest,
    CreateStudentRequest,
    UserDetailRead,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.user_service import UserService


class UserController:
    """
    Controller Layer for User & Profile operations.
    Handles HTTP presentation logic, orchestrates service calls, and formats response DTOs.
    """

    def __init__(self, user_service: UserService):
        self.user_service = user_service

    def create_principal(
        self,
        data: CreatePrincipalRequest,
        current_user: User | None = None,
    ) -> UserDetailRead:
        """Handle Principal creation."""
        created_by_id = current_user.id if current_user else None
        user = self.user_service.create_principal(data=data, created_by_id=created_by_id)
        return UserDetailRead.model_validate(user)

    def create_staff(
        self,
        data: CreateStaffRequest,
        current_user: User | None = None,
    ) -> UserDetailRead:
        """Handle Staff creation."""
        created_by_id = current_user.id if current_user else None
        user = self.user_service.create_staff(data=data, created_by_id=created_by_id)
        return UserDetailRead.model_validate(user)

    def create_student(
        self,
        data: CreateStudentRequest,
        current_user: User | None = None,
    ) -> UserDetailRead:
        """Handle Student creation."""
        created_by_id = current_user.id if current_user else None
        user = self.user_service.create_student(data=data, created_by_id=created_by_id)
        return UserDetailRead.model_validate(user)

    def get_user(self, user_id: UUID) -> UserDetailRead:
        """Retrieve single user details by ID."""
        user = self.user_service.get_user_by_id(user_id=user_id)
        return UserDetailRead.model_validate(user)

    def list_users(
        self,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[UserDetailRead]:
        """Retrieve paginated and filtered list of users."""
        items, total = self.user_service.list_users(
            role=role,
            is_active=is_active,
            search=search,
            page=page,
            page_size=page_size,
        )
        validated_items = [UserDetailRead.model_validate(item) for item in items]
        return PaginatedResponse.create(
            items=validated_items,
            total=total,
            page=page,
            page_size=page_size,
        )

    def update_user(
        self,
        user_id: UUID,
        data: UserUpdate,
        current_user: User | None = None,
    ) -> UserDetailRead:
        """Update existing user and associated profile."""
        updated_by_id = current_user.id if current_user else None
        user = self.user_service.update_user(
            user_id=user_id,
            data=data,
            updated_by_id=updated_by_id,
        )
        return UserDetailRead.model_validate(user)

    def change_user_status(
        self,
        user_id: UUID,
        data: UserStatusUpdate,
        current_user: User | None = None,
    ) -> UserDetailRead:
        """Update user active status (activate/deactivate)."""
        updated_by_id = current_user.id if current_user else None
        user = self.user_service.change_user_status(
            user_id=user_id,
            is_active=data.is_active,
            updated_by_id=updated_by_id,
        )
        return UserDetailRead.model_validate(user)

    def delete_user(
        self,
        user_id: UUID,
        current_user: User | None = None,
    ) -> MessageResponse:
        """Soft delete a user."""
        deleted_by_id = current_user.id if current_user else None
        self.user_service.soft_delete_user(
            user_id=user_id,
            deleted_by_id=deleted_by_id,
        )
        return MessageResponse(message=f"User {user_id} deleted successfully.")
