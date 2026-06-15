"""Contract tests for the API client management endpoints (US1)."""
from typing import Any

import pytest
from httpx import AsyncClient


def _base(hid: int) -> str:
    return f"/api/v1/households/{hid}/api-clients"


@pytest.mark.asyncio
async def test_create_list_revoke_lifecycle(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    headers = admin_household["auth_headers"]

    # Create -> 201 with the secret shown once
    resp = await async_client.post(
        _base(hid),
        headers=headers,
        json={"name": "Mealie", "permissions": {"read": True, "write": True}},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Mealie"
    assert body["client_id"]
    assert body["client_secret"]  # present exactly here
    assert body["permissions"] == {"read": True, "write": True, "delete": False}
    pk = body["id"]

    # List -> 200, never includes the secret
    resp = await async_client.get(_base(hid), headers=headers)
    assert resp.status_code == 200
    listed = resp.json()
    assert len(listed) == 1
    assert "client_secret" not in listed[0]
    assert listed[0]["client_id"] == body["client_id"]

    # Revoke -> 204
    resp = await async_client.delete(f"{_base(hid)}/{pk}", headers=headers)
    assert resp.status_code == 204

    # After revoke it is inactive
    resp = await async_client.get(_base(hid), headers=headers)
    assert resp.json()[0]["is_active"] is False


@pytest.mark.asyncio
async def test_create_requires_authentication(
    async_client: AsyncClient, admin_household: dict[str, Any]
) -> None:
    hid = admin_household["household"].id
    resp = await async_client.post(_base(hid), json={"name": "NoAuth"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_non_admin_member_is_forbidden(
    async_client: AsyncClient,
    admin_household: dict[str, Any],
    editor_headers: dict[str, str],
) -> None:
    """An editor (non-admin) member of the household may not manage clients."""
    hid = admin_household["household"].id
    resp = await async_client.post(_base(hid), headers=editor_headers, json={"name": "X"})
    assert resp.status_code == 403
