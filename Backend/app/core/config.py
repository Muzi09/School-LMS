import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:admin@localhost:5432/school_lms_db"

    # JWT Settings
    JWT_SECRET: str = "super-secret-jwt-key-for-school-lms-platform-auth"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Onboarding Settings
    ONBOARDING_TOKEN_EXPIRE_HOURS: int = 72  # 3 days
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP Email Settings (Optional in dev, falls back to logging/console if not set)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "noreply@school-lms.com"
    SMTP_FROM_NAME: str = "School LMS Platform"
    SMTP_USE_TLS: bool = True

    # Admin Default Seed Credentials
    ADMIN_DEFAULT_EMAIL: str = "admin@platform.com"
    ADMIN_DEFAULT_PASSWORD: str = "Admin@123"
    ADMIN_DEFAULT_FIRST_NAME: str = "Admin"
    ADMIN_DEFAULT_LAST_NAME: str = "User"
    ADMIN_DEFAULT_MOBILE: str = "9999999999"

    # Backward compatibility settings
    SUPER_ADMIN_DEFAULT_EMAIL: str = "admin@platform.com"
    SUPER_ADMIN_DEFAULT_PASSWORD: str = "Admin@123"
    SUPER_ADMIN_DEFAULT_FIRST_NAME: str = "Admin"
    SUPER_ADMIN_DEFAULT_LAST_NAME: str = "User"
    SUPER_ADMIN_DEFAULT_MOBILE: str = "9999999999"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
