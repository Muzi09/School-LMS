from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_onboarding_token, hash_token
from app.models.auth_session import BrowserSession
from app.models.user import User

COOKIE_NAME = "school_lms_session"
BROWSER_SESSION_HEADER = "X-LMS-Session"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def require_frontend_origin(origin: str | None) -> None:
    if origin not in settings.frontend_origins:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Untrusted request origin.")


def find_browser_user(db: Session, token: str | None) -> User | None:
    if not token or len(token) > 128:
        return None
    return db.scalar(select(User).join(BrowserSession, BrowserSession.user_id == User.id).where(
        BrowserSession.token_hash == hash_token(token),
        BrowserSession.expires_at > datetime.now(timezone.utc),
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    ))


def _secure_cookie() -> bool:
    return settings.public_frontend_url.startswith("https://")


def start_browser_session(db: Session, request: Request, response: Response, user: User) -> None:
    require_frontend_origin(request.headers.get("origin"))
    now = datetime.now(timezone.utc)
    end_browser_session(db, request)
    db.execute(delete(BrowserSession).where(
        BrowserSession.user_id == user.id, BrowserSession.expires_at <= now,
    ))
    token, digest = generate_onboarding_token()
    duration = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    db.add(BrowserSession(token_hash=digest, user_id=user.id, expires_at=now + duration))
    db.commit()
    response.set_cookie(
        COOKIE_NAME, token, max_age=int(duration.total_seconds()),
        secure=_secure_cookie(), httponly=True, samesite="lax", path="/",
    )


def end_browser_session(db: Session, request: Request) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token and len(token) <= 128:
        db.execute(delete(BrowserSession).where(BrowserSession.token_hash == hash_token(token)))


def clear_browser_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, secure=_secure_cookie(), httponly=True, samesite="lax", path="/")
