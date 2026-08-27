"""Tests for DashboardService (aggregation queries + role gating).

DB-backed via the real ``db_session``. Every count is asserted against a fixed
reference date so the suite never depends on the wall clock.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from src.core.exceptions import AuthorizationError
from src.models.category import Category
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.models.user import User
from src.services.dashboard_service import (
    DEFAULT_EXPIRING_WITHIN_DAYS,
    DEFAULT_LOW_STOCK_THRESHOLD,
    DEFAULT_RECENT_LIMIT,
    UNASSIGNED_LABEL,
    DashboardService,
)

TODAY = date(2026, 6, 15)


async def _make_user(db, *, email, username) -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _setup_household(db, *, role=MemberRole.VIEWER, suffix=""):
    """Create a household with one member at ``role``. Returns (user, household)."""
    user = await _make_user(
        db, email=f"{role.value}{suffix}@example.com", username=f"{role.value}{suffix}"
    )
    household = Household(name=f"House{suffix}", description=None)
    db.add(household)
    await db.flush()
    db.add(HouseholdMembership(user_id=user.id, household_id=household.id, role=role))
    await db.flush()
    return user, household


async def _make_item(db, *, household_id, user_id, name="Milk", **kwargs) -> InventoryItem:
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


async def _make_location(db, *, household_id, name, icon="📍") -> Location:
    location = Location(household_id=household_id, name=name, icon=icon)
    db.add(location)
    await db.flush()
    return location


async def _make_category(db, *, name, icon="🥛") -> Category:
    category = Category(name=name, icon=icon)
    db.add(category)
    await db.flush()
    return category


# --------------------------------------------------------------------------- #
# authorization
# --------------------------------------------------------------------------- #
async def test_get_summary_requires_membership(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    stranger = await _make_user(db_session, email="nobody@example.com", username="nobody")
    await db_session.commit()

    svc = DashboardService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.get_summary(household.id, stranger.id, today=TODAY)


async def test_get_summary_allows_viewer(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )
    assert summary.household_id == household.id
    assert summary.generated_on == TODAY


# --------------------------------------------------------------------------- #
# counts
# --------------------------------------------------------------------------- #
async def test_get_summary_counts_expired_expiring_and_low_stock(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    common = {"household_id": household.id, "user_id": user.id}

    # expired
    await _make_item(
        db_session, name="Old Yoghurt", expiration_date=TODAY - timedelta(days=1), **common
    )
    await _make_item(
        db_session, name="Old Cream", expiration_date=TODAY - timedelta(days=30), **common
    )
    # expiring within the default 7-day horizon (today counts as expiring soon)
    await _make_item(db_session, name="Milk", expiration_date=TODAY, **common)
    await _make_item(
        db_session, name="Bread", expiration_date=TODAY + timedelta(days=7), **common
    )
    # beyond the horizon
    await _make_item(
        db_session, name="Rice", expiration_date=TODAY + timedelta(days=8), **common
    )
    # no expiration date, and low stock
    await _make_item(db_session, name="Salt", quantity=Decimal("0.5"), **common)
    await _make_item(db_session, name="Sugar", quantity=Decimal("1"), **common)
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )

    assert summary.counts.total_items == 7
    assert summary.counts.expired == 2
    assert summary.counts.expiring_soon == 2
    assert summary.counts.no_expiration_date == 2
    # quantity <= 1: Salt (0.5) and Sugar (1)
    assert summary.counts.low_stock == 2
    assert summary.expiring_within_days == DEFAULT_EXPIRING_WITHIN_DAYS
    assert summary.low_stock_threshold == DEFAULT_LOW_STOCK_THRESHOLD


async def test_get_summary_honours_custom_horizon_and_threshold(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    common = {"household_id": household.id, "user_id": user.id}

    await _make_item(
        db_session,
        name="Rice",
        expiration_date=TODAY + timedelta(days=20),
        quantity=Decimal("3"),
        **common,
    )
    await _make_item(db_session, name="Flour", quantity=Decimal("2"), **common)
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id,
        user.id,
        expiring_within_days=30,
        low_stock_threshold=Decimal("3"),
        today=TODAY,
    )

    assert summary.counts.expiring_soon == 1
    assert summary.counts.low_stock == 2
    assert summary.expiring_within_days == 30
    assert summary.low_stock_threshold == Decimal("3")


async def test_get_summary_is_scoped_to_the_household(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    other_user, other_household = await _setup_household(
        db_session, role=MemberRole.EDITOR, suffix="2"
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Mine"
    )
    await _make_item(
        db_session,
        household_id=other_household.id,
        user_id=other_user.id,
        name="Theirs",
    )
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )
    assert summary.counts.total_items == 1
    assert [item.name for item in summary.recently_added] == ["Mine"]


async def test_get_summary_empty_household(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )

    assert summary.counts.total_items == 0
    assert summary.counts.expired == 0
    assert summary.counts.expiring_soon == 0
    assert summary.counts.low_stock == 0
    assert summary.counts.no_expiration_date == 0
    assert summary.by_location == []
    assert summary.by_category == []
    assert summary.recently_added == []


# --------------------------------------------------------------------------- #
# breakdowns
# --------------------------------------------------------------------------- #
async def test_get_summary_location_breakdown_sorted_with_unassigned_bucket(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    pantry = await _make_location(db_session, household_id=household.id, name="Pantry", icon="🥫")
    fridge = await _make_location(db_session, household_id=household.id, name="Fridge", icon="🧊")
    common = {"household_id": household.id, "user_id": user.id}

    await _make_item(db_session, name="A", location_id=pantry.id, **common)
    await _make_item(db_session, name="B", location_id=pantry.id, **common)
    await _make_item(db_session, name="C", location_id=fridge.id, **common)
    await _make_item(db_session, name="D", **common)  # no location
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )

    assert [(b.name, b.item_count) for b in summary.by_location] == [
        ("Pantry", 2),
        ("Fridge", 1),
        (UNASSIGNED_LABEL, 1),
    ]
    assert summary.by_location[0].location_id == pantry.id
    assert summary.by_location[0].icon == "🥫"
    unassigned = summary.by_location[-1]
    assert unassigned.location_id is None
    assert unassigned.icon is None


async def test_get_summary_category_breakdown_sorted_with_unassigned_bucket(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    dairy = await _make_category(db_session, name="Dairy", icon="🥛")
    grains = await _make_category(db_session, name="Grains", icon="🌾")
    common = {"household_id": household.id, "user_id": user.id}

    await _make_item(db_session, name="A", category_id=dairy.id, **common)
    await _make_item(db_session, name="B", category_id=dairy.id, **common)
    await _make_item(db_session, name="C", category_id=grains.id, **common)
    await _make_item(db_session, name="D", **common)  # no category
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )

    assert [(b.name, b.item_count) for b in summary.by_category] == [
        ("Dairy", 2),
        ("Grains", 1),
        (UNASSIGNED_LABEL, 1),
    ]
    assert summary.by_category[0].category_id == dairy.id
    assert summary.by_category[0].icon == "🥛"
    assert summary.by_category[-1].category_id is None


# --------------------------------------------------------------------------- #
# recently added
# --------------------------------------------------------------------------- #
async def test_get_summary_recently_added_is_newest_first_and_limited(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    for index in range(DEFAULT_RECENT_LIMIT + 3):
        await _make_item(
            db_session,
            household_id=household.id,
            user_id=user.id,
            name=f"Item {index}",
        )
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, today=TODAY
    )

    assert len(summary.recently_added) == DEFAULT_RECENT_LIMIT
    # created_at ties are broken by id desc, so the last inserted comes first
    assert summary.recently_added[0].name == f"Item {DEFAULT_RECENT_LIMIT + 2}"


async def test_get_summary_recent_limit_is_configurable(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    for index in range(4):
        await _make_item(
            db_session,
            household_id=household.id,
            user_id=user.id,
            name=f"Item {index}",
        )
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(
        household.id, user.id, recent_limit=2, today=TODAY
    )
    assert len(summary.recently_added) == 2


async def test_get_summary_defaults_to_the_current_date(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await _make_item(
        db_session,
        household_id=household.id,
        user_id=user.id,
        name="Expires tomorrow",
        expiration_date=date.today() + timedelta(days=1),
    )
    await db_session.commit()

    summary = await DashboardService(db_session).get_summary(household.id, user.id)

    assert summary.generated_on == date.today()
    assert summary.counts.expiring_soon == 1
