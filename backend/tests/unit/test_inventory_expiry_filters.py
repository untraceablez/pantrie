"""Tests for the dashboard deep-link filters on ``InventoryService.list_inventory``.

Kept in their own module so the existing list/search/sort suite stays untouched.
These filters are relative to ``date.today()``, so fixtures are built with
offsets from today rather than fixed dates.
"""
from datetime import date, timedelta
from decimal import Decimal

from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.inventory_item import InventoryItem
from src.models.user import User
from src.services.inventory_service import InventoryService

TODAY = date.today()


async def _setup_household(db, *, role=MemberRole.EDITOR):
    user = User(
        email="filters@example.com",
        username="filters",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    household = Household(name="House", description=None)
    db.add(household)
    await db.flush()
    db.add(HouseholdMembership(user_id=user.id, household_id=household.id, role=role))
    await db.flush()
    return user, household


async def _make_item(db, *, household_id, user_id, name, **kwargs) -> InventoryItem:
    item = InventoryItem(
        household_id=household_id,
        added_by_user_id=user_id,
        name=name,
        quantity=kwargs.pop("quantity", Decimal("5")),
        **kwargs,
    )
    db.add(item)
    await db.flush()
    return item


async def _seed(db):
    """Seed one household with a spread of expiry dates and quantities."""
    user, household = await _setup_household(db)
    common = {"household_id": household.id, "user_id": user.id}
    await _make_item(
        db, name="Expired", expiration_date=TODAY - timedelta(days=3), **common
    )
    await _make_item(db, name="Due Today", expiration_date=TODAY, **common)
    await _make_item(
        db, name="Due In Three", expiration_date=TODAY + timedelta(days=3), **common
    )
    await _make_item(
        db, name="Due In Thirty", expiration_date=TODAY + timedelta(days=30), **common
    )
    await _make_item(db, name="No Expiry", quantity=Decimal("0.5"), **common)
    await db.commit()
    return user, household


async def test_expiring_within_days_excludes_expired_and_far_future(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, expiring_within_days=7
    )

    assert total == 2
    assert sorted(item.name for item in items) == ["Due In Three", "Due Today"]


async def test_expiring_within_days_zero_matches_only_today(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, expiring_within_days=0
    )

    assert total == 1
    assert items[0].name == "Due Today"


async def test_expired_filter_returns_only_past_dates(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, expired=True
    )

    assert total == 1
    assert items[0].name == "Expired"


async def test_expired_and_expiring_are_combined_with_or(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, expired=True, expiring_within_days=7
    )

    assert total == 3
    assert sorted(item.name for item in items) == [
        "Due In Three",
        "Due Today",
        "Expired",
    ]


async def test_low_stock_threshold_filters_by_quantity(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, low_stock_threshold=Decimal("1")
    )

    assert total == 1
    assert items[0].name == "No Expiry"


async def test_filters_are_omitted_by_default(db_session):
    user, household = await _seed(db_session)

    _, total = await InventoryService(db_session).list_inventory(household.id, user.id)

    assert total == 5


async def test_expiry_and_search_filters_compose(db_session):
    user, household = await _seed(db_session)

    items, total = await InventoryService(db_session).list_inventory(
        household.id, user.id, expiring_within_days=7, search="today"
    )

    assert total == 1
    assert items[0].name == "Due Today"
