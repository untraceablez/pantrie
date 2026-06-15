"""Integration test: token -> decrement -> availability reflects new quantity (US3)."""
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from src.models.inventory_item import InventoryItem
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


@pytest.mark.asyncio
async def test_decrement_then_availability_reflects(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item = InventoryItem(
        household_id=hh.id, added_by_user_id=user.id,
        name="Flour", quantity=Decimal("4"), unit="kg",
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)

    client, secret = await APIClientService(db_session).create_client(
        household_id=hh.id, user_id=user.id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True, write=True)),
    )
    resp = await async_client.post(
        "/api/v1/clients/token",
        json={"client_id": client.client_id, "client_secret": secret},
    )
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # Decrement 1.5 kg.
    resp = await async_client.post(
        f"/api/v1/clients/inventory/{item.id}/decrement",
        json={"amount": "1.5"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["remaining"]) == Decimal("2.5")

    # Availability now reports the reduced quantity.
    resp = await async_client.get(
        "/api/v1/clients/inventory/availability",
        params={"name": "flour"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert Decimal(resp.json()["quantity"]) == Decimal("2.5")
