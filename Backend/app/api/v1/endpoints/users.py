from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user_optional, get_user_controller
from app.controllers.user_controller import UserController
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.user import (
    CreateAdminRequest,
    CreateStudentRequest,
    CreateTeacherRequest,
    UserDetailRead,
    UserStatusUpdate,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users & Profiles"])


@router.post(
    "/admin",
    response_model=UserDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create School Admin",
    description="Create a new School Admin account along with their admin profile.",
)
def create_admin_user(
    data: CreateAdminRequest,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.create_admin(data=data, current_user=current_user)


@router.post(
    "/teacher",
    response_model=UserDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Teacher",
    description="Create a new Teacher account along with their teacher profile.",
)
def create_teacher_user(
    data: CreateTeacherRequest,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.create_teacher(data=data, current_user=current_user)


@router.post(
    "/student",
    response_model=UserDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Student",
    description="Create a new Student account along with their student profile.",
)
def create_student_user(
    data: CreateStudentRequest,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.create_student(data=data, current_user=current_user)


@router.get(
    "",
    response_model=PaginatedResponse[UserDetailRead],
    summary="List Users",
    description="Retrieve a paginated list of users with optional filtering by school, role, active status, and search query.",
)
def list_users(
    controller: Annotated[UserController, Depends(get_user_controller)],
    school_id: Annotated[UUID | None, Query(description="Filter by School ID")] = None,
    role: Annotated[UserRole | None, Query(description="Filter by User Role")] = None,
    is_active: Annotated[bool | None, Query(description="Filter by active status")] = None,
    search: Annotated[str | None, Query(description="Search in name, email, or phone")] = None,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
):
    return controller.list_users(
        school_id=school_id,
        role=role,
        is_active=is_active,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{user_id}",
    response_model=UserDetailRead,
    summary="Get User Details",
    description="Retrieve full user profile details by user ID.",
)
def get_user(
    user_id: UUID,
    controller: Annotated[UserController, Depends(get_user_controller)],
):
    return controller.get_user(user_id=user_id)


@router.put(
    "/{user_id}",
    response_model=UserDetailRead,
    summary="Update User",
    description="Update user account and nested profile fields.",
)
def update_user(
    user_id: UUID,
    data: UserUpdate,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.update_user(
        user_id=user_id,
        data=data,
        current_user=current_user,
    )


@router.patch(
    "/{user_id}/status",
    response_model=UserDetailRead,
    summary="Change User Active Status",
    description="Activate or deactivate a user account.",
)
def change_user_status(
    user_id: UUID,
    data: UserStatusUpdate,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.change_user_status(
        user_id=user_id,
        data=data,
        current_user=current_user,
    )


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Delete User",
    description="Soft delete a user account.",
)
def delete_user(
    user_id: UUID,
    controller: Annotated[UserController, Depends(get_user_controller)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    return controller.delete_user(
        user_id=user_id,
        current_user=current_user,
    )
