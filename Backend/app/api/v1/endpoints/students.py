from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user_optional, get_user_service
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.student import (
    CreateStudentRequest,
    RollNumberCalculateResponse,
    StudentDetailRead,
    StudentUpdate,
)
from app.schemas.user import UserStatusUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/students", tags=["Student Management"])


@router.get(
    "/calculate-roll-no",
    response_model=RollNumberCalculateResponse,
    summary="Calculate Student Roll Number",
    description="Calculate preview roll number for a student based on alphabetical order within class and section.",
)
def calculate_roll_no(
    first_name: Annotated[str, Query(min_length=1, max_length=100, description="First name of student")],
    last_name: Annotated[str, Query(min_length=1, max_length=100, description="Last name of student")],
    class_name: Annotated[str, Query(min_length=1, max_length=50, description="Class name")],
    section: Annotated[str, Query(min_length=1, max_length=50, description="Section name")],
    service: Annotated[UserService, Depends(get_user_service)],
    student_id: Annotated[UUID | None, Query(description="Student ID if editing")] = None,
):
    roll_no, total = service.calculate_roll_number(
        first_name=first_name,
        last_name=last_name,
        class_name=class_name,
        section=section,
        student_id=student_id,
    )
    return RollNumberCalculateResponse(
        roll_no=roll_no,
        class_name=class_name,
        section=section,
        total_students=total,
    )


@router.post(
    "",
    response_model=StudentDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Student",
    description="Create a new Student with profile details.",
)
def create_student(
    data: CreateStudentRequest,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    created_by_id = current_user.id if current_user else None
    school_id = current_user.school_id if current_user else None
    user = service.create_student(data=data, created_by_id=created_by_id, school_id=school_id)
    return StudentDetailRead.model_validate(user)


@router.get(
    "",
    response_model=PaginatedResponse[StudentDetailRead],
    summary="List Students",
    description="Retrieve paginated list of students only.",
)
def list_students(
    service: Annotated[UserService, Depends(get_user_service)],
    is_active: Annotated[bool | None, Query(description="Filter by Active Status")] = None,
    class_name: Annotated[str | None, Query(description="Filter by Class")] = None,
    section: Annotated[str | None, Query(description="Filter by Section")] = None,
    search: Annotated[str | None, Query(description="Search in name, email, roll no, mobile, house")] = None,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Page size")] = 10,
):
    items, total = service.list_students(
        is_active=is_active,
        class_name=class_name,
        section=section,
        search=search,
        page=page,
        page_size=page_size,
    )
    validated_items = [StudentDetailRead.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=validated_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{student_id}",
    response_model=StudentDetailRead,
    summary="Get Student Details",
    description="Retrieve full student profile by ID.",
)
def get_student(
    student_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
):
    user = service.get_student_by_id(student_id=student_id)
    return StudentDetailRead.model_validate(user)


@router.put(
    "/{student_id}",
    response_model=StudentDetailRead,
    summary="Update Student",
    description="Update student personal and profile information.",
)
def update_student(
    student_id: UUID,
    data: StudentUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    updated_by_id = current_user.id if current_user else None
    user = service.update_student(student_id=student_id, data=data, updated_by_id=updated_by_id)
    return StudentDetailRead.model_validate(user)


@router.patch(
    "/{student_id}/status",
    response_model=StudentDetailRead,
    summary="Change Student Active Status",
    description="Toggle student active status.",
)
def change_student_status(
    student_id: UUID,
    data: UserStatusUpdate,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    updated_by_id = current_user.id if current_user else None
    user = service.change_user_status(user_id=student_id, is_active=data.is_active, updated_by_id=updated_by_id)
    return StudentDetailRead.model_validate(user)


@router.delete(
    "/{student_id}",
    response_model=MessageResponse,
    summary="Delete Student",
    description="Soft delete student.",
)
def delete_student(
    student_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
):
    deleted_by_id = current_user.id if current_user else None
    service.soft_delete_user(user_id=student_id, deleted_by_id=deleted_by_id)
    return MessageResponse(message=f"Student {student_id} deleted successfully.")
