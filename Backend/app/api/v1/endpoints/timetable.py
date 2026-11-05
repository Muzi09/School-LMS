from typing import Annotated, Any, Dict, List, Optional
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
    BatchSetupAssignmentsRequest,
    BulkSlotAssignRequest,
    ClassWiseTimetableResponse,
    ConflictCheckRequest,
    ConflictCheckResponse,
    FreeTeachersResponse,
    ImpactPreviewResponse,
    MasterTimetableResponse,
    MergeDaysRequest,
    MoveClassesRequest,
    SplitDaysRequest,
    TeacherScheduleResponse,
    TimetableCreate,
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
    TimetableGridResponse,
    TimetableInsightsResponse,
    TimetablePeriodCreate,
    TimetablePeriodRead,
    TimetablePeriodUpdate,
    TimetableRead,
    TimetableSetupCreate,
    TimetableSetupRead,
    TimetableSetupUpdate,
    TimetableTeacherRead,
    TimetableUpdate,
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
        } if t else None,
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
        } if t else None,
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


# ===========================================================================
# Multi-View & Insights Endpoints
# ===========================================================================


@router.get(
    "/teacher/{teacher_id}",
    response_model=TeacherScheduleResponse,
    summary="Get Teacher Weekly Schedule",
    description="Retrieve the complete weekly timetable schedule for a specific teacher.",
)
def get_teacher_schedule(
    teacher_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    return service.get_teacher_schedule(school_id=school_id, teacher_user_id=teacher_id)


@router.get(
    "/free-teachers",
    response_model=FreeTeachersResponse,
    summary="Get Free Teachers by Day and Time Intervals",
    description="Scan and retrieve teacher availability for each timetable interval, grouped by day and time.",
)
def get_free_teachers(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
    day_of_week: Annotated[str | None, Query(description="Optional filter by day of week")] = None,
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    return service.get_free_teachers(school_id=school_id, day_of_week=day_of_week)


@router.get(
    "/master",
    response_model=MasterTimetableResponse,
    summary="Get Master Timetable (All Classes)",
    description="Retrieve school-wide timetable for all classes and sections in a single batch.",
)
def get_master_timetable(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    return service.get_master_timetable(school_id=school_id)


@router.get(
    "/insights",
    response_model=TimetableInsightsResponse,
    summary="Get Timetable Status & Insights Dashboard Metrics",
    description="Calculate scheduling completion, unassigned slots, teacher utilization, currently free teachers, conflicts, and coverage summary.",
)
def get_timetable_insights(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")

    return service.get_insights(school_id=school_id)


# ===========================================================================
# Timetable CRUD & Active Management Endpoints
# ===========================================================================


@router.get(
    "/timetables",
    response_model=List[TimetableRead],
    summary="List All Timetables",
    description="Retrieve all timetables (active, inactive, draft) for the school.",
)
def list_timetables(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        return []
    return service.list_timetables(school_id=school_id)


@router.get(
    "/timetables/active",
    response_model=TimetableRead,
    summary="Get Active Timetable",
    description="Retrieve the currently active school timetable.",
)
def get_active_timetable(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.get_active_timetable(school_id=school_id)


@router.post(
    "/timetables",
    response_model=TimetableRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Timetable",
    description="Create a new timetable (blank, duplicated, or copy bell schedule).",
)
def create_timetable(
    data: TimetableCreate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.create_timetable(school_id=school_id, data=data, user_id=current_user.id)


@router.get(
    "/timetables/{timetable_id}",
    response_model=TimetableRead,
    summary="Get Timetable by ID",
)
def get_timetable(
    timetable_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.get_timetable_by_id(school_id=school_id, timetable_id=timetable_id)


@router.put(
    "/timetables/{timetable_id}",
    response_model=TimetableRead,
    summary="Update Timetable Details",
)
def update_timetable(
    timetable_id: UUID,
    data: TimetableUpdate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.update_timetable(school_id=school_id, timetable_id=timetable_id, data=data, user_id=current_user.id)


@router.post(
    "/timetables/{timetable_id}/activate",
    response_model=TimetableRead,
    summary="Set Timetable as Active",
    description="Activate this timetable, deactivating all other timetables for this school.",
)
def activate_timetable(
    timetable_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.activate_timetable(school_id=school_id, timetable_id=timetable_id, user_id=current_user.id)


@router.post(
    "/timetables/{timetable_id}/duplicate",
    response_model=TimetableRead,
    summary="Duplicate Timetable",
)
def duplicate_timetable(
    timetable_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
    name: Optional[str] = Query(None, description="Optional custom name for duplicated timetable"),
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.duplicate_timetable(school_id=school_id, timetable_id=timetable_id, user_id=current_user.id, new_name=name)


@router.delete(
    "/timetables/{timetable_id}",
    response_model=MessageResponse,
    summary="Delete Timetable",
)
def delete_timetable(
    timetable_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    service.delete_timetable(school_id=school_id, timetable_id=timetable_id, user_id=current_user.id)
    return MessageResponse(message="Timetable deleted successfully.")


# ===========================================================================
# Bell Schedule Setup Endpoints
# ===========================================================================


@router.get(
    "/setups",
    response_model=List[TimetableSetupRead],
    summary="List Bell Schedule Setups",
    description="Retrieve all bell schedule setups for a timetable with periods and assigned classes.",
)
def list_setups(
    timetable_id: Annotated[UUID, Query(..., description="Target Timetable UUID")],
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        return []
    return service.list_setups(school_id=school_id, timetable_id=timetable_id)


@router.post(
    "/setups",
    response_model=TimetableSetupRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Bell Schedule Setup",
)
def create_setup(
    data: TimetableSetupCreate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    setup = service.create_setup(school_id=school_id, data=data, user_id=current_user.id)
    setups = service.list_setups(school_id=school_id, timetable_id=data.timetable_id)
    matched = next((s for s in setups if str(s["id"]) == str(setup.id)), None)
    return matched or setups[0]


@router.put(
    "/setups/{setup_id}",
    response_model=TimetableSetupRead,
    summary="Update Bell Schedule Setup",
)
def update_setup(
    setup_id: UUID,
    data: TimetableSetupUpdate,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    setup = service.update_setup(school_id=school_id, setup_id=setup_id, data=data, user_id=current_user.id)
    setups = service.list_setups(school_id=school_id, timetable_id=setup.timetable_id)
    matched = next((s for s in setups if str(s["id"]) == str(setup.id)), None)
    return matched or setups[0]


@router.post(
    "/setups/{setup_id}/duplicate",
    response_model=TimetableSetupRead,
    summary="Duplicate Bell Schedule Setup",
)
def duplicate_setup(
    setup_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    setup = service.duplicate_setup(school_id=school_id, setup_id=setup_id, user_id=current_user.id)
    setups = service.list_setups(school_id=school_id, timetable_id=setup.timetable_id)
    matched = next((s for s in setups if str(s["id"]) == str(setup.id)), None)
    return matched or setups[0]


@router.delete(
    "/setups/{setup_id}",
    response_model=MessageResponse,
    summary="Delete Bell Schedule Setup",
)
def delete_setup(
    setup_id: UUID,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    service.delete_setup(school_id=school_id, setup_id=setup_id, user_id=current_user.id)
    return MessageResponse(message="Setup deleted successfully.")


@router.post(
    "/setups/preview-impact",
    response_model=ImpactPreviewResponse,
    summary="Preview Impact of Bell Schedule Changes",
    description="Check whether modifying or removing periods will affect existing scheduled classes.",
)
def preview_impact(
    data: BatchSetupAssignmentsRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.preview_setups_impact(school_id=school_id, timetable_id=data.timetable_id, data=data)


@router.post(
    "/setups/batch-save",
    response_model=List[TimetableSetupRead],
    summary="Batch Save Setups and Applicability Assignments",
    description="Persist all bell setups, period configurations, and class applicability mappings at once.",
)
def batch_save_setups(
    data: BatchSetupAssignmentsRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.batch_save_setups(school_id=school_id, timetable_id=data.timetable_id, data=data, user_id=current_user.id)


@router.post(
    "/setups/split-days",
    response_model=TimetableSetupRead,
    summary="Split Days into New Schedule",
)
def split_days(
    data: SplitDaysRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    setup = service.split_days(school_id=school_id, data=data, user_id=current_user.id)
    setups = service.list_setups(school_id=school_id, timetable_id=setup.timetable_id)
    matched = next((s for s in setups if str(s["id"]) == str(setup.id)), None)
    return matched or setups[0]


@router.post(
    "/setups/merge-days",
    response_model=TimetableSetupRead,
    summary="Merge Schedule Days Back",
)
def merge_days(
    data: MergeDaysRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    setup = service.merge_days(school_id=school_id, data=data, user_id=current_user.id)
    setups = service.list_setups(school_id=school_id, timetable_id=setup.timetable_id)
    matched = next((s for s in setups if str(s["id"]) == str(setup.id)), None)
    return matched or setups[0]


@router.post(
    "/setups/move-classes",
    response_model=MessageResponse,
    summary="Atomic Move Class Sections Between Setups",
)
def move_classes(
    data: MoveClassesRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    result = service.move_classes(school_id=school_id, data=data, user_id=current_user.id)
    return MessageResponse(message=result["message"])


# ===========================================================================
# Class-Wise Timetable & Bulk Assign Endpoints
# ===========================================================================


@router.get(
    "/class-wise",
    response_model=ClassWiseTimetableResponse,
    summary="Get Complete Class-Wise Timetable",
    description="Master data endpoint for the class-wise grid, including wings, classes, setups, scheduled entries, targets, and stats.",
)
def get_class_wise_timetable(
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
    timetable_id: Optional[UUID] = Query(None, description="Optional target timetable ID"),
    wing_id: Optional[UUID] = Query(None, description="Optional filter by wing ID"),
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.get_class_wise_timetable(school_id=school_id, timetable_id=timetable_id, wing_id=wing_id)


@router.post(
    "/check-conflict",
    response_model=ConflictCheckResponse,
    summary="Real-time Conflict Checking",
    description="Verify teacher availability and double-booking across overlapping real time intervals.",
)
def check_conflict(
    data: ConflictCheckRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_view_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.check_slot_conflict(school_id=school_id, data=data)


@router.post(
    "/entries/bulk",
    summary="Bulk Assign or Clear Timetable Slots",
    description="Assign or clear slots across scopes (single slot, weekdays, class sections, fill target).",
)
def bulk_assign(
    data: BulkSlotAssignRequest,
    service: Annotated[TimetableService, Depends(get_timetable_service)],
    current_user: Annotated[User, Depends(require_manage_timetable)],
):
    school_id = current_user.school_id
    if not school_id:
        raise BadRequestException("User does not belong to a school.")
    return service.bulk_assign_slot(school_id=school_id, data=data, user_id=current_user.id)


