from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.browser_session import (
    BROWSER_SESSION_HEADER,
    clear_browser_cookie,
    end_browser_session,
    require_frontend_origin,
    start_browser_session,
)
from app.core.database import get_db
from app.core.login_limits import enforce_login_limits
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.school import School
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest, TokenResponse
from app.services.emblem_service import available_emblem_url

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _profile(user: User, db: Session) -> AuthUserResponse:
    school_id = user.school_id
    school = db.scalar(select(School).where(School.id == school_id, School.deleted_at.is_(None))) if school_id else None
    return AuthUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        login_mobile=user.login_mobile,
        role=user.role,
        is_active=user.is_active,
        school_setup_completed=user.school_setup_completed,
        school_id=school_id,
        school_name=school.name if school else None,
        school_primary_color=school.primary_color if school else None,
        school_emblem_url=available_emblem_url(school.emblem_url) if school else None,
    )


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    return hash_password("dummy verification for unknown sign-in accounts")


@router.post("/login", response_model=TokenResponse, response_model_exclude_none=True)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    browser = request.headers.get(BROWSER_SESSION_HEADER) == "browser"
    if browser:
        require_frontend_origin(request.headers.get("origin"))
    email = payload.email.strip().lower()
    enforce_login_limits(db, request, email)
    user = db.scalar(select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None)))
    digest = user.password_hash if user and user.password_hash else _dummy_password_hash()
    valid = verify_password(payload.password, digest)
    if not user or not user.password_hash or not valid or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if user.role == UserRole.STAFF and user.staff_status != "ACTIVE":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    response.headers["Cache-Control"] = "no-store"
    profile = _profile(user, db)
    if browser:
        start_browser_session(db, request, response, user)
        return TokenResponse(user=profile, token_type="cookie")
    return TokenResponse(user=profile, access_token=create_access_token({"sub": str(user.id)}))


@router.post("/quick-login", status_code=status.HTTP_410_GONE, deprecated=True)
def quick_login():
    raise HTTPException(status.HTTP_410_GONE, "Sign in with your account password.")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    require_frontend_origin(request.headers.get("origin"))
    end_browser_session(db, request)
    db.commit()
    clear_browser_cookie(response)


@router.get("/me", response_model=AuthUserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    response.headers["Cache-Control"] = "no-store"
    return _profile(current_user, db)
