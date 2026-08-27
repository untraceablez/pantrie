"""Endpoint tests for the allergen checking routes.

The matching itself is unit-tested in ``tests/unit/test_allergen_checker.py``;
these cover routing (the literal ``check`` / ``inventory-matches`` segments not
being swallowed by ``/{household_id}/allergens``), payload shape, and auth.
"""
from decimal import Decimal
from typing import Any

from httpx import AsyncClient

from src.core.security import create_access_token
from src.models.household_allergen import HouseholdAllergen
from src.models.inventory_item import InventoryItem
from src.models.user import User

API = "/api/v1"


def _bearer(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


async def _stranger(db: Any) -> User:
    user = User(
        email="stranger@example.com", username="stranger",
        hashed_password="x", is_active=True,
    )
    db.add(user)
    await db.commit()
    return user


async def test_check_endpoint_reports_matches_per_text(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    db_session.add(HouseholdAllergen(household_id=hid, name="milk"))
    await db_session.commit()

    resp = await async_client.post(
        f"{API}/households/{hid}/allergens/check",
        json={"texts": ["Water, Whole Milk", "Rice, Salt"]},
        headers=admin_household["auth_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["results"] == [
        {"text": "Water, Whole Milk", "allergens": ["milk"]},
        {"text": "Rice, Salt", "allergens": []},
    ]


async def test_check_endpoint_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _stranger(db_session)
    resp = await async_client.post(
        f"{API}/households/{hid}/allergens/check",
        json={"texts": ["milk"]},
        headers=_bearer(stranger.id),
    )
    assert resp.status_code == 403


async def test_inventory_matches_endpoint_flags_stored_items(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hh, user = admin_household["household"], admin_household["user"]
    db_session.add(HouseholdAllergen(household_id=hh.id, name="milk"))
    flagged = InventoryItem(
        household_id=hh.id, added_by_user_id=user.id, name="Cookies",
        quantity=Decimal("1"), unit="box",
        ingredients="Wheat flour, whole milk, sugar",
    )
    db_session.add(flagged)
    db_session.add(
        InventoryItem(
            household_id=hh.id, added_by_user_id=user.id, name="Rice",
            quantity=Decimal("1"), unit="bag", ingredients="Rice",
        )
    )
    await db_session.commit()

    resp = await async_client.get(
        f"{API}/households/{hh.id}/allergens/inventory-matches",
        headers=admin_household["auth_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "matches": [
            {"item_id": flagged.id, "name": "Cookies", "allergens": ["milk"]}
        ]
    }


async def test_inventory_matches_endpoint_forbidden_for_non_member(
    async_client: AsyncClient, db_session: Any, admin_household: dict[str, Any]
):
    hid = admin_household["household"].id
    stranger = await _stranger(db_session)
    resp = await async_client.get(
        f"{API}/households/{hid}/allergens/inventory-matches",
        headers=_bearer(stranger.id),
    )
    assert resp.status_code == 403


async def test_listing_allergens_still_works_alongside_the_new_routes(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    """The literal sub-paths must not shadow the existing CRUD routes."""
    hid = admin_household["household"].id
    headers = admin_household["auth_headers"]

    resp = await async_client.post(
        f"{API}/households/{hid}/allergens", json={"name": "Soy"}, headers=headers
    )
    assert resp.status_code == 201, resp.text

    resp = await async_client.get(f"{API}/households/{hid}/allergens", headers=headers)
    assert resp.status_code == 200
    assert [a["name"] for a in resp.json()] == ["soy"]
