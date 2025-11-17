"""
Schemas for initial application setup.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class SMTPConfig(BaseModel):
    """SMTP configuration for email sending."""

    smtp_host: str = Field(..., description="SMTP server hostname")
    smtp_port: int = Field(..., ge=1, le=65535, description="SMTP server port")
    smtp_user: Optional[str] = Field(None, description="SMTP username (optional)")
    smtp_password: Optional[str] = Field(None, description="SMTP password (optional)")
    smtp_from_email: EmailStr = Field(..., description="From email address")
    smtp_from_name: str = Field(
        default="Pantrie", description="From name for emails"
    )
    smtp_use_tls: bool = Field(default=True, description="Use TLS encryption")


class ProxyConfig(BaseModel):
    """Reverse proxy configuration."""

    proxy_mode: str = Field(default="none", description="Proxy mode: none, builtin, or external")
    external_proxy_url: Optional[str] = Field(None, description="External proxy URL (if using external)")
    custom_domain: Optional[str] = Field(None, description="Custom domain for the application")
    use_https: bool = Field(default=True, description="Use HTTPS")


class InitialSetupRequest(BaseModel):
    """Schema for initial setup request."""

    admin_email: EmailStr = Field(..., description="Email for the administrator account")
    admin_username: str = Field(
        ..., min_length=3, max_length=50, description="Username for the administrator"
    )
    admin_password: str = Field(
        ..., min_length=8, description="Password for the administrator"
    )
    household_name: str = Field(
        ..., min_length=1, max_length=100, description="Name for the initial household"
    )
    smtp_config: Optional[SMTPConfig] = Field(
        None, description="SMTP configuration for email sending (optional)"
    )
    proxy_config: Optional[ProxyConfig] = Field(
        None, description="Reverse proxy configuration (optional)"
    )

    @field_validator("admin_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class SetupStatusResponse(BaseModel):
    """Schema for setup status response."""

    setup_complete: bool = Field(..., description="Whether initial setup is complete")
    message: str = Field(..., description="Status message")


class InitialSetupResponse(BaseModel):
    """Schema for initial setup response."""

    user: dict = Field(..., description="Created user information")
    household: dict = Field(..., description="Created household information")
    message: str = Field(..., description="Success message")
