from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db,
    require_manage_timetable,
    require_view_timetable,
)
from app.core.exceptions import BadRequestException
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
    TimetableGridResponse,
    TimetablePeriodCreate,
    TimetablePeriodRead,
    TimetablePeriodUpdate,
    TimetableTeacherRead,
)
from app.services.timetable_service import TimetableService

router = APIRouter(prefix="/timetable", tags=["Time Table Management"])


def get_timetable_service(db: Annotated[Session, Depends(get_db)]) -> TimetableService:
    return TimetableService(db=db)


# ===========================================================================
# Period Endpoints
# ===========================================================================


@router.get(
    "/periods",
    response_model=List[TimetablePeriodRead],
    summary="List School Timetable Periods",
    description="Retrieve all configured periods for the current user's school in ascending period number order.",
)
def list_periods(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        return []
    periods = service.list_periods(school_id=school_id)
    return [
        TimetablePeriodRead(
            id=p.id,
            school_id=p.school_id,
            period_number=p.period_number,
            start_time=p.start_time.strftime("%H:%M"),
            end_time=p.end_time.strftime("%H:%M"),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in periods
    ]


@router.post(
    "/periods",
    response_model=TimetablePeriodRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Timetable Period",
    description="Add a new period to the school's timetable configuration.",
)
def create_period(
    data: TimetablePeriodCreate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    p = service.create_period(school_id=school_id, data=data, user_id=current_user.id)
    return TimetablePeriodRead(
        id=p.id,
        school_id=p.school_id,
        period_number=p.period_number,
        start_time=p.start_time.strftime("%H:%M"),
        end_time=p.end_time.strftime("%H:%M"),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.put(
    "/periods/{period_id}",
    response_model=TimetablePeriodRead,
    summary="Update Timetable Period",
    description="Modify period numbering or start and end timings.",
)
def update_period(
    period_id: UUID,
    data: TimetablePeriodUpdate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    p = service.update_period(school_id=school_id, period_id=period_id, data=data, user_id=current_user.id)
    return TimetablePeriodRead(
        id=p.id,
        school_id=p.school_id,
        period_number=p.period_number,
        start_time=p.start_time.strftime("%H:%M"),
        end_time=p.end_time.strftime("%H:%M"),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.delete(
    "/periods/{period_id}",
    response_model=MessageResponse,
    summary="Delete Timetable Period",
    description="Soft delete a timetable period from the school schedule.",
)
def delete_period(
    period_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    service.delete_period(school_id=school_id, period_id=period_id, user_id=current_user.id)
    return MessageResponse(message="Timetable period deleted successfully.")


# ===========================================================================
# Eligible Teachers
# ===========================================================================


@router.get(
    "/teachers",
    response_model=List[TimetableTeacherRead],
    summary="List Eligible Teachers",
    description="Retrieve all active teaching staff members eligible for timetable scheduling.",
)
def list_eligible_teachers(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        return []
    return service.list_eligible_teachers(school_id=school_id)


# ===========================================================================
# Timetable Grid & Entries
# ===========================================================================


@router.get(
    "",
    response_model=TimetableGridResponse,
    summary="Get Weekly Timetable Grid",
    description="Retrieve the weekly timetable schedule for a specific section, including periods, entries, and subjects.",
)
def get_timetable(
    section_id: Annotated[UUID, Query(..., description="Target section UUID")],
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    return service.get_timetable_grid(school_id=school_id, section_id=section_id)


@router.post(
    "",
    response_model=TimetableEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Timetable Entry",
    description="Schedule a subject and teacher for a section on a specific day and period.",
)
def create_timetable_entry(
    data: TimetableEntryCreate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    entry = service.create_entry(school_id=school_id, data=data, user_id=current_user.id)
    # Refresh with relationships for return
    grid = service.get_timetable_grid(school_id=school_id, section_id=entry.section_id)
    matched = next((e for e in grid["entries"] if str(e["id"]) == str(entry.id)), None)
    if matched:
        return matched

    t = entry.teacher
    sp = t.staff_profile if t else None
    return TimetableEntryRead(
        id=entry.id,
        school_id=entry.school_id,
        section_id=entry.section_id,
        period_id=entry.period_id,
        period_number=entry.period.period_number if entry.period else 0,
        day_of_week=entry.day_of_week,
        subject={
            "id": entry.subject.id,
            "name": entry.subject.name,
            "code": entry.subject.code,
            "category": entry.subject.category,
            "is_academic": entry.subject.is_academic,
        },
        teacher={
            "id": t.id,
            "name": f"{t.first_name} {t.last_name}".strip(),
            "first_name": t.first_name,
            "last_name": t.last_name,
            "email": t.email,
            "roll_no": sp.roll_no if sp else None,
            "department": sp.department if sp else None,
            "designation": sp.designation if sp else None,
        },
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.put(
    "/{entry_id}",
    response_model=TimetableEntryRead,
    summary="Update Timetable Entry",
    description="Update subject, teacher, period, or day for an existing timetable entry.",
)
def update_timetable_entry(
    entry_id: UUID,
    data: TimetableEntryUpdate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    entry = service.update_entry(school_id=school_id, entry_id=entry_id, data=data, user_id=current_user.id)
    grid = service.get_timetable_grid(school_id=school_id, section_id=entry.section_id)
    matched = next((e for e in grid["entries"] if str(e["id"]) == str(entry.id)), None)
    if matched:
        return matched

    t = entry.teacher
    sp = t.staff_profile if t else None
    return TimetableEntryRead(
        id=entry.id,
        school_id=entry.school_id,
        section_id=entry.section_id,
        period_id=entry.period_id,
        period_number=entry.period.period_number if entry.period else 0,
        day_of_week=entry.day_of_week,
        subject={
            "id": entry.subject.id,
            "name": entry.subject.name,
            "code": entry.subject.code,
            "category": entry.subject.category,
            "is_academic": entry.subject.is_academic,
        },
        teacher={
            "id": t.id,
            "name": f"{t.first_name} {t.last_name}".strip(),
            "first_name": t.first_name,
            "last_name": t.last_name,
            "email": t.email,
            "roll_no": sp.roll_no if sp else None,
            "department": sp.department if sp else None,
            "designation": sp.designation if sp else None,
        },
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.delete(
    "/{entry_id}",
    response_model=MessageResponse,
    summary="Delete Timetable Entry",
    description="Remove a scheduled entry from the class timetable.",
)
def delete_timetable_entry(
    entry_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    service.delete_entry(school_id=school_id, entry_id=entry_id, user_id=current_user.id)
    return MessageResponse(message="Timetable entry deleted successfully.")
