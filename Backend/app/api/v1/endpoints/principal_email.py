from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manage_email_setup
from app.core.database import get_db
from app.core.security import encrypt_smtp_password, decrypt_smtp_password
from app.models.school import School
from app.models.smtp_configuration import SmtpConfiguration
from app.models.user import User
from app.schemas.principal_email import (
    PrincipalEmailConfigRequest,
    PrincipalEmailConfigResponse,
    PrincipalEmailTestRequest,
    PrincipalEmailTestResponse,
)
from app.services.email_service import test_smtp_connection

router = APIRouter(prefix="/principal/email-setup", tags=["Principal Email Setup"])


def _derive_smtp_details(email: str, custom_host: str | None = None, custom_port: int | None = None) -> tuple[str, int, str]:
    """Helper to auto-detect SMTP server host and port based on email domain."""
    if custom_host and custom_host.strip():
        host = custom_host.strip()
        port = custom_port or (465 if "ssl" in host.lower() else 587)
        sec = "SSL" if port == 465 else "TLS"
        return host, port, sec

    email_clean = email.strip().lower()
    domain = email_clean.split("@")[-1] if "@" in email_clean else ""

    if domain in ("outlook.com", "hotmail.com", "live.com", "office365.com"):
        return "smtp.office365.com", 587, "TLS"
    if domain in ("yahoo.com", "ymail.com"):
        return "smtp.mail.yahoo.com", 587, "TLS"
    # Default to Gmail / Google Workspace (standard for Google for Education domains)
    return "smtp.gmail.com", 587, "TLS"


@router.get("", response_model=PrincipalEmailConfigResponse, summary="Get Principal Email Setup Status")
def get_principal_email_setup(
    current_user: Annotated[User, Depends(require_manage_email_setup)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve outgoing email setup status for the logged-in Principal."""
    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(SmtpConfiguration.admin_id == current_user.id)
        .first()
    )

    if not smtp_config:
        # Default sender name: School Name - Principal First + Last name
        principal_full_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        school_name = None
        if current_user.school_id:
            school = db.query(School).filter(School.id == current_user.school_id).first()
            if school and school.name:
                school_name = school.name.strip()

        if school_name and principal_full_name:
            default_sender = f"{school_name} - {principal_full_name}"
        else:
            default_sender = school_name or principal_full_name or "School Office"

        return PrincipalEmailConfigResponse(
            is_configured=False,
            email=current_user.email,
            sender_name=default_sender,
            is_password_set=False,
            app_password=None,
            updated_at=None,
        )

    decrypted_pwd = None
    if smtp_config.smtp_password_encrypted:
        try:
            decrypted_pwd = decrypt_smtp_password(smtp_config.smtp_password_encrypted)
        except Exception:
            decrypted_pwd = None

    return PrincipalEmailConfigResponse(
        is_configured=bool(smtp_config.is_active and smtp_config.smtp_host and smtp_config.from_email),
        email=smtp_config.from_email or smtp_config.smtp_username,
        sender_name=smtp_config.from_name,
        is_password_set=bool(smtp_config.smtp_password_encrypted),
        app_password=decrypted_pwd,
        updated_at=smtp_config.updated_at,
    )


@router.post("", response_model=PrincipalEmailConfigResponse, summary="Configure Principal Email Setup")
def save_principal_email_setup(
    payload: PrincipalEmailConfigRequest,
    current_user: Annotated[User, Depends(require_manage_email_setup)],
    db: Annotated[Session, Depends(get_db)],
):
    """Save or update Principal outgoing email configuration using an App Password."""
    email_clean = payload.email.strip().lower()
    app_pwd_clean = payload.app_password.strip()

    host, port, security = _derive_smtp_details(
        email=email_clean,
        custom_host=payload.smtp_host,
        custom_port=payload.smtp_port,
    )

    sender_name = payload.sender_name.strip() if payload.sender_name else ""
    if not sender_name:
        principal_full_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        school_name = None
        if current_user.school_id:
            school = db.query(School).filter(School.id == current_user.school_id).first()
            if school and school.name:
                school_name = school.name.strip()

        if school_name and principal_full_name:
            sender_name = f"{school_name} - {principal_full_name}"
        else:
            sender_name = school_name or principal_full_name or "School Office"

    encrypted_pwd = encrypt_smtp_password(app_pwd_clean)

    smtp_config = (
        db.query(SmtpConfiguration)
        .filter(SmtpConfiguration.admin_id == current_user.id)
        .first()
    )

    if smtp_config:
        smtp_config.smtp_host = host
        smtp_config.smtp_port = port
        smtp_config.smtp_username = email_clean
        smtp_config.from_email = email_clean
        smtp_config.from_name = sender_name
        smtp_config.security = security
        smtp_config.is_active = True
        smtp_config.smtp_password_encrypted = encrypted_pwd
        smtp_config.updated_by = current_user.id
    else:
        smtp_config = SmtpConfiguration(
            admin_id=current_user.id,
            smtp_host=host,
            smtp_port=port,
            smtp_username=email_clean,
            smtp_password_encrypted=encrypted_pwd,
            from_email=email_clean,
            from_name=sender_name,
            security=security,
            is_active=True,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(smtp_config)

    db.commit()
    db.refresh(smtp_config)

    return PrincipalEmailConfigResponse(
        is_configured=True,
        email=smtp_config.from_email,
        sender_name=smtp_config.from_name,
        is_password_set=True,
        app_password=app_pwd_clean,
        updated_at=smtp_config.updated_at,
    )


@router.post("/test", response_model=PrincipalEmailTestResponse, summary="Test Principal Email Setup")
def test_principal_email_setup(
    payload: PrincipalEmailTestRequest,
    current_user: Annotated[User, Depends(require_manage_email_setup)],
):
    """Test connection with provided email address and App Password."""
    email_clean = payload.email.strip().lower()
    app_pwd_clean = payload.app_password.strip()

    host, port, security = _derive_smtp_details(
        email=email_clean,
        custom_host=payload.smtp_host,
        custom_port=payload.smtp_port,
    )

    is_ok, err_msg = test_smtp_connection(
        smtp_host=host,
        smtp_port=port,
        smtp_username=email_clean,
        smtp_password=app_pwd_clean,
        security=security,
    )

    if not is_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg or "Failed to connect to email server. Please check your Email Address and App Password.",
        )

    return PrincipalEmailTestResponse(
        success=True,
        message="Email server connected and authenticated successfully!",
    )
