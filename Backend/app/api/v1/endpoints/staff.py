from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user_optional, get_user_service
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.staff import CreateStaffRequest, StaffDetailRead, StaffUpdate
from app.schemas.user import UserStatusUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/staff", tags=["Staff Management"])


@router.post(
    "",
    response_model=StaffDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Staff Member",
    description="Create a new Staff member with profile details.",
)
def create_staff(
    data: CreateStaffRequest,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    created_by_id = current_user.id if current_user else None
    user = service.create_staff(data=data, created_by_id=created_by_id)
    return StaffDetailRead.model_validate(user)


@router.get(
    "",
    response_model=PaginatedResponse[StaffDetailRead],
    summary="List Staff Members",
    description="Retrieve paginated list of staff members only.",
)
def list_staff(
    service: Annotated[UserService, Depends(get_user_service)],
    is_active: Annotated[bool | None, Query(description="Filter by Active Status")] = None,
    search: Annotated[str | None, Query(description="Search in name, email, roll no, mobile")] = None,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Page size")] = 10,
):
    items, total = service.list_staff(
        is_active=is_active,
        search=search,
        page=page,
        page_size=page_size,
    )
    validated_items = [StaffDetailRead.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=validated_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{staff_id}",
    response_model=StaffDetailRead,
    summary="Get Staff Details",
    description="Retrieve full staff profile by ID.",
)
def get_staff(
    staff_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
):
    user = service.get_staff_by_id(staff_id=staff_id)
    return StaffDetailRead.model_validate(user)


@router.put(
    "/{staff_id}",
    response_model=StaffDetailRead,
    summary="Update Staff Member",
    description="Update staff personal and profile information.",
)
def update_staff(
    staff_id: UUID,
    data: StaffUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    updated_by_id = current_user.id if current_user else None
    user = service.update_staff(staff_id=staff_id, data=data, updated_by_id=updated_by_id)
    return StaffDetailRead.model_validate(user)


@router.patch(
    "/{staff_id}/status",
    response_model=StaffDetailRead,
    summary="Change Staff Active Status",
    description="Toggle staff active status.",
)
def change_staff_status(
    staff_id: UUID,
    data: UserStatusUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    updated_by_id = current_user.id if current_user else None
    user = service.change_user_status(user_id=staff_id, is_active=data.is_active, updated_by_id=updated_by_id)
    return StaffDetailRead.model_validate(user)


@router.delete(
    "/{staff_id}",
    response_model=MessageResponse,
    summary="Delete Staff Member",
    description="Soft delete staff member.",
)
def delete_staff(
    staff_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    deleted_by_id = current_user.id if current_user else None
    service.soft_delete_user(user_id=staff_id, deleted_by_id=deleted_by_id)
    return MessageResponse(message=f"Staff member {staff_id} deleted successfully.")
