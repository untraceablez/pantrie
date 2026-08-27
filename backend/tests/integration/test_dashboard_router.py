"""Endpoint tests for the dashboard router and the new inventory list filters.

The aggregation itself is unit-tested in ``tests/unit/test_dashboard_service.py``;
these exercise the HTTP layer (routing, query-param validation, auth dep, the
exception handler) and the query params wired into the inventory list route.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import create_access_token
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.models.user import User

API = "/api/v1"
TODAY = date.today()


async def _seed_items(db: AsyncSession, household_id: int, user_id: int) -> Location:
    location = Location(household_id=household_id, name="Pantry", icon="🥫")
    db.add(location)
    await db.flush()

    rows = [
        ("Expired Yoghurt", TODAY - timedelta(days=2), Decimal("2"), location.id),
        ("Milk", TODAY + timedelta(days=2), Decimal("2"), location.id),
        ("Rice", TODAY + timedelta(days=90), Decimal("4"), None),
        ("Salt", None, Decimal("0.5"), None),
    ]
    for name, expiration, quantity, location_id in rows:
        db.add(
            InventoryItem(
                household_id=household_id,
                added_by_user_id=user_id,
                name=name,
                quantity=quantity,
                expiration_date=expiration,
                location_id=location_id,
            )
        )
    await db.commit()
    return location


async def test_dashboard_summary_returns_counts_and_breakdowns(
    async_client: AsyncClient, db_session: AsyncSession, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    household = admin_household["household"]
    await _seed_items(db_session, household.id, admin_household["user"].id)

    resp = await async_client.get(
        f"{API}/dashboard/households/{household.id}/summary", headers=headers
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["household_id"] == household.id
    assert body["generated_on"] == TODAY.isoformat()
    assert body["expiring_within_days"] == 7
    # Decimals serialise as JSON strings; the frontend types depend on it.
    assert body["low_stock_threshold"] == "1"
    assert body["counts"] == {
        "total_items": 4,
        "expired": 1,
        "expiring_soon": 1,
        "low_stock": 1,
        "no_expiration_date": 1,
    }
    assert [(b["name"], b["item_count"]) for b in body["by_location"]] == [
        ("Pantry", 2),
        ("Unassigned", 2),
    ]
    assert [(b["name"], b["item_count"]) for b in body["by_category"]] == [
        ("Unassigned", 4)
    ]
    assert len(body["recently_added"]) == 4


async def test_dashboard_summary_accepts_query_overrides(
    async_client: AsyncClient, db_session: AsyncSession, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    household = admin_household["household"]
    await _seed_items(db_session, household.id, admin_household["user"].id)

    resp = await async_client.get(
        f"{API}/dashboard/households/{household.id}/summary",
        params={
            "expiring_within_days": 120,
            "low_stock_threshold": "4",
            "recent_limit": 2,
        },
        headers=headers,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["counts"]["expiring_soon"] == 2
    # every seeded quantity (2, 2, 4, 0.5) is at or below the threshold
    assert body["counts"]["low_stock"] == 4
    assert len(body["recently_added"]) == 2


async def test_dashboard_summary_rejects_invalid_horizon(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.get(
        f"{API}/dashboard/households/{admin_household['household'].id}/summary",
        params={"expiring_within_days": -1},
        headers=admin_household["auth_headers"],
    )
    assert resp.status_code == 422


async def test_dashboard_summary_requires_authentication(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.get(
        f"{API}/dashboard/households/{admin_household['household'].id}/summary"
    )
    assert resp.status_code == 401


async def test_dashboard_summary_forbidden_for_non_member(
    async_client: AsyncClient, db_session: AsyncSession, admin_household: dict[str, Any]
):
    stranger = User(
        email="stranger@example.com",
        username="stranger",
        hashed_password="x",
        is_active=True,
    )
    db_session.add(stranger)
    await db_session.commit()

    resp = await async_client.get(
        f"{API}/dashboard/households/{admin_household['household'].id}/summary",
        headers={
            "Authorization": f"Bearer {create_access_token({'sub': str(stranger.id)})}"
        },
    )

    assert resp.status_code == 403
    assert resp.json()["error"] == "You are not a member of this household"


async def test_inventory_list_accepts_dashboard_filters(
    async_client: AsyncClient, db_session: AsyncSession, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]
    household = admin_household["household"]
    await _seed_items(db_session, household.id, admin_household["user"].id)
    url = f"{API}/inventory/households/{household.id}/list"

    resp = await async_client.get(url, params={"expired": True}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert [item["name"] for item in resp.json()["items"]] == ["Expired Yoghurt"]

    resp = await async_client.get(
        url, params={"expiring_within_days": 7}, headers=headers
    )
    assert resp.status_code == 200
    assert [item["name"] for item in resp.json()["items"]] == ["Milk"]

    resp = await async_client.get(
        url, params={"low_stock_threshold": "1"}, headers=headers
    )
    assert resp.status_code == 200
    assert [item["name"] for item in resp.json()["items"]] == ["Salt"]

    resp = await async_client.get(url, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 4


async def test_inventory_list_rejects_out_of_range_horizon(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    resp = await async_client.get(
        f"{API}/inventory/households/{admin_household['household'].id}/list",
        params={"expiring_within_days": 400},
        headers=admin_household["auth_headers"],
    )
    assert resp.status_code == 422
