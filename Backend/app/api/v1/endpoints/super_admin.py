# Backward compatibility router for legacy /super-admin requests
from app.api.v1.endpoints.admin import router as admin_router

from datetime import datetime, timedelta, timezone
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_super_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    decrypt_smtp_password,
    encrypt_smtp_password,
    generate_onboarding_token,
    hash_password,
)
from app.models.enums import UserRole
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.principal import PrincipalProfile
from app.models.school import School
from app.models.smtp_configuration import SmtpConfiguration
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardStats,
    CreateAdminRequest,
    CreatePrincipalRequest,
    CreateSalesPersonRequest,
    PrincipalListItem,
)
from app.schemas.auth import AuthUserResponse
from app.schemas.smtp import (
    SaveSmtpConfigRequest,
    SmtpConfigResponse,
    TestSmtpConfigRequest,
    TestSmtpConfigResponse,
)
from app.services.email_service import (
    send_principal_invitation_email,
    test_smtp_connection,
)

router = APIRouter(prefix="/super-admin", tags=["Super Admin (Legacy Alias)"])


@router.get("/dashboard", response_model=AdminDashboardStats)
def get_super_admin_dashboard(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    total_schools = db.query(School).filter(School.deleted_at.is_(None)).count()
    total_active_schools = db.query(School).filter(
        School.deleted_at.is_(None),
        School.is_active.is_(True),
        School.setup_completed.is_(True),
    ).count()
    total_pending_setups = (
        db.query(PrincipalProfile)
        .join(User, User.id == PrincipalProfile.user_id)
        .filter(
            User.role == UserRole.PRINCIPAL,
            User.deleted_at.is_(None),
            PrincipalProfile.school_setup_completed.is_(False),
        )
        .count()
    )

    total_principals = db.query(User).filter(
        User.role == UserRole.PRINCIPAL,
        User.deleted_at.is_(None),
    ).count()

    total_sales_persons = db.query(User).filter(
        User.role == UserRole.SALES_PERSON,
        User.deleted_at.is_(None),
    ).count()

    return AdminDashboardStats(
        total_schools=total_schools,
        total_principals=total_principals,
        total_active_schools=total_active_schools,
        total_pending_setups=total_pending_setups,
        total_sales_persons=total_sales_persons,
    )


@router.get("/smtp", response_model=SmtpConfigResponse)
def get_smtp_configuration(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.deleted_at.is_(None),
        )
        .first()
    )

    if not smtp_config:
        return SmtpConfigResponse(is_configured=False)

    plain_password = None
    if smtp_config.smtp_password_encrypted:
        try:
            plain_password = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
        except Exception:
            plain_password = None

    return SmtpConfigResponse(
        is_configured=bool(smtp_config.smtp_host and smtp_config.from_email),
        smtp_host=smtp_config.smtp_host,
        smtp_port=smtp_config.smtp_port,
        smtp_username=smtp_config.smtp_username,
        from_email=smtp_config.from_email,
        from_name=smtp_config.from_name,
        security=smtp_config.security,
        is_active=smtp_config.is_active,
        is_password_set=bool(smtp_config.smtp_password_encrypted),
        smtp_password=plain_password,
        created_at=smtp_config.created_at,
        updated_at=smtp_config.updated_at,
    )


@router.post("/smtp", response_model=SmtpConfigResponse)
def save_super_admin_smtp_configuration(
    payload: SaveSmtpConfigRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.deleted_at.is_(None),
        )
        .first()
    )

    email_clean = str(payload.from_email).strip().lower()
    username_clean = payload.smtp_username.strip().lower() if payload.smtp_username else email_clean

    if smtp_config:
        smtp_config.smtp_host = payload.smtp_host.strip()
        smtp_config.smtp_port = payload.smtp_port
        smtp_config.smtp_username = username_clean
        smtp_config.from_email = email_clean
        smtp_config.from_name = payload.from_name.strip()
        smtp_config.security = (payload.security or "TLS").upper()
        smtp_config.is_active = payload.is_active
        smtp_config.updated_by = current_user.id

        if payload.smtp_password and payload.smtp_password.strip():
            smtp_config.smtp_password_encrypted = encrypt_smtp_password(payload.smtp_password.strip())
    else:
        if not payload.smtp_password or not payload.smtp_password.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP password is required for initial configuration.",
            )

        encrypted_pwd = encrypt_smtp_password(payload.smtp_password.strip())
        smtp_config = SmtpConfiguration(
            admin_id=current_user.id,
            smtp_host=payload.smtp_host.strip(),
            smtp_port=payload.smtp_port,
            smtp_username=username_clean,
            smtp_password_encrypted=encrypted_pwd,
            from_email=email_clean,
            from_name=payload.from_name.strip(),
            security=(payload.security or "TLS").upper(),
            is_active=payload.is_active,
            created_by=current_user.id,
        )
        db.add(smtp_config)

    db.commit()
    db.refresh(smtp_config)

    plain_password = None
    if smtp_config.smtp_password_encrypted:
        try:
            plain_password = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
        except Exception:
            plain_password = None

    return SmtpConfigResponse(
        is_configured=True,
        smtp_host=smtp_config.smtp_host,
        smtp_port=smtp_config.smtp_port,
        smtp_username=smtp_config.smtp_username,
        from_email=smtp_config.from_email,
        from_name=smtp_config.from_name,
        security=smtp_config.security,
        is_active=smtp_config.is_active,
        is_password_set=bool(smtp_config.smtp_password_encrypted),
        smtp_password=plain_password,
        created_at=smtp_config.created_at,
        updated_at=smtp_config.updated_at,
    )


@router.post("/smtp/test", response_model=TestSmtpConfigResponse)
def test_super_admin_smtp_configuration_endpoint(
    payload: TestSmtpConfigRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    password_to_test = payload.smtp_password
    if not password_to_test or not password_to_test.strip():
        smtp_config = (
            db.query(SmtpConfiguration)
            .filter(
                SmtpConfiguration.admin_id == current_user.id,
                SmtpConfiguration.deleted_at.is_(None),
            )
            .first()
        )
        if smtp_config and smtp_config.smtp_password_encrypted:
            password_to_test = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP password is required to perform connection test.",
            )

    email_user = payload.from_email or payload.smtp_username or current_user.email
    email_clean = str(email_user).strip().lower()
    username_clean = payload.smtp_username.strip().lower() if payload.smtp_username else email_clean

    success, error_msg = test_smtp_connection(
        smtp_host=payload.smtp_host or "smtp.gmail.com",
        smtp_port=payload.smtp_port or 587,
        smtp_username=username_clean,
        smtp_password=password_to_test,
        security=payload.security or "TLS",
    )

    if not success:
        return TestSmtpConfigResponse(
            success=False,
            message=error_msg or "SMTP connection test failed.",
        )

    return TestSmtpConfigResponse(
        success=True,
        message="SMTP connection and authentication test succeeded! Emails will trigger properly.",
    )


@router.get("/principals", response_model=List[PrincipalListItem])
def list_principals(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    principals = (
        db.query(User)
        .filter(
            User.role == UserRole.PRINCIPAL,
            User.deleted_at.is_(None),
        )
        .order_by(User.created_at.desc())
        .all()
    )

    now_utc = datetime.now(timezone.utc)
    result: List[PrincipalListItem] = []
    for p in principals:
        school_name = None
        school_code = None
        if p.school_id:
            school = db.query(School).filter(School.id == p.school_id, School.deleted_at.is_(None)).first()
            if school:
                school_name = school.name
                school_code = school.code

        onboarding_link_expired = False
        onboarding_token_expires_at = None
        can_regenerate_onboarding = False

        if not p.school_setup_completed:
            latest_token = (
                db.query(PrincipalOnboardingToken)
                .filter(PrincipalOnboardingToken.user_id == p.id)
                .order_by(PrincipalOnboardingToken.created_at.desc())
                .first()
            )
            if not latest_token:
                onboarding_link_expired = True
                can_regenerate_onboarding = True
            else:
                onboarding_token_expires_at = latest_token.expires_at
                is_expired = latest_token.expires_at < now_utc or latest_token.used_at is not None
                onboarding_link_expired = is_expired
                can_regenerate_onboarding = is_expired

        result.append(
            PrincipalListItem(
                id=p.id,
                first_name=p.first_name,
                last_name=p.last_name,
                email=p.email,
                login_mobile=p.login_mobile,
                role=p.role,
                is_active=p.is_active,
                school_setup_completed=p.school_setup_completed,
                school_id=p.school_id,
                school_name=school_name,
                school_code=school_code,
                created_at=p.created_at,
                onboarding_link_expired=onboarding_link_expired,
                onboarding_token_expires_at=onboarding_token_expires_at,
                can_regenerate_onboarding=can_regenerate_onboarding,
            )
        )

    return result


@router.post("/principals", response_model=PrincipalListItem, status_code=status.HTTP_201_CREATED)
def create_principal(
    payload: CreatePrincipalRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.is_active.is_(True),
            SmtpConfiguration.deleted_at.is_(None),
        )
        .first()
    )

    if not smtp_config or not smtp_config.smtp_host or not smtp_config.smtp_password_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP configuration is required before creating a Principal. Please configure SMTP settings first.",
        )

    email_clean = payload.email.strip().lower()
    mobile_clean = payload.login_mobile.strip()

    existing_email = db.query(User).filter(
        func.lower(User.email) == email_clean,
        User.deleted_at.is_(None),
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    existing_mobile = db.query(User).filter(
        User.login_mobile == mobile_clean,
        User.deleted_at.is_(None),
    ).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this mobile number already exists.",
        )

    principal = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email_clean,
        login_mobile=mobile_clean,
        password_hash=None,
        role=UserRole.PRINCIPAL,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(principal)
    db.flush()

    principal_profile = PrincipalProfile(
        user_id=principal.id,
        school_id=None,
        pin_hash=None,
        school_setup_completed=False,
    )
    db.add(principal_profile)
    db.flush()

    raw_token, token_hash = generate_onboarding_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ONBOARDING_TOKEN_EXPIRE_HOURS)

    token_record = PrincipalOnboardingToken(
        user_id=principal.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(token_record)
    db.flush()

    full_name = f"{principal.first_name} {principal.last_name}"
    try:
        send_principal_invitation_email(
            principal_name=full_name,
            principal_email=principal.email,
            raw_token=raw_token,
            smtp_config=smtp_config,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send invitation email: {str(e)}",
        )

    db.commit()
    db.refresh(principal)

    onboarding_url = f"{settings.FRONTEND_URL}/principal/setup-school?token={raw_token}"

    return PrincipalListItem(
        id=principal.id,
        first_name=principal.first_name,
        last_name=principal.last_name,
        email=principal.email,
        login_mobile=principal.login_mobile,
        role=principal.role,
        is_active=principal.is_active,
        school_setup_completed=principal.school_setup_completed,
        school_id=None,
        school_name=None,
        school_code=None,
        created_at=principal.created_at,
        onboarding_url=onboarding_url,
        onboarding_link_expired=False,
        onboarding_token_expires_at=expires_at,
        can_regenerate_onboarding=False,
    )


@router.post("/principals/{principal_id}/regenerate-onboarding", response_model=PrincipalListItem)
def regenerate_principal_onboarding(
    principal_id: str,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(
            SmtpConfiguration.admin_id == current_user.id,
            SmtpConfiguration.is_active.is_(True),
            SmtpConfiguration.deleted_at.is_(None),
        )
        .first()
    )

    if not smtp_config or not smtp_config.smtp_host or not smtp_config.smtp_password_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP configuration is required to send onboarding invitation emails. Please configure SMTP settings first.",
        )

    principal = (
        db.query(User)
        .filter(
            User.id == principal_id,
            User.role == UserRole.PRINCIPAL,
            User.deleted_at.is_(None),
        )
        .first()
    )

    if not principal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Principal not found.",
        )

    if principal.school_setup_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Principal has already completed school onboarding. Onboarding link cannot be regenerated.",
        )

    now_utc = datetime.now(timezone.utc)
    latest_token = (
        db.query(PrincipalOnboardingToken)
        .filter(PrincipalOnboardingToken.user_id == principal.id)
        .order_by(PrincipalOnboardingToken.created_at.desc())
        .first()
    )

    if latest_token and latest_token.expires_at >= now_utc and latest_token.used_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current onboarding link is still valid and has not expired yet. Regeneration is only allowed for expired links.",
        )

    raw_token, token_hash = generate_onboarding_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ONBOARDING_TOKEN_EXPIRE_HOURS)

    token_record = PrincipalOnboardingToken(
        user_id=principal.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(token_record)
    db.flush()

    full_name = f"{principal.first_name} {principal.last_name}"
    try:
        send_principal_invitation_email(
            principal_name=full_name,
            principal_email=principal.email,
            raw_token=raw_token,
            smtp_config=smtp_config,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send onboarding invitation email: {str(e)}",
        )

    db.commit()
    db.refresh(principal)

    onboarding_url = f"{settings.FRONTEND_URL}/principal/setup-school?token={raw_token}"

    school_name = None
    school_code = None
    if principal.school_id:
        school = db.query(School).filter(School.id == principal.school_id, School.deleted_at.is_(None)).first()
        if school:
            school_name = school.name
            school_code = school.code

    return PrincipalListItem(
        id=principal.id,
        first_name=principal.first_name,
        last_name=principal.last_name,
        email=principal.email,
        login_mobile=principal.login_mobile,
        role=principal.role,
        is_active=principal.is_active,
        school_setup_completed=principal.school_setup_completed,
        school_id=principal.school_id,
        school_name=school_name,
        school_code=school_code,
        created_at=principal.created_at,
        onboarding_url=onboarding_url,
        onboarding_link_expired=False,
        onboarding_token_expires_at=expires_at,
        can_regenerate_onboarding=False,
    )


@router.get("/users", response_model=List[AuthUserResponse])
def list_platform_users(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    users = (
        db.query(User)
        .filter(
            User.role.in_([UserRole.ADMIN, UserRole.SALES_PERSON]),
            User.deleted_at.is_(None),
        )
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        AuthUserResponse(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name,
            email=u.email,
            login_mobile=u.login_mobile,
            role=u.role,
            is_active=u.is_active,
            school_setup_completed=u.school_setup_completed,
            school_id=None,
            school_name=None,
        )
        for u in users
    ]


@router.post("/users", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED)
def create_platform_user(
    payload: CreateAdminRequest | CreateSalesPersonRequest,
    target_role: UserRole,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    if target_role not in (UserRole.ADMIN, UserRole.SALES_PERSON):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role for platform user creation. Must be ADMIN or SALES_PERSON.",
        )

    email_clean = payload.email.strip().lower()
    mobile_clean = payload.login_mobile.strip()

    existing_email = db.query(User).filter(
        func.lower(User.email) == email_clean,
        User.deleted_at.is_(None),
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    existing_mobile = db.query(User).filter(
        User.login_mobile == mobile_clean,
        User.deleted_at.is_(None),
    ).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this mobile number already exists.",
        )

    user = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email_clean,
        login_mobile=mobile_clean,
        password_hash=hash_password(payload.password),
        role=target_role,
        is_active=True,
        created_by=current_user.id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        login_mobile=user.login_mobile,
        role=user.role,
        is_active=user.is_active,
        school_setup_completed=user.school_setup_completed,
        school_id=None,
        school_name=None,
    )
