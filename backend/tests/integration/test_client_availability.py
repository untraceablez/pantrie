"""Integration test: full client journey token -> availability (US2)."""
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from src.models.inventory_item import InventoryItem
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


@pytest.mark.asyncio
async def test_token_then_single_and_bulk_availability(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    for name, qty, unit in [("Flour", "2", "kg"), ("Eggs", "12", "count")]:
        db_session.add(
            InventoryItem(
                household_id=hh.id, added_by_user_id=user.id,
                name=name, quantity=Decimal(qty), unit=unit,
            )
        )
    await db_session.commit()

    # Admin mints credentials.
    client, secret = await APIClientService(db_session).create_client(
        household_id=hh.id,
        user_id=user.id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True)),
    )

    # Client exchanges them for a token (request 1).
    resp = await async_client.post(
        "/api/v1/clients/token",
        json={"client_id": client.client_id, "client_secret": secret},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Single availability with sufficiency (request 2).
    resp = await async_client.get(
        "/api/v1/clients/inventory/availability",
        params={"name": "flour", "amount": "1", "unit": "kg"},
        headers=headers,
    )
    assert resp.status_code == 200
    single = resp.json()
    assert single["in_stock"] is True
    assert single["sufficiency_determinable"] is True
    assert single["sufficient"] is True

    # Bulk availability.
    resp = await async_client.post(
        "/api/v1/clients/inventory/availability",
        json={"ingredients": [{"name": "eggs"}, {"name": "saffron"}]},
        headers=headers,
    )
    assert resp.status_code == 200
    by_query = {r["query"]: r for r in resp.json()["results"]}
    assert by_query["eggs"]["in_stock"] is True
    assert by_query["saffron"]["in_stock"] is False
