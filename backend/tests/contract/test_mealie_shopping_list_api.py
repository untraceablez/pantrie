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

    async def fake_push(self: Any, item_names: list[str], list_id: str | None = None) -> list[dict]:
        return [
            {"name": item_names[0], "added": True, "updated": True, "detail": None},
            {"name": item_names[1], "added": False, "updated": False, "detail": "Mealie returned 500"},
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
    assert body["updated"] == 1
    assert len(body["items"]) == 2


@pytest.mark.asyncio
async def test_list_shopping_lists_endpoint(
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

    async def fake_lists(self: Any) -> list[dict]:
        return [{"id": "1", "name": "Weekly"}, {"id": "2", "name": "Costco"}]

    monkeypatch.setattr(
        "src.services.mealie_client_service.MealieClientService.list_shopping_lists",
        fake_lists,
    )

    resp = await async_client.get(
        f"/api/v1/households/{hid}/mealie/shopping-lists", headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert [li["name"] for li in resp.json()["lists"]] == ["Weekly", "Costco"]


@pytest.mark.asyncio
async def test_push_creates_a_new_list_when_name_given(
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

    created: dict[str, Any] = {}

    async def fake_create(self: Any, name: str) -> dict:
        created["name"] = name
        return {"id": "new-7", "name": name}

    async def fake_push(self: Any, item_names: list[str], list_id: str | None = None) -> list[dict]:
        created["target"] = list_id
        return [{"name": n, "added": True, "updated": False, "detail": None} for n in item_names]

    monkeypatch.setattr(
        "src.services.mealie_client_service.MealieClientService.create_shopping_list", fake_create
    )
    monkeypatch.setattr(
        "src.services.mealie_client_service.MealieClientService.add_to_shopping_list", fake_push
    )

    resp = await async_client.post(
        f"/api/v1/households/{hid}/mealie/shopping-list",
        headers=headers,
        json={"items": ["flour"], "create_list_name": "Chana Masala - 23-06-26"},
    )
    assert resp.status_code == 200, resp.text
    assert created["name"] == "Chana Masala - 23-06-26"
    assert created["target"] == "new-7"  # pushed to the newly created list


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
