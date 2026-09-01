import os
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, hash_pin, hash_token
from app.models.enums import UserRole
from app.models.house import House
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingValidateResponse,
    SchoolSetupRequest,
    SchoolSetupResponse,
)

router = APIRouter(prefix="/principal/onboarding", tags=["Principal Onboarding"])

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "emblems")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _find_and_verify_token(token: str, db: Session) -> tuple[PrincipalOnboardingToken, User]:
    """Helper to verify onboarding token validity and unexpired status."""
    token_clean = token.strip()
    if not token_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Onboarding token is required",
        )

    t_hash = hash_token(token_clean)
    token_record = db.query(PrincipalOnboardingToken).filter(
        PrincipalOnboardingToken.token_hash == t_hash,
    ).first()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unrecognized onboarding token.",
        )

    if token_record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This onboarding setup link has already been used. Please log in with your credentials.",
        )

    now_utc = datetime.now(timezone.utc)
    if token_record.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This onboarding setup link has expired. Please contact the platform administration.",
        )

    user = db.query(User).filter(
        User.id == token_record.user_id,
        User.deleted_at.is_(None),
    ).first()

    if not user or not user.is_active or user.role != UserRole.PRINCIPAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Principal user account for this onboarding link.",
        )

    if user.school_setup_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="School setup has already been completed for this account. Please log in directly.",
        )

    return token_record, user


@router.get("/validate", response_model=OnboardingValidateResponse)
def validate_onboarding_token(
    token: Annotated[str, Query(description="Single-use setup token from invitation email")],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Validate an onboarding token when the Principal opens the setup wizard.
    """
    _, user = _find_and_verify_token(token, db)

    return OnboardingValidateResponse(
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        login_mobile=user.login_mobile,
        is_valid=True,
        message="Token is valid. You may proceed with the school onboarding wizard.",
    )


@router.post("/upload-emblem")
async def upload_school_emblem(
    token: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Upload and store school emblem during onboarding wizard.
    Validates token, file type, extension, and size.
    """
    # 1. Verify token
    _find_and_verify_token(token, db)

    # 2. Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Supported formats: PNG, JPG, JPEG, WEBP.",
        )

    # 3. Validate Extension
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Allowed extensions: .png, .jpg, .jpeg, .webp",
        )

    # 4. Read contents and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 5 MB.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 5. Save securely with unique name
    unique_filename = f"emblem_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    emblem_relative_url = f"/uploads/emblems/{unique_filename}"

    return {
        "success": True,
        "emblem_url": emblem_relative_url,
        "filename": unique_filename,
    }


@router.post("/complete", response_model=SchoolSetupResponse)
def complete_school_setup(
    payload: SchoolSetupRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Complete school setup and principal credential creation in an atomic database transaction.
    """
    # 1. Validate Token & User
    token_record, principal = _find_and_verify_token(payload.token, db)

    # 2. Validate Credentials Match
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and Confirm Password do not match.",
        )

    if payload.pin != payload.confirm_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN and Confirm PIN do not match.",
        )

    if not payload.pin.isdigit() or len(payload.pin) < 4 or len(payload.pin) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be 4 to 10 numeric digits.",
        )

    # 3. Check School Code Uniqueness
    school_code_clean = payload.school_code.strip().upper()
    existing_school_code = db.query(School).filter(
        func.upper(School.code) == school_code_clean,
        School.deleted_at.is_(None),
    ).first()

    if existing_school_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"School code '{school_code_clean}' is already in use. Please choose a different code.",
        )

    # Validate primary_color format if provided
    primary_color_clean = None
    if payload.primary_color:
        c_str = payload.primary_color.strip()
        if not re.match(r"^#[0-9A-Fa-f]{6}$", c_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid theme color format. Must be a valid 6-character HEX color e.g. #2563EB",
            )
        primary_color_clean = c_str.upper()

    emblem_url_clean = payload.emblem_url.strip() if payload.emblem_url else None

    # 4. Atomic Transaction for School, Classes, Sections, Houses, and Principal
    try:
        # Create School
        school = School(
            name=payload.school_name.strip(),
            code=school_code_clean,
            email=str(payload.school_email).strip().lower(),
            phone=payload.school_phone.strip(),
            address=payload.address.strip(),
            primary_color=primary_color_clean,
            emblem_url=emblem_url_clean,
            is_active=True,
            setup_completed=True,
            created_by=principal.id,
        )
        db.add(school)
        db.flush()

        # Create Classes and Sections
        seen_classes = set()
        for idx, class_item in enumerate(payload.classes):
            c_name = class_item.name.strip()
            if not c_name or c_name in seen_classes:
                continue
            seen_classes.add(c_name)

            school_class = SchoolClass(
                school_id=school.id,
                name=c_name,
                order_index=class_item.order_index if class_item.order_index else idx,
                created_by=principal.id,
            )
            db.add(school_class)
            db.flush()

            # Create Sections for this class
            seen_sections = set()
            sections_list = class_item.sections if class_item.sections else ["A"]
            for s_name in sections_list:
                sec_clean = s_name.strip().upper()
                if not sec_clean or sec_clean in seen_sections:
                    continue
                seen_sections.add(sec_clean)

                section = Section(
                    school_id=school.id,
                    class_id=school_class.id,
                    name=sec_clean,
                    created_by=principal.id,
                )
                db.add(section)

        # Create Houses
        seen_houses = set()
        for h_item in payload.houses:
            h_name = h_item.name.strip()
            if not h_name or h_name.lower() in seen_houses:
                continue
            seen_houses.add(h_name.lower())

            house = House(
                school_id=school.id,
                name=h_name,
                color=h_item.color.strip() if h_item.color else None,
                created_by=principal.id,
            )
            db.add(house)

        # Update Principal User
        principal.school_id = school.id
        principal.password_hash = hash_password(payload.password)
        principal.pin_hash = hash_pin(payload.pin)
        principal.school_setup_completed = True
        principal.updated_by = principal.id

        # Invalidate Token
        token_record.used_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(school)
        db.refresh(principal)

        return SchoolSetupResponse(
            success=True,
            message="School setup completed successfully! You can now log in to the application.",
            school_id=school.id,
            school_name=school.name,
            principal_id=principal.id,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete school setup: {str(e)}",
        )
