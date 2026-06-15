"""Contract tests for the client gateway: token + availability (US2)."""
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from src.models.inventory_item import InventoryItem
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


async def _client_creds(db: Any, household: Any, user: Any, **perms: bool) -> tuple[str, str]:
    svc = APIClientService(db)
    client, secret = await svc.create_client(
        household_id=household.id,
        user_id=user.id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True, **perms)),
    )
    return client.client_id, secret


async def _token(async_client: AsyncClient, client_id: str, secret: str) -> str:
    resp = await async_client.post(
        "/api/v1/clients/token", json={"client_id": client_id, "client_secret": secret}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_token_then_single_availability(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    db_session.add(
        InventoryItem(
            household_id=hh.id, added_by_user_id=user.id, name="Eggs",
            quantity=Decimal("12"), unit="count",
        )
    )
    await db_session.commit()
    cid, secret = await _client_creds(db_session, hh, user)

    token = await _token(async_client, cid, secret)
    resp = await async_client.get(
        "/api/v1/clients/inventory/availability",
        params={"name": "eggs"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["in_stock"] is True
    assert body["matched_name"] == "Eggs"


@pytest.mark.asyncio
async def test_bulk_availability(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    db_session.add(
        InventoryItem(
            household_id=hh.id, added_by_user_id=user.id, name="Butter",
            quantity=Decimal("2"), unit="count",
        )
    )
    await db_session.commit()
    cid, secret = await _client_creds(db_session, hh, user)
    token = await _token(async_client, cid, secret)

    resp = await async_client.post(
        "/api/v1/clients/inventory/availability",
        json={"ingredients": [{"name": "butter"}, {"name": "vanilla"}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()["results"]
    assert len(results) == 2
    by_query = {r["query"]: r["in_stock"] for r in results}
    assert by_query["butter"] is True
    assert by_query["vanilla"] is False


@pytest.mark.asyncio
async def test_invalid_credentials_rejected(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    resp = await async_client.post(
        "/api/v1/clients/token",
        json={"client_id": "nope", "client_secret": "nope"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_availability_requires_client_token(async_client: AsyncClient) -> None:
    resp = await async_client.get(
        "/api/v1/clients/inventory/availability", params={"name": "x"}
    )
    assert resp.status_code == 401
