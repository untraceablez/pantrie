"""Unit tests for client scope enforcement and user/client token separation (US2)."""
from typing import Any

import pytest
from fastapi import HTTPException

from src.core.deps import get_current_api_client, require_client_scope
from src.core.exceptions import AuthenticationError, AuthorizationError
from src.core.security import create_access_token, create_client_token
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


async def _client(db: Any, household: Any, user: Any, **perms: bool) -> Any:
    svc = APIClientService(db)
    client, _ = await svc.create_client(
        household_id=household.id,
        user_id=user.id,
        data=APIClientCreate(name="C", permissions=Permissions(read=True, **perms)),
    )
    return client


@pytest.mark.asyncio
async def test_user_token_rejected_by_client_dependency(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    """A normal user access token must not authenticate as an API client."""
    user_token = create_access_token({"sub": str(admin_household["user"].id)})
    with pytest.raises((AuthenticationError, HTTPException)):
        await get_current_api_client(authorization=f"Bearer {user_token}", db=db_session)


@pytest.mark.asyncio
async def test_client_token_loads_client_and_updates_last_used(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    client = await _client(db_session, admin_household["household"], admin_household["user"])
    token, _ = create_client_token(client.client_id, client.household_id, ["read"])
    loaded = await get_current_api_client(authorization=f"Bearer {token}", db=db_session)
    assert loaded.id == client.id
    assert loaded.last_used_at is not None


@pytest.mark.asyncio
async def test_require_scope_allows_and_denies(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    read_only = await _client(db_session, admin_household["household"], admin_household["user"])
    token, _ = create_client_token(read_only.client_id, read_only.household_id, ["read"])
    client = await get_current_api_client(authorization=f"Bearer {token}", db=db_session)

    # read guard passes
    assert require_client_scope("read")(client=client) is client
    # write guard denies a read-only client
    with pytest.raises(AuthorizationError):
        require_client_scope("write")(client=client)
