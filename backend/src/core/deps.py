"""Dependency injection helpers for FastAPI endpoints."""
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings, get_settings
from src.core.cache import CacheService, get_cache_service
from src.core.exceptions import AuthenticationError, AuthorizationError
from src.core.security import decode_token
from src.db.session import get_db
from src.models.api_client import APIClient
from src.models.user import User

# Common dependency annotations
DbSession = Annotated[AsyncSession, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
CacheDep = Annotated[CacheService, Depends(get_cache_service)]


async def get_current_user_id(
    authorization: str | None = Header(None),
) -> int:
    """Extract and validate user ID from JWT token."""
    if not authorization:
        raise AuthenticationError(message="Missing authorization header")

    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise AuthenticationError(message="Invalid authentication scheme")

        # Decode and validate token
        payload = decode_token(token)
        user_id = payload.get("sub")

        if user_id is None:
            raise AuthenticationError(message="Invalid token payload")

        return int(user_id)

    except ValueError:
        raise AuthenticationError(message="Invalid authorization header format")
    except Exception as e:
        raise AuthenticationError(message="Token validation failed", details={"error": str(e)})


async def get_current_user_role(
    authorization: str | None = Header(None),
) -> str:
    """Extract user role from JWT token."""
    if not authorization:
        raise AuthenticationError(message="Missing authorization header")

    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise AuthenticationError(message="Invalid authentication scheme")

        # Decode and validate token
        payload = decode_token(token)
        role = payload.get("role")

        if role is None:
            raise AuthenticationError(message="Invalid token payload")

        return role

    except ValueError:
        raise AuthenticationError(message="Invalid authorization header format")
    except Exception as e:
        raise AuthenticationError(message="Token validation failed", details={"error": str(e)})


async def get_current_user(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: DbSession,
) -> User:
    """Get the current authenticated user from the database."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError(message="User not found")

    return user


# Type aliases for dependency injection
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
CurrentUserRole = Annotated[str, Depends(get_current_user_role)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_api_client(
    db: DbSession,
    authorization: str | None = Header(None),
) -> APIClient:
    """Authenticate an external API client from its bearer token.

    Distinct from user auth: the token MUST be of type ``client``. Loads the
    client, verifies it is still active, and records last-used time.
    """
    if not authorization:
        raise AuthenticationError(message="Missing authorization header")

    try:
        scheme, token = authorization.split()
    except ValueError:
        raise AuthenticationError(message="Invalid authorization header format")
    if scheme.lower() != "bearer":
        raise AuthenticationError(message="Invalid authentication scheme")

    payload = decode_token(token)
    if payload.get("type") != "client":
        raise AuthenticationError(message="Not a client token")

    client_id = payload.get("sub")
    result = await db.execute(select(APIClient).where(APIClient.client_id == client_id))
    client = result.scalars().first()
    if not client or not client.is_active:
        raise AuthenticationError(message="Invalid or revoked client")

    client.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return client


CurrentApiClient = Annotated[APIClient, Depends(get_current_api_client)]


def require_client_scope(scope: str) -> Callable[..., APIClient]:
    """Build a dependency that requires the client to hold a given scope."""

    def dependency(client: CurrentApiClient) -> APIClient:
        if not client.permissions.get(scope):
            raise AuthorizationError(message=f"Client lacks '{scope}' permission")
        return client

    return dependency
