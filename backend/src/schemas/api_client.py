"""Pydantic schemas for API clients and the client-credentials token flow."""
from datetime import datetime

from pydantic import BaseModel, Field


class Permissions(BaseModel):
    """Permission scopes for an API client."""

    read: bool = True
    write: bool = False
    delete: bool = False


class APIClientCreate(BaseModel):
    """Request body for creating an API client."""

    name: str = Field(min_length=1, max_length=100)
    permissions: Permissions = Field(default_factory=Permissions)


class APIClientResponse(BaseModel):
    """API client as returned in listings (never includes the secret)."""

    id: int
    name: str
    client_id: str
    permissions: Permissions
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class APIClientCreated(APIClientResponse):
    """Creation response — includes the plaintext secret shown exactly once."""

    client_secret: str


class TokenRequest(BaseModel):
    """Client-credentials token request."""

    client_id: str
    client_secret: str


class TokenResponse(BaseModel):
    """Issued client access token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    scopes: list[str]
