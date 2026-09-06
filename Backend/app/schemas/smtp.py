from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SmtpConfigResponse(BaseModel):
    """
    Safe public response schema for Admin SMTP configuration.
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
    smtp_password: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SaveSmtpConfigRequest(BaseModel):
    """
    Request payload to save or update Admin SMTP configuration.
    Password is required on creation, and optional on update if already configured.
    """
    smtp_host: str = Field(default="smtp.gmail.com", min_length=1, max_length=255, description="SMTP Server Host")
    smtp_port: int = Field(default=587, ge=1, le=65535, description="SMTP Port")
    from_email: EmailStr = Field(..., description="From sender email address (also used as SMTP username)")
    smtp_username: Optional[str] = Field(default=None, max_length=255, description="SMTP Username (defaults to from_email)")
    smtp_password: Optional[str] = Field(default=None, description="SMTP Password (leave blank on update to keep current)")
    from_name: str = Field(default="School LMS Platform", min_length=1, max_length=255, description="From sender display name")
    security: str = Field(default="TLS", pattern="^(TLS|SSL|NONE)$", description="Security mode")
    is_active: bool = Field(default=True)


class TestSmtpConfigRequest(BaseModel):
    """
    Payload for testing SMTP connectivity without necessarily saving it.
    """
    smtp_host: str = Field(default="smtp.gmail.com", min_length=1, max_length=255, description="SMTP Host")
    smtp_port: int = Field(default=587, ge=1, le=65535)
    from_email: Optional[EmailStr] = Field(default=None, description="From sender email / Username")
    smtp_username: Optional[str] = Field(default=None, max_length=255)
    smtp_password: Optional[str] = Field(default=None, description="Plaintext password to test. If omitted, tests with currently saved encrypted password.")
    security: str = Field(default="TLS", pattern="^(TLS|SSL|NONE)$")


class TestSmtpConfigResponse(BaseModel):
    """
    Response schema for SMTP connectivity test.
    """
    success: bool
    message: str


