from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str

    # Security & JWT Authentication
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Onboarding & Application URLs
    ONBOARDING_TOKEN_EXPIRE_HOURS: int = 72  # 3 days
    FRONTEND_URL: str = "http://localhost:5173"

    # Admin Default Seed Credentials
    ADMIN_DEFAULT_EMAIL: str = 'amzikhan711@gmail.com'
    ADMIN_DEFAULT_PASSWORD: str = 'Admin@123'
    ADMIN_DEFAULT_FIRST_NAME: str = "Muzammil"
    ADMIN_DEFAULT_LAST_NAME: str = "Khan"
    ADMIN_DEFAULT_MOBILE: str = "8234971938"

    model_config = SettingsConfigDict(
        env_file=[str(BASE_DIR / ".env"), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
