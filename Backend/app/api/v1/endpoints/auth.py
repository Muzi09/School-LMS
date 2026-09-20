from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, verify_password, verify_pin
from app.models.enums import UserRole
from app.models.school import School
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest, QuickLoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_auth_response(user: User, db: Session) -> TokenResponse:
    school_name = None
    school_primary_color = None
    school_emblem_url = None
    if user.school_id:
        school = db.query(School).filter(School.id == user.school_id, School.deleted_at.is_(None)).first()
        if school:
            school_name = school.name
            school_primary_color = school.primary_color
            school_emblem_url = school.emblem_url

    user_response = AuthUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        login_mobile=user.login_mobile,
        role=user.role,
        is_active=user.is_active,
        school_setup_completed=user.school_setup_completed,
        school_id=user.school_id,
        school_name=school_name,
        school_primary_color=school_primary_color,
        school_emblem_url=school_emblem_url,
    )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role.value if hasattr(user.role, "value") else int(user.role),
            "email": user.email,
            "school_id": str(user.school_id) if user.school_id else None,
            "school_setup_completed": user.school_setup_completed,
        }
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Standard general login using Email + Password.
    Supported for Super Admin, Principal (after setup), Staff, and Sales Person.
    """
    email_clean = payload.email.strip().lower()
    user = (
        db.query(User)
        .filter(
            func.lower(User.email) == email_clean,
            User.deleted_at.is_(None),
        )
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if Staff is in pending activation state
    if user.role == UserRole.STAFF:
        staff_profile = getattr(user, "staff_profile", None)
        if (staff_profile and staff_profile.status == "PENDING_ACTIVATION") or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account has not been activated yet. Please use the setup link sent to your email to create your password and PIN.",
            )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return _build_auth_response(user, db)


@router.post("/quick-login", response_model=TokenResponse)
def quick_login(
    payload: QuickLoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Quick login using Email + PIN (Principal and active Staff).
    """
    email_clean = payload.email.strip().lower()
    user = (
        db.query(User)
        .filter(
            func.lower(User.email) == email_clean,
            User.deleted_at.is_(None),
        )
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN",
        )

    # Check if Staff is in pending activation state
    if user.role == UserRole.STAFF:
        staff_profile = getattr(user, "staff_profile", None)
        if (staff_profile and staff_profile.status == "PENDING_ACTIVATION") or not user.pin_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account has not been activated yet. Please use the setup link sent to your email to create your password and PIN.",
            )
    elif user.role != UserRole.PRINCIPAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quick PIN login is exclusively available for School Principals and Staff",
        )

    if not user.pin_hash or not verify_pin(payload.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN",
        )

    return _build_auth_response(user, db)


@router.get("/me", response_model=AuthUserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve current authenticated user context and profile.
    """
    school_name = None
    school_primary_color = None
    school_emblem_url = None
    if current_user.school_id:
        school = db.query(School).filter(School.id == current_user.school_id, School.deleted_at.is_(None)).first()
        if school:
            school_name = school.name
            school_primary_color = school.primary_color
            school_emblem_url = school.emblem_url

    return AuthUserResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        login_mobile=current_user.login_mobile,
        role=current_user.role,
        is_active=current_user.is_active,
        school_setup_completed=current_user.school_setup_completed,
        school_id=current_user.school_id,
        school_name=school_name,
        school_primary_color=school_primary_color,
        school_emblem_url=school_emblem_url,
    )
