from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SmtpConfigResponse(BaseModel):
    """
    Safe public response schema for Super Admin SMTP configuration.
    Never exposes plaintext or encrypted SMTP passwords.
    """
    model_config = ConfigDict(from_attributes=True)

    is_configured: bool
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    security: Optional[str] = None
    is_active: bool = True
    is_password_set: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SaveSmtpConfigRequest(BaseModel):
    """
    Request payload to save or update Super Admin SMTP configuration.
    Password is required on creation, and optional on update if already configured.
    """
    smtp_host: str = Field(..., min_length=1, max_length=255, description="SMTP Server Host (e.g. smtp.gmail.com)")
    smtp_port: int = Field(default=587, ge=1, le=65535, description="SMTP Port (e.g. 587, 465, 25)")
    smtp_username: str = Field(..., min_length=1, max_length=255, description="SMTP Username / Login")
    smtp_password: Optional[str] = Field(default=None, description="SMTP Password (leave blank on update to keep current)")
    from_email: EmailStr = Field(..., description="From sender email address")
    from_name: str = Field(default="School LMS Platform", min_length=1, max_length=255, description="From sender display name")
    security: str = Field(default="TLS", pattern="^(TLS|SSL|NONE)$", description="Security mode: TLS (STARTTLS), SSL, or NONE")
    is_active: bool = Field(default=True)
