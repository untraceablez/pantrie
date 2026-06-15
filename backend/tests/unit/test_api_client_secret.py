"""Unit tests for API client secret generation and hashing (US1)."""
from typing import Any

import pytest

from src.core.security import verify_password
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


@pytest.mark.asyncio
async def test_create_returns_one_time_secret_and_stores_only_hash(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    service = APIClientService(db_session)
    client, secret = await service.create_client(
        household_id=admin_household["household"].id,
        user_id=admin_household["user"].id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True, write=True)),
    )

    # A plaintext secret is returned once...
    assert isinstance(secret, str) and len(secret) >= 16
    # ...and only a non-recoverable hash is stored.
    assert client.client_secret_hash != secret
    assert verify_password(secret, client.client_secret_hash)
    # client_id is public and distinct from the secret.
    assert client.client_id and client.client_id != secret
    assert client.permissions == {"read": True, "write": True, "delete": False}
    assert client.is_active is True


@pytest.mark.asyncio
async def test_each_client_gets_unique_credentials(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    service = APIClientService(db_session)
    c1, s1 = await service.create_client(
        household_id=admin_household["household"].id,
        user_id=admin_household["user"].id,
        data=APIClientCreate(name="A"),
    )
    c2, s2 = await service.create_client(
        household_id=admin_household["household"].id,
        user_id=admin_household["user"].id,
        data=APIClientCreate(name="B"),
    )
    assert c1.client_id != c2.client_id
    assert s1 != s2
