"""Tests for the scheduled-notification inventory queries.

``get_expiring_items`` / ``get_low_stock_items`` are the read side of the daily
digest job: no membership check, an outer join to ``locations`` so the email
templates can name a location, and deterministic ordering.
"""
from datetime import date, timedelta
from decimal import Decimal

from src.models.household import Household
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.services.inventory_service import InventoryService


async def _make_location(db_session, household_id, name):
    location = Location(household_id=household_id, name=name)
    db_session.add(location)
    await db_session.flush()
    return location


async def _make_item(db_session, *, household_id, user_id, name, **kwargs):
    item = InventoryItem(
        household_id=household_id,
        added_by_user_id=user_id,
        name=name,
        quantity=kwargs.pop("quantity", Decimal("5")),
        **kwargs,
    )
    db_session.add(item)
    await db_session.flush()
    return item


async def test_get_expiring_items_returns_expired_and_soon(db_session, admin_household):
    household = admin_household["household"]
    user = admin_household["user"]
    today = date.today()

    fridge = await _make_location(db_session, household.id, "Fridge")
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Expired Milk",
        expiration_date=today - timedelta(days=3), location_id=fridge.id,
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Soon Yogurt",
        expiration_date=today + timedelta(days=2),
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Later Cheese",
        expiration_date=today + timedelta(days=30),
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="No Date Rice",
    )
    await db_session.commit()

    items = await InventoryService(db_session).get_expiring_items(household.id, within_days=7)

    assert [item.name for item in items] == ["Expired Milk", "Soon Yogurt"]
    # The joined location is attached for the notification templates.
    assert items[0].location.name == "Fridge"
    assert items[1].location is None


async def test_get_expiring_items_window_is_configurable(db_session, admin_household):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Later Cheese",
        expiration_date=date.today() + timedelta(days=20),
    )
    await db_session.commit()

    service = InventoryService(db_session)
    assert await service.get_expiring_items(household.id, within_days=7) == []
    assert [i.name for i in await service.get_expiring_items(household.id, within_days=30)] == [
        "Later Cheese"
    ]


async def test_get_expiring_items_scoped_to_household(db_session, admin_household):
    household = admin_household["household"]
    user = admin_household["user"]
    other = Household(name="Other Household")
    db_session.add(other)
    await db_session.flush()

    await _make_item(
        db_session, household_id=other.id, user_id=user.id, name="Someone Elses Milk",
        expiration_date=date.today(),
    )
    await db_session.commit()

    assert await InventoryService(db_session).get_expiring_items(household.id) == []


async def test_get_low_stock_items_uses_threshold_and_orders_by_quantity(
    db_session, admin_household
):
    household = admin_household["household"]
    user = admin_household["user"]
    pantry = await _make_location(db_session, household.id, "Pantry")

    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Flour",
        quantity=Decimal("1.0"), location_id=pantry.id,
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Salt",
        quantity=Decimal("0.25"),
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Sugar",
        quantity=Decimal("4"),
    )
    await db_session.commit()

    service = InventoryService(db_session)
    items = await service.get_low_stock_items(household.id, threshold=1.0)

    assert [item.name for item in items] == ["Salt", "Flour"]
    assert items[1].location.name == "Pantry"

    # A higher threshold pulls in more items.
    assert [i.name for i in await service.get_low_stock_items(household.id, threshold=4)] == [
        "Salt",
        "Flour",
        "Sugar",
    ]


async def test_get_low_stock_items_scoped_to_household(db_session, admin_household):
    household = admin_household["household"]
    user = admin_household["user"]
    other = Household(name="Other Household")
    db_session.add(other)
    await db_session.flush()

    await _make_item(
        db_session, household_id=other.id, user_id=user.id, name="Their Flour",
        quantity=Decimal("0"),
    )
    await db_session.commit()

    assert await InventoryService(db_session).get_low_stock_items(household.id) == []
