"""Contract test for the shopping-list push endpoint (US5)."""
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_push_shopping_list_reports_results(
    async_client: AsyncClient,
    admin_household: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    hid = admin_household["household"].id
    headers = admin_household["auth_headers"]

    await async_client.put(
        f"/api/v1/households/{hid}/mealie/connection",
        headers=headers,
        json={"base_url": "https://mealie.example.com", "api_key": "k"},
    )

    async def fake_push(self: Any, item_names: list[str]) -> list[dict]:
        return [
            {"name": item_names[0], "added": True, "detail": None},
            {"name": item_names[1], "added": False, "detail": "Mealie returned 500"},
        ]

    monkeypatch.setattr(
        "src.services.mealie_client_service.MealieClientService.add_to_shopping_list",
        fake_push,
    )

    resp = await async_client.post(
        f"/api/v1/households/{hid}/mealie/shopping-list",
        headers=headers,
        json={"items": ["flour", "vanilla"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["requested"] == 2
    assert body["added"] == 1
    assert len(body["items"]) == 2


@pytest.mark.asyncio
async def test_push_shopping_list_404_without_connection(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    resp = await async_client.post(
        f"/api/v1/households/{hid}/mealie/shopping-list",
        headers=admin_household["auth_headers"],
        json={"items": ["flour"]},
    )
    assert resp.status_code == 404
