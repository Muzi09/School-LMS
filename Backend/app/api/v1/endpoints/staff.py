import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_user_service,
    require_create_staff,
    require_delete_staff,
    require_manage_staff,
    require_resend_staff_setup,
    require_update_staff,
    require_view_staff,
)
from app.core.config import settings
from app.models.school import School
from app.models.smtp_configuration import SmtpConfiguration
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.staff import (
    CreateStaffRequest,
    StaffCompleteSetupRequest,
    StaffCreationResponse,
    StaffDetailRead,
    StaffResendSetupResponse,
    StaffSetupValidateResponse,
    StaffUpdate,
)
from app.schemas.user import UserStatusUpdate
from app.services.email_service import send_staff_invitation_email
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/staff", tags=["Staff Management"])


# ---------------------------------------------------------------------------
# Public Account Setup Endpoints (One-time token activation)
# ---------------------------------------------------------------------------


@router.get(
    "/setup/validate",
    response_model=StaffSetupValidateResponse,
    summary="Validate Staff Setup Token",
    description="Public endpoint to validate a one-time staff onboarding token.",
)
def validate_staff_setup(
    token: Annotated[str, Query(..., description="Setup token received via invitation email or link")],
    service: Annotated[UserService, Depends(get_user_service)],
):
    token_record, user = service.validate_staff_setup_token(token)
    school_name = None
    if user.staff_profile and user.staff_profile.school:
        school_name = user.staff_profile.school.name

    return StaffSetupValidateResponse(
        staff_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        school_name=school_name,
        is_valid=True,
        message="Setup token is valid.",
    )


@router.post(
    "/setup",
    response_model=MessageResponse,
    summary="Complete Staff Account Setup",
    description="Public endpoint: Staff member sets their password and 4-digit PIN to activate account.",
)
def complete_staff_setup(
    payload: StaffCompleteSetupRequest,
    service: Annotated[UserService, Depends(get_user_service)],
):
    service.complete_staff_setup(
        raw_token=payload.token,
        password=payload.password,
        pin=payload.pin,
    )
    return MessageResponse(message="Staff account activated successfully! You can now log in.")


# ---------------------------------------------------------------------------
# Protected Staff Management Endpoints (RBAC Enforced)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=StaffCreationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Staff Member",
    description="Create a new Staff member in PENDING_ACTIVATION status and send or generate setup link.",
)
def create_staff(
    data: CreateStaffRequest,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_create_staff)],
    db: Annotated[Session, Depends(get_db)],
):
    school_id = current_user.school_id
    user, raw_token = service.create_staff(
        data=data,
        created_by_id=current_user.id,
        school_id=school_id,
    )

    setup_url = f"{settings.FRONTEND_URL}/login/setup?token={raw_token}"

    # Check Principal's email setup
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.deleted_at.is_(None),
            SmtpConfiguration.is_active.is_(True),
        )
        .first()
    )

    email_sent = False
    email_error = None
    email_configured = bool(smtp_config and smtp_config.smtp_host)

    if email_configured:
        school_name = "School LMS"
        if current_user.school_id:
            school = db.query(School).filter(School.id == current_user.school_id, School.deleted_at.is_(None)).first()
            if school and school.name:
                school_name = school.name

        staff_name = f"{user.first_name} {user.last_name}".strip()
        try:
            email_sent = send_staff_invitation_email(
                staff_name=staff_name,
                staff_email=user.email,
                school_name=school_name,
                raw_token=raw_token,
                smtp_config=smtp_config,
            )
        except Exception as exc:
            logger.error(f"Failed to send staff invitation email to {user.email}: {exc}")
            email_sent = False
            email_error = "Staff account created, but the setup email could not be sent. You can share or resend the setup link manually."

    if email_sent:
        message = "Staff member created successfully. Account setup invitation email has been sent."
    elif email_configured:
        message = "Staff member created, but setup email failed to send. Please share the setup link manually."
    else:
        message = "Staff member created successfully. Email setup is not configured, so please copy and share the setup link manually."

    return StaffCreationResponse(
        staff=StaffDetailRead.model_validate(user),
        setup_url=setup_url,
        email_sent=email_sent,
        email_configured=email_configured,
        email_error=email_error,
        message=message,
    )


@router.get(
    "",
    response_model=PaginatedResponse[StaffDetailRead],
    summary="List Staff Members",
    description="Retrieve paginated list of staff members only.",
)
def list_staff(
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_view_staff)],
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
    current_user: Annotated[User, Depends(require_view_staff)],
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
    current_user: Annotated[User, Depends(require_update_staff)],
):
    user = service.update_staff(staff_id=staff_id, data=data, updated_by_id=current_user.id)
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
    current_user: Annotated[User, Depends(require_manage_staff)],
):
    user = service.change_user_status(user_id=staff_id, is_active=data.is_active, updated_by_id=current_user.id)
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
    current_user: Annotated[User, Depends(require_delete_staff)],
):
    service.soft_delete_user(user_id=staff_id, deleted_by_id=current_user.id)
    return MessageResponse(message=f"Staff member {staff_id} deleted successfully.")


@router.post(
    "/{staff_id}/resend-setup",
    response_model=StaffResendSetupResponse,
    summary="Resend Staff Setup Email",
    description="Invalidate previous setup token, generate a fresh setup token, and send/return setup link.",
)
def resend_staff_setup(
    staff_id: UUID,
    service: Annotated[UserService, Depends(get_user_service)],
    current_user: Annotated[User, Depends(require_resend_staff_setup)],
    db: Annotated[Session, Depends(get_db)],
):
    user, raw_token = service.resend_staff_setup_token(staff_id=staff_id)
    setup_url = f"{settings.FRONTEND_URL}/login/setup?token={raw_token}"

    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.deleted_at.is_(None),
            SmtpConfiguration.is_active.is_(True),
        )
        .first()
    )

    email_sent = False
    if smtp_config and smtp_config.is_active and smtp_config.smtp_host:
        school_name = "School LMS"
        if current_user.school_id:
            school = db.query(School).filter(School.id == current_user.school_id, School.deleted_at.is_(None)).first()
            if school and school.name:
                school_name = school.name
        try:
            email_sent = send_staff_invitation_email(
                staff_name=f"{user.first_name} {user.last_name}".strip(),
                staff_email=user.email,
                school_name=school_name,
                raw_token=raw_token,
                smtp_config=smtp_config,
            )
        except Exception as exc:
            logger.error(f"Failed to resend staff invitation email to {user.email}: {exc}")
            email_sent = False

    msg = (
        "Setup link generated and email sent successfully."
        if email_sent
        else "Setup link generated. Outgoing email could not be sent or is not configured; please copy the link manually."
    )

    return StaffResendSetupResponse(
        setup_url=setup_url,
        email_sent=email_sent,
        message=msg,
    )
