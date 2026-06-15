"""Unit tests for API client authentication (US2)."""
from typing import Any

import pytest

from src.core.exceptions import AuthenticationError
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService
from src.services.client_auth_service import ClientAuthService


async def _make_client(db: Any, household: Any, user: Any, **perms: bool) -> tuple[str, str]:
    svc = APIClientService(db)
    client, secret = await svc.create_client(
        household_id=household.id,
        user_id=user.id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True, **perms)),
    )
    return client.client_id, secret


@pytest.mark.asyncio
async def test_authenticate_and_issue_token(db_session: Any, admin_household: dict[str, Any]) -> None:
    client_id, secret = await _make_client(
        db_session, admin_household["household"], admin_household["user"]
    )
    svc = ClientAuthService(db_session)
    token = await svc.issue_token(client_id, secret)
    assert token.access_token
    assert token.token_type == "bearer"
    assert token.expires_in > 0
    assert "read" in token.scopes


@pytest.mark.asyncio
async def test_authenticate_rejects_bad_secret(db_session: Any, admin_household: dict[str, Any]) -> None:
    client_id, _ = await _make_client(
        db_session, admin_household["household"], admin_household["user"]
    )
    svc = ClientAuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.issue_token(client_id, "wrong-secret")


@pytest.mark.asyncio
async def test_authenticate_rejects_revoked_client(db_session: Any, admin_household: dict[str, Any]) -> None:
    api_svc = APIClientService(db_session)
    client, secret = await api_svc.create_client(
        household_id=admin_household["household"].id,
        user_id=admin_household["user"].id,
        data=APIClientCreate(name="Mealie"),
    )
    await api_svc.revoke_client(
        admin_household["household"].id, admin_household["user"].id, client.id
    )
    svc = ClientAuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.issue_token(client.client_id, secret)
