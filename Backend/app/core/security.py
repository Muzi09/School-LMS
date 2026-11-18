from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any
import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import BadRequestException


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with automatically generated salt."""
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise BadRequestException("Passwords must be at most 72 bytes in UTF-8.")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(encoded, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"iat": now, "exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    return jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM],
        options={"require": ["sub", "exp"]},
    )


def generate_onboarding_token() -> tuple[str, str]:
    """
    Generate a cryptographically secure onboarding raw token and its sha256 hash.
    Returns (raw_token, token_hash).
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, token_hash


def hash_token(raw_token: str) -> str:
    """Compute sha256 hash of a raw token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _get_fernet():
    from cryptography.fernet import Fernet

    if settings.SMTP_ENCRYPTION_KEY is None:
        raise BadRequestException("SMTP password encryption is not configured.")
    try:
        return Fernet(settings.SMTP_ENCRYPTION_KEY.get_secret_value())
    except ValueError as exc:
        raise BadRequestException("SMTP password encryption is not configured correctly.") from exc


def smtp_password_is_configured(ciphertext: str | None) -> bool:
    return bool(settings.SMTP_ENCRYPTION_KEY and ciphertext and ciphertext.startswith("v1:"))


def encrypt_smtp_password(plain_password: str) -> str:
    return "v1:" + _get_fernet().encrypt(plain_password.encode("utf-8")).decode("ascii")


def decrypt_smtp_password(encrypted_password: str) -> str:
    if not smtp_password_is_configured(encrypted_password):
        raise BadRequestException("Save a new SMTP password before sending mail.")
    return _get_fernet().decrypt(encrypted_password[3:].encode("ascii")).decode("utf-8")
