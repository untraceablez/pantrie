"""HTTP-layer tests for the staple router (mounted under /api/v1/households)."""
from typing import Any

import pytest
from httpx import AsyncClient

from src.core.security import create_access_token
from src.models.user import User

API = "/api/v1"


async def _other_user(db, *, email="stranger@example.com", username="stranger") -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.commit()
    return user


def _bearer(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


@pytest.mark.asyncio
async def test_staples_crud(async_client: AsyncClient, admin_household: dict[str, Any]):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id

    resp = await async_client.post(
        f"{API}/households/{hid}/staples", json={"name": "Water"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    staple_id = resp.json()["id"]
    assert resp.json()["name"] == "water"  # normalized

    resp = await async_client.get(f"{API}/households/{hid}/staples", headers=headers)
    assert resp.status_code == 200 and resp.json()[0]["name"] == "water"

    resp = await async_client.delete(
        f"{API}/households/staples/{staple_id}", headers=headers
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_create_duplicate_staple_returns_409(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id
    await async_client.post(
        f"{API}/households/{hid}/staples", json={"name": "salt"}, headers=headers
    )
    resp = await async_client.post(
        f"{API}/households/{hid}/staples", json={"name": "Salt"}, headers=headers
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_staple_delete_not_found_returns_404(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.delete(
        f"{API}/households/staples/999999", headers=admin_household["auth_headers"]
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_staple_create_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _other_user(db_session)
    resp = await async_client.post(
        f"{API}/households/{hid}/staples", json={"name": "pepper"},
        headers=_bearer(stranger.id),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_staple_list_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _other_user(db_session)
    resp = await async_client.get(
        f"{API}/households/{hid}/staples", headers=_bearer(stranger.id)
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_staple_delete_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id
    resp = await async_client.post(
        f"{API}/households/{hid}/staples", json={"name": "flour"}, headers=headers
    )
    staple_id = resp.json()["id"]

    stranger = await _other_user(db_session)
    resp = await async_client.delete(
        f"{API}/households/staples/{staple_id}", headers=_bearer(stranger.id)
    )
    assert resp.status_code == 403
