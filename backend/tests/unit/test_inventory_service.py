"""Tests for InventoryService (CRUD + role gating + list/search/filter/sort).

DB-backed via the real ``db_session``. Role enforcement is delegated to
HouseholdService._check_user_role, so each test wires up a household with the
membership role under test. category/location filters need real Category /
Location rows (FK-constrained), created by the helpers below.
"""
from decimal import Decimal

import pytest

from src.core.exceptions import AuthorizationError, NotFoundError
from src.models.category import Category
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.models.user import User
from src.schemas.inventory import InventoryItemCreate, InventoryItemUpdate
from src.services.inventory_service import InventoryService


async def _make_user(db, *, email, username) -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _setup_household(db, *, role=MemberRole.EDITOR):
    """Create a household with one member at ``role``. Returns (user, household)."""
    user = await _make_user(db, email=f"{role.value}@example.com", username=role.value)
    household = Household(name="House", description=None)
    db.add(household)
    await db.flush()
    db.add(HouseholdMembership(user_id=user.id, household_id=household.id, role=role))
    await db.flush()
    return user, household


async def _make_item(db, *, household_id, user_id, name="Milk", **kwargs) -> InventoryItem:
    item = InventoryItem(
        household_id=household_id, added_by_user_id=user_id, name=name,
        quantity=kwargs.pop("quantity", Decimal("1")), **kwargs,
    )
    db.add(item)
    await db.flush()
    return item


def _create_payload(household_id, **kwargs) -> InventoryItemCreate:
    data = {"household_id": household_id, "name": "Eggs", "quantity": Decimal("12")}
    data.update(kwargs)
    return InventoryItemCreate(**data)


# --------------------------------------------------------------------------- #
# create_item
# --------------------------------------------------------------------------- #
async def test_create_item_editor_succeeds(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = InventoryService(db_session)

    item = await svc.create_item(user.id, _create_payload(household.id, name="Bread"))
    assert item.id is not None
    assert item.name == "Bread"
    assert item.added_by_user_id == user.id
    assert item.household_id == household.id


async def test_create_item_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.create_item(user.id, _create_payload(household.id))


# --------------------------------------------------------------------------- #
# get_item_by_id
# --------------------------------------------------------------------------- #
async def test_get_item_by_id_viewer_succeeds(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    item = await _make_item(db_session, household_id=household.id, user_id=user.id)
    await db_session.commit()
    svc = InventoryService(db_session)

    got = await svc.get_item_by_id(item.id, user.id)
    assert got.id == item.id


async def test_get_item_by_id_not_found(db_session):
    user, _ = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_item_by_id(9999, user.id)


async def test_get_item_by_id_non_member_rejected(db_session):
    owner, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    item = await _make_item(db_session, household_id=household.id, user_id=owner.id)
    stranger = await _make_user(db_session, email="s@example.com", username="stranger")
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.get_item_by_id(item.id, stranger.id)


# --------------------------------------------------------------------------- #
# update_item
# --------------------------------------------------------------------------- #
async def test_update_item_editor_updates_fields(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    item = await _make_item(db_session, household_id=household.id, user_id=user.id,
                            name="Old", quantity=Decimal("1"))
    await db_session.commit()
    svc = InventoryService(db_session)

    updated = await svc.update_item(
        item.id, user.id, InventoryItemUpdate(name="New", quantity=Decimal("5"))
    )
    assert updated.name == "New"
    assert updated.quantity == Decimal("5")


async def test_update_item_not_found(db_session):
    user, _ = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(NotFoundError):
        await svc.update_item(9999, user.id, InventoryItemUpdate(name="x"))


async def test_update_item_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    item = await _make_item(db_session, household_id=household.id, user_id=user.id)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_item(item.id, user.id, InventoryItemUpdate(name="x"))


# --------------------------------------------------------------------------- #
# delete_item
# --------------------------------------------------------------------------- #
async def test_delete_item_editor_succeeds(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    item = await _make_item(db_session, household_id=household.id, user_id=user.id)
    await db_session.commit()
    svc = InventoryService(db_session)

    await svc.delete_item(item.id, user.id)
    with pytest.raises(NotFoundError):
        await svc.get_item_by_id(item.id, user.id)


async def test_delete_item_not_found(db_session):
    user, _ = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(NotFoundError):
        await svc.delete_item(9999, user.id)


async def test_delete_item_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    item = await _make_item(db_session, household_id=household.id, user_id=user.id)
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.delete_item(item.id, user.id)


# --------------------------------------------------------------------------- #
# list_household_items
# --------------------------------------------------------------------------- #
async def test_list_household_items_returns_newest_first(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await _make_item(db_session, household_id=household.id, user_id=user.id, name="First")
    await _make_item(db_session, household_id=household.id, user_id=user.id, name="Second")
    await db_session.commit()
    svc = InventoryService(db_session)

    items = await svc.list_household_items(household.id, user.id)
    assert {i.name for i in items} == {"First", "Second"}
    # ordered by created_at desc
    assert items[0].created_at >= items[-1].created_at


async def test_list_household_items_non_member_rejected(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    stranger = await _make_user(db_session, email="s@example.com", username="stranger")
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.list_household_items(household.id, stranger.id)


# --------------------------------------------------------------------------- #
# list_inventory (pagination / search / filter / sort)
# --------------------------------------------------------------------------- #
async def test_list_inventory_paginates_and_counts(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    for n in range(5):
        await _make_item(db_session, household_id=household.id, user_id=user.id,
                         name=f"Item{n}")
    await db_session.commit()
    svc = InventoryService(db_session)

    items, total = await svc.list_inventory(household.id, user.id, page=1, page_size=2)
    assert total == 5
    assert len(items) == 2
    page3, _ = await svc.list_inventory(household.id, user.id, page=3, page_size=2)
    assert len(page3) == 1


async def test_list_inventory_search_matches_name_description_brand(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await _make_item(db_session, household_id=household.id, user_id=user.id,
                     name="Cheddar Cheese")
    await _make_item(db_session, household_id=household.id, user_id=user.id,
                     name="Yogurt", description="creamy CHEESE-like")
    await _make_item(db_session, household_id=household.id, user_id=user.id,
                     name="Crackers", brand="Cheese Co")
    await _make_item(db_session, household_id=household.id, user_id=user.id, name="Apple")
    await db_session.commit()
    svc = InventoryService(db_session)

    items, total = await svc.list_inventory(household.id, user.id, search="cheese")
    assert total == 3
    assert "Apple" not in {i.name for i in items}


async def test_list_inventory_filters_by_category_and_location(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    category = Category(name="Dairy")
    db_session.add(category)
    location = Location(household_id=household.id, name="Fridge")
    db_session.add(location)
    await db_session.flush()
    await _make_item(db_session, household_id=household.id, user_id=user.id,
                     name="Milk", category_id=category.id, location_id=location.id)
    await _make_item(db_session, household_id=household.id, user_id=user.id, name="Bread")
    await db_session.commit()
    svc = InventoryService(db_session)

    by_cat, cat_total = await svc.list_inventory(
        household.id, user.id, category_id=category.id
    )
    assert cat_total == 1 and by_cat[0].name == "Milk"

    by_loc, loc_total = await svc.list_inventory(
        household.id, user.id, location_id=location.id
    )
    assert loc_total == 1 and by_loc[0].name == "Milk"


async def test_list_inventory_sorts_ascending_by_name(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    for name in ("Banana", "Apple", "Cherry"):
        await _make_item(db_session, household_id=household.id, user_id=user.id, name=name)
    await db_session.commit()
    svc = InventoryService(db_session)

    items, _ = await svc.list_inventory(
        household.id, user.id, sort_by="name", sort_order="asc"
    )
    assert [i.name for i in items] == ["Apple", "Banana", "Cherry"]


async def test_list_inventory_unknown_sort_by_falls_back_to_created_at(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await _make_item(db_session, household_id=household.id, user_id=user.id, name="Only")
    await db_session.commit()
    svc = InventoryService(db_session)

    items, total = await svc.list_inventory(
        household.id, user.id, sort_by="not_a_column", sort_order="desc"
    )
    assert total == 1 and items[0].name == "Only"


async def test_list_inventory_non_member_rejected(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    stranger = await _make_user(db_session, email="s@example.com", username="stranger")
    await db_session.commit()
    svc = InventoryService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.list_inventory(household.id, stranger.id)
