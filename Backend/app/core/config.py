from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str

    # Security & JWT Authentication
    JWT_SECRET: str = Field(min_length=32)
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, gt=0, le=1440)
    SMTP_ENCRYPTION_KEY: SecretStr | None = None
    SMTP_ALLOWED_HOSTS: str = "smtp.gmail.com,smtp.office365.com,smtp.mail.yahoo.com"
    CHAT_REDIS_URL: str | None = None

    # Onboarding & Application URLs
    ONBOARDING_TOKEN_EXPIRE_HOURS: int = 72  # 3 days
    FRONTEND_URL: str = "http://localhost:5173"

    @field_validator("FRONTEND_URL")
    @classmethod
    def validate_frontend_origins(cls, value: str) -> str:
        origins = []
        for entry in value.split(","):
            origin = entry.strip().rstrip("/")
            parsed = urlsplit(origin)
            loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
            if (
                not parsed.hostname or "*" in parsed.netloc or parsed.username is not None
                or parsed.path or parsed.query or parsed.fragment
                or (parsed.scheme != "https" and not (loopback and parsed.scheme == "http"))
            ):
                raise ValueError("FRONTEND_URL must contain explicit HTTPS origins or local HTTP origins")
            origins.append(origin)
        return ",".join(origins)

    @property
    def frontend_origins(self) -> list[str]:
        return self.FRONTEND_URL.split(",")

    @property
    def public_frontend_url(self) -> str:
        return self.frontend_origins[0]

    model_config = SettingsConfigDict(
        env_file=[str(BASE_DIR / ".env"), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )


settings = Settings()
