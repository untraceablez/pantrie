"""Contract tests for the client decrement endpoint (US3)."""
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from src.models.inventory_item import InventoryItem
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


async def _item(db: Any, household: Any, user: Any, qty: str = "5") -> int:
    item = InventoryItem(
        household_id=household.id, added_by_user_id=user.id,
        name="Sugar", quantity=Decimal(qty), unit="kg",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item.id


async def _token(async_client: AsyncClient, db: Any, household: Any, user: Any, **perms: bool) -> str:
    client, secret = await APIClientService(db).create_client(
        household_id=household.id,
        user_id=user.id,
        data=APIClientCreate(name="Mealie", permissions=Permissions(read=True, **perms)),
    )
    resp = await async_client.post(
        "/api/v1/clients/token", json={"client_id": client.client_id, "client_secret": secret}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_write_client_can_decrement(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item_id = await _item(db_session, hh, user, "5")
    token = await _token(async_client, db_session, hh, user, write=True)

    resp = await async_client.post(
        f"/api/v1/clients/inventory/{item_id}/decrement",
        json={"amount": "2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["item_id"] == item_id
    assert Decimal(body["remaining"]) == Decimal("3")
    assert body["clamped"] is False


@pytest.mark.asyncio
async def test_read_only_client_forbidden(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item_id = await _item(db_session, hh, user, "5")
    token = await _token(async_client, db_session, hh, user)  # read-only

    resp = await async_client.post(
        f"/api/v1/clients/inventory/{item_id}/decrement",
        json={"amount": "1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_decrement_requires_client_token(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item_id = await _item(db_session, hh, user, "5")
    resp = await async_client.post(
        f"/api/v1/clients/inventory/{item_id}/decrement", json={"amount": "1"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_decrement_item_in_other_household_not_found(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
) -> None:
    """A write client cannot reach an item outside its own household."""
    from src.models.household import Household
    from src.models.household_membership import HouseholdMembership, MemberRole

    hh, user = admin_household["household"], admin_household["user"]
    token = await _token(async_client, db_session, hh, user, write=True)

    other = Household(name="Other")
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        HouseholdMembership(user_id=user.id, household_id=other.id, role=MemberRole.ADMIN)
    )
    other_item_id = await _item(db_session, other, user, "5")

    resp = await async_client.post(
        f"/api/v1/clients/inventory/{other_item_id}/decrement",
        json={"amount": "1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
