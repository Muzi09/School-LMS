from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_user_service, require_manage_students, require_school_id, require_view_students
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.student import (
    CreateStudentRequest,
    RollNumberCalculateResponse,
    StudentDetailRead,
    StudentRosterRead,
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
    current_user: Annotated[User, Depends(require_manage_students)],
    student_id: Annotated[UUID | None, Query(description="Student ID if editing")] = None,
):
    roll_no, total = service.calculate_roll_number(
        first_name=first_name,
        last_name=last_name,
        class_name=class_name,
        section=section,
        school_id=require_school_id(current_user),
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
    current_user: Annotated[User, Depends(require_manage_students)],
):
    user = service.create_student(data=data, created_by_id=current_user.id, school_id=require_school_id(current_user))
    return StudentDetailRead.model_validate(user)


@router.get(
    "",
    response_model=PaginatedResponse[StudentRosterRead],
    summary="List Students",
    description="Retrieve paginated list of students only.",
)
def list_students(
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_view_students)],
    is_active: Annotated[bool | None, Query(description="Filter by Active Status")] = None,
    class_name: Annotated[str | None, Query(description="Filter by Class")] = None,
    section: Annotated[str | None, Query(description="Filter by Section")] = None,
    search: Annotated[str | None, Query(max_length=100, description="Search in name, roll number, class, section or house")] = None,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Page size")] = 10,
):
    items, total = service.list_students(
        school_id=require_school_id(current_user),
        is_active=is_active,
        class_name=class_name,
        section=section,
        search=search,
        page=page,
        page_size=page_size,
    )
    validated_items = [StudentRosterRead.model_validate(item) for item in items]
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
    response: Response,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_manage_students)],
):
    school_id = require_school_id(current_user)
    user = service.get_student_by_id(student_id=student_id, school_id=school_id)
    record = StudentDetailRead.model_validate(user)
    service.record_student_event(school_id, student_id, current_user.id, "detail_viewed")
    service.db.commit()
    response.headers["Cache-Control"] = "no-store"
    return record


@router.get("/{student_id}/export", response_class=Response)
def export_student(
    student_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_manage_students)],
):
    school_id = require_school_id(current_user)
    student = service.get_student_by_id(student_id, school_id=school_id)
    document = StudentDetailRead.model_validate(student).model_dump_json(indent=2)
    service.record_student_event(school_id, student_id, current_user.id, "exported")
    service.db.commit()
    return Response(document, media_type="application/json", headers={
        "Content-Disposition": f'attachment; filename="student-{student_id}.json"',
        "Cache-Control": "no-store",
    })


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
    current_user: Annotated[User, Depends(require_manage_students)],
):
    user = service.update_student(
        student_id=student_id, data=data, updated_by_id=current_user.id, school_id=require_school_id(current_user)
    )
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
    current_user: Annotated[User, Depends(require_manage_students)],
):
    user = service.change_user_status(
        user_id=student_id, is_active=data.is_active, updated_by_id=current_user.id,
        school_scope=(require_school_id(current_user), UserRole.STUDENT),
    )
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
    current_user: Annotated[User, Depends(require_manage_students)],
):
    service.soft_delete_user(
        user_id=student_id, deleted_by_id=current_user.id,
        school_scope=(require_school_id(current_user), UserRole.STUDENT),
    )
    return MessageResponse(message=f"Student {student_id} deleted successfully.")
