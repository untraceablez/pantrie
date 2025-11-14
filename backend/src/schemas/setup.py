"""
Schemas for initial application setup.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator


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
