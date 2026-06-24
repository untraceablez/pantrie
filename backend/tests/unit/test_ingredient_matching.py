"""Unit tests for ingredient → inventory matching and sufficiency (US2)."""
from decimal import Decimal
from typing import Any

import pytest

from src.models.inventory_item import InventoryItem
from src.schemas.mealie import IngredientQuery
from src.services.mealie_query_service import MealieQueryService


async def _add_item(db: Any, household: Any, user: Any, name: str, qty: str, unit: str | None) -> None:
    db.add(
        InventoryItem(
            household_id=household.id,
            added_by_user_id=user.id,
            name=name,
            quantity=Decimal(qty),
            unit=unit,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_exact_case_insensitive_match(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Flour", "2.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="flour")])
    assert res.in_stock is True
    assert res.matched_name == "Flour"
    assert res.quantity == Decimal("2.00")
    assert res.unit == "kg"


@pytest.mark.asyncio
async def test_not_in_stock_is_not_an_error(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh = admin_household["household"]
    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="saffron")])
    assert res.in_stock is False
    assert res.matched_item_id is None


@pytest.mark.asyncio
async def test_fuzzy_substring_fallback(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Whole Wheat Flour", "1.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="wheat flour")])
    assert res.in_stock is True
    assert res.matched_name == "Whole Wheat Flour"


@pytest.mark.asyncio
async def test_spacing_variant_matches(db_session: Any, admin_household: dict[str, Any]) -> None:
    """`Corn Starch` in inventory satisfies a `cornstarch` ingredient."""
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Corn Starch", "1.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="cornstarch")])
    assert res.in_stock is True
    assert res.matched_name == "Corn Starch"


@pytest.mark.asyncio
async def test_plural_variant_matches(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Tomato", "3.00", "count")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="Tomatoes")])
    assert res.in_stock is True
    assert res.matched_name == "Tomato"


@pytest.mark.asyncio
async def test_near_miss_does_not_match(db_session: Any, admin_household: dict[str, Any]) -> None:
    """`corn` must NOT be satisfied by `Cornstarch` (documented false-positive)."""
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Cornstarch", "1.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="corn")])
    assert res.in_stock is False


@pytest.mark.asyncio
async def test_exact_tier_is_not_ambiguous_with_a_specific_variant(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    """An exact canonical hit wins outright and isn't flagged ambiguous."""
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Flour", "2.00", "kg")
    await _add_item(db_session, hh, user, "Whole Wheat Flour", "1.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="flour")])
    assert res.matched_name == "Flour"
    assert res.ambiguous is False


@pytest.mark.asyncio
async def test_sufficiency_same_unit(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Sugar", "5.00", "kg")

    svc = MealieQueryService(db_session)
    [enough] = await svc.check_availability(
        hh.id, [IngredientQuery(name="sugar", amount=Decimal("2"), unit="kg")]
    )
    assert enough.sufficiency_determinable is True
    assert enough.sufficient is True

    [short] = await svc.check_availability(
        hh.id, [IngredientQuery(name="sugar", amount=Decimal("9"), unit="kg")]
    )
    assert short.sufficiency_determinable is True
    assert short.sufficient is False


@pytest.mark.asyncio
async def test_sufficiency_undeterminable_on_unit_mismatch(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _add_item(db_session, hh, user, "Milk", "1.00", "kg")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(
        hh.id, [IngredientQuery(name="milk", amount=Decimal("200"), unit="ml")]
    )
    assert res.in_stock is True
    assert res.sufficiency_determinable is False
    assert res.sufficient is None


@pytest.mark.asyncio
async def test_household_scoped(db_session: Any, admin_household: dict[str, Any]) -> None:
    """Items in another household are not matched."""
    from src.models.household import Household

    hh, user = admin_household["household"], admin_household["user"]
    other = Household(name="Other")
    db_session.add(other)
    await db_session.flush()
    await _add_item(db_session, other, user, "Truffle", "1.00", "count")

    svc = MealieQueryService(db_session)
    [res] = await svc.check_availability(hh.id, [IngredientQuery(name="truffle")])
    assert res.in_stock is False
