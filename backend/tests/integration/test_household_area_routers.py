"""Endpoint tests for the household-area routers: households, locations,
inventory, allergens. The underlying services are unit-tested elsewhere; these
exercise the HTTP layer (routing, status codes, auth dep, exception handler).

Uses the ``async_client`` + ``admin_household`` fixtures; the admin's bearer
token is in ``admin_household["auth_headers"]``.
"""
from typing import Any

import pytest
from httpx import AsyncClient

from src.core.security import create_access_token
from src.models.user import User

API = "/api/v1"


async def _other_user(db, *, email="other@example.com", username="other") -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.commit()
    return user


def _bearer(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


# =========================================================================== #
# households router
# =========================================================================== #
async def test_households_crud_and_members_flow(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]

    # create
    resp = await async_client.post(
        f"{API}/households", json={"name": "New House"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    new_id = resp.json()["id"]

    # list
    resp = await async_client.get(f"{API}/households", headers=headers)
    assert resp.status_code == 200
    assert any(h["id"] == new_id for h in resp.json())

    # get
    resp = await async_client.get(f"{API}/households/{new_id}", headers=headers)
    assert resp.status_code == 200 and resp.json()["user_role"] == "admin"

    # update
    resp = await async_client.put(
        f"{API}/households/{new_id}", json={"name": "Renamed"}, headers=headers
    )
    assert resp.status_code == 200 and resp.json()["name"] == "Renamed"

    # members: add a user, list, patch role, remove
    member = await _other_user(db_session)
    resp = await async_client.post(
        f"{API}/households/{new_id}/members",
        json={"email": member.email, "role": "viewer"}, headers=headers,
    )
    assert resp.status_code == 201, resp.text
    membership_id = resp.json()["id"]

    resp = await async_client.get(f"{API}/households/{new_id}/members", headers=headers)
    assert resp.status_code == 200 and len(resp.json()) == 2

    resp = await async_client.patch(
        f"{API}/households/{new_id}/members/{membership_id}",
        json={"role": "editor"}, headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["role"] == "editor"

    resp = await async_client.delete(
        f"{API}/households/{new_id}/members/{membership_id}", headers=headers
    )
    assert resp.status_code == 204

    # delete household
    resp = await async_client.delete(f"{API}/households/{new_id}", headers=headers)
    assert resp.status_code == 204


async def test_get_household_not_found_returns_404(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.get(
        f"{API}/households/999999", headers=admin_household["auth_headers"]
    )
    assert resp.status_code == 404


async def test_household_endpoint_requires_auth(async_client: AsyncClient):
    resp = await async_client.get(f"{API}/households")
    assert resp.status_code in (401, 403)


# =========================================================================== #
# locations router
# =========================================================================== #
async def test_locations_crud(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id

    resp = await async_client.post(
        f"{API}/locations", json={"household_id": hid, "name": "Pantry"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    loc_id = resp.json()["id"]

    resp = await async_client.get(f"{API}/locations/households/{hid}", headers=headers)
    assert resp.status_code == 200 and len(resp.json()) == 1

    resp = await async_client.get(f"{API}/locations/{loc_id}", headers=headers)
    assert resp.status_code == 200 and resp.json()["name"] == "Pantry"

    resp = await async_client.put(
        f"{API}/locations/{loc_id}", json={"name": "Cupboard"}, headers=headers
    )
    assert resp.status_code == 200 and resp.json()["name"] == "Cupboard"

    resp = await async_client.delete(f"{API}/locations/{loc_id}", headers=headers)
    assert resp.status_code == 204

    resp = await async_client.get(f"{API}/locations/{loc_id}", headers=headers)
    assert resp.status_code == 404


# =========================================================================== #
# inventory router
# =========================================================================== #
async def test_inventory_crud_and_list(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id

    resp = await async_client.post(
        f"{API}/inventory",
        json={"household_id": hid, "name": "Milk", "quantity": 2}, headers=headers,
    )
    assert resp.status_code == 201, resp.text
    item_id = resp.json()["id"]

    # paginated list
    resp = await async_client.get(
        f"{API}/inventory/households/{hid}/list", params={"search": "milk"}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1 and body["total_pages"] == 1

    # full household list
    resp = await async_client.get(f"{API}/inventory/households/{hid}", headers=headers)
    assert resp.status_code == 200 and len(resp.json()) == 1

    resp = await async_client.get(f"{API}/inventory/{item_id}", headers=headers)
    assert resp.status_code == 200 and resp.json()["name"] == "Milk"

    resp = await async_client.put(
        f"{API}/inventory/{item_id}", json={"name": "Whole Milk"}, headers=headers
    )
    assert resp.status_code == 200 and resp.json()["name"] == "Whole Milk"

    resp = await async_client.delete(f"{API}/inventory/{item_id}", headers=headers)
    assert resp.status_code == 204


async def test_inventory_create_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _other_user(db_session, email="stranger@example.com", username="stranger")
    resp = await async_client.post(
        f"{API}/inventory",
        json={"household_id": hid, "name": "X", "quantity": 1},
        headers=_bearer(stranger.id),
    )
    assert resp.status_code == 403


# =========================================================================== #
# allergen router (mounted under /api/v1/households)
# =========================================================================== #
async def test_allergens_crud(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id

    resp = await async_client.post(
        f"{API}/households/{hid}/allergens", json={"name": "Peanuts"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    allergen_id = resp.json()["id"]

    resp = await async_client.get(f"{API}/households/{hid}/allergens", headers=headers)
    assert resp.status_code == 200 and resp.json()[0]["name"] == "peanuts"

    resp = await async_client.delete(
        f"{API}/households/allergens/{allergen_id}", headers=headers
    )
    assert resp.status_code == 204


async def test_allergen_delete_not_found_returns_404(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.delete(
        f"{API}/households/allergens/999999", headers=admin_household["auth_headers"]
    )
    assert resp.status_code == 404


async def test_allergen_create_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _other_user(db_session, email="stranger@example.com", username="stranger")
    resp = await async_client.post(
        f"{API}/households/{hid}/allergens", json={"name": "soy"},
        headers=_bearer(stranger.id),
    )
    assert resp.status_code == 403


async def test_allergen_list_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _other_user(db_session, email="stranger@example.com", username="stranger")
    resp = await async_client.get(
        f"{API}/households/{hid}/allergens", headers=_bearer(stranger.id)
    )
    assert resp.status_code == 403


async def test_allergen_delete_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    hid = admin_household["household"].id
    resp = await async_client.post(
        f"{API}/households/{hid}/allergens", json={"name": "wheat"}, headers=headers
    )
    allergen_id = resp.json()["id"]

    stranger = await _other_user(db_session, email="stranger@example.com", username="stranger")
    resp = await async_client.delete(
        f"{API}/households/allergens/{allergen_id}", headers=_bearer(stranger.id)
    )
    assert resp.status_code == 403
