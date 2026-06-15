"""Contract tests for the Mealie connection + recipes endpoints (US4)."""
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from src.models.inventory_item import InventoryItem


def _conn_url(hid: int) -> str:
    return f"/api/v1/households/{hid}/mealie/connection"


@pytest.mark.asyncio
async def test_configure_and_get_connection_hides_key(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    headers = admin_household["auth_headers"]

    resp = await async_client.put(
        _conn_url(hid),
        headers=headers,
        json={"base_url": "https://mealie.example.com", "api_key": "secret-key"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["base_url"] == "https://mealie.example.com"
    assert "api_key" not in body and "api_key_enc" not in body

    resp = await async_client.get(_conn_url(hid), headers=headers)
    assert resp.status_code == 200
    assert "api_key" not in resp.json()


@pytest.mark.asyncio
async def test_get_connection_404_when_unconfigured(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    resp = await async_client.get(_conn_url(hid), headers=admin_household["auth_headers"])
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_non_admin_cannot_configure(
    async_client: AsyncClient, admin_household: dict[str, Any], editor_headers: dict[str, str]
) -> None:
    hid = admin_household["household"].id
    resp = await async_client.put(
        _conn_url(hid),
        headers=editor_headers,
        json={"base_url": "https://mealie.example.com", "api_key": "k"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_recipes_returns_makeability(
    async_client: AsyncClient,
    db_session: Any,
    admin_household: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    headers = admin_household["auth_headers"]
    db_session.add(
        InventoryItem(
            household_id=hh.id, added_by_user_id=user.id,
            name="Eggs", quantity=Decimal("6"), unit="count",
        )
    )
    await db_session.commit()

    # Configure a connection so the endpoint proceeds.
    await async_client.put(
        _conn_url(hh.id),
        headers=headers,
        json={"base_url": "https://mealie.example.com", "api_key": "k"},
    )

    # Stub the outbound Mealie fetch.
    async def fake_fetch(self: Any, limit: int = 30) -> list[dict]:
        return [
            {"recipe_id": "omelette", "name": "Omelette", "ingredients": ["eggs"]},
            {"recipe_id": "cake", "name": "Cake", "ingredients": ["eggs", "flour"]},
        ]

    monkeypatch.setattr(
        "src.services.mealie_client_service.MealieClientService.fetch_recipes_with_ingredients",
        fake_fetch,
    )

    resp = await async_client.get(f"/api/v1/households/{hh.id}/mealie/recipes", headers=headers)
    assert resp.status_code == 200, resp.text
    by_name = {r["name"]: r for r in resp.json()["recipes"]}
    assert by_name["Omelette"]["makeable"] is True
    assert by_name["Cake"]["makeable"] is False
    assert by_name["Cake"]["missing"] == ["flour"]


@pytest.mark.asyncio
async def test_recipes_404_without_connection(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    resp = await async_client.get(
        f"/api/v1/households/{hid}/mealie/recipes", headers=admin_household["auth_headers"]
    )
    assert resp.status_code == 404
