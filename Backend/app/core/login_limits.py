import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth_session import LoginAttempt

WINDOW_SECONDS = 15 * 60


def enforce_login_limits(db: Session, request: Request, email: str) -> None:
    now = datetime.now(timezone.utc)
    expiry = ((int(now.timestamp()) // WINDOW_SECONDS) + 1) * WINDOW_SECONDS
    expires_at = datetime.fromtimestamp(expiry, tz=timezone.utc)

    # Bound cleanup work per login. Skip counters already being collected by another worker.
    stale_keys = select(LoginAttempt.scope_key, LoginAttempt.expires_at).where(
        LoginAttempt.expires_at <= now,
    ).order_by(LoginAttempt.expires_at).limit(128).with_for_update(skip_locked=True)
    db.execute(delete(LoginAttempt).where(tuple_(LoginAttempt.scope_key, LoginAttempt.expires_at).in_(stale_keys)))

    client = request.client.host if request.client else "unknown"
    scopes = ((f"email:{email}", 10), (f"client:{client}", 120))
    exceeded = False
    for scope, limit in sorted(scopes):
        key = hmac.new(settings.JWT_SECRET.encode(), scope.encode(), hashlib.sha256).hexdigest()
        statement = insert(LoginAttempt).values(scope_key=key, expires_at=expires_at, count=1)
        count = db.scalar(statement.on_conflict_do_update(
            index_elements=[LoginAttempt.scope_key, LoginAttempt.expires_at],
            set_={"count": LoginAttempt.count + 1},
            where=LoginAttempt.count < limit,
        ).returning(LoginAttempt.count))
        exceeded |= count is None

    db.commit()
    if exceeded:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many sign-in attempts. Try again later.",
            headers={"Retry-After": str(max(1, expiry - int(now.timestamp())))},
        )
