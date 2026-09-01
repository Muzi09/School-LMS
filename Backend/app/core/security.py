from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any
import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with automatically generated salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not hashed_password:
        return False
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def hash_pin(pin: str) -> str:
    """Hash a plaintext PIN using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")


def verify_pin(plain_pin: str, hashed_pin: str | None) -> bool:
    """Verify a plaintext PIN against a stored bcrypt hash."""
    if not hashed_pin:
        return False
    return bcrypt.checkpw(
        plain_pin.encode("utf-8"),
        hashed_pin.encode("utf-8"),
    )


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
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])


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
    import base64
    from cryptography.fernet import Fernet
    key_bytes = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_smtp_password(plain_password: str) -> str:
    """Encrypt plaintext SMTP password using Fernet symmetric encryption."""
    if not plain_password:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_password.encode("utf-8")).decode("utf-8")


def decrypt_smtp_password(encrypted_password: str) -> str:
    """Decrypt stored Fernet encrypted SMTP password."""
    if not encrypted_password:
        return ""
    f = _get_fernet()
    return f.decrypt(encrypted_password.encode("utf-8")).decode("utf-8")

