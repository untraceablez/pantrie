"""Unit tests for recipe makeability computation (US4)."""
from decimal import Decimal
from typing import Any

import pytest

from src.models.household_staple import HouseholdStaple
from src.models.inventory_item import InventoryItem
from src.services.mealie_query_service import MealieQueryService


async def _staple(db: Any, hh: Any, *names: str) -> None:
    for name in names:
        db.add(HouseholdStaple(household_id=hh.id, name=name))
    await db.commit()


async def _stock(db: Any, hh: Any, user: Any, *names: str) -> None:
    for name in names:
        db.add(
            InventoryItem(
                household_id=hh.id, added_by_user_id=user.id,
                name=name, quantity=Decimal("1"), unit="count",
            )
        )
    await db.commit()


@pytest.mark.asyncio
async def test_makeable_when_all_in_stock(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _stock(db_session, hh, user, "Eggs", "Milk")

    svc = MealieQueryService(db_session)
    recipes = [{"recipe_id": "omelette", "name": "Omelette", "ingredients": ["eggs", "milk"]}]
    [m] = await svc.annotate_makeability(hh.id, recipes)
    assert m.makeable is True
    assert m.missing == []
    assert m.total_ingredients == 2
    assert m.available_ingredients == 2


@pytest.mark.asyncio
async def test_not_makeable_lists_missing(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _stock(db_session, hh, user, "Flour", "Eggs")

    svc = MealieQueryService(db_session)
    recipes = [
        {"recipe_id": "pancakes", "name": "Pancakes", "ingredients": ["flour", "eggs", "vanilla"]}
    ]
    [m] = await svc.annotate_makeability(hh.id, recipes)
    assert m.makeable is False
    assert m.missing == ["vanilla"]
    assert m.available_ingredients == 2
    assert m.total_ingredients == 3


@pytest.mark.asyncio
async def test_staple_ingredient_counts_as_in_stock(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    """A staple (water) is on-hand without an inventory row and isn't 'missing'."""
    hh, user = admin_household["household"], admin_household["user"]
    await _stock(db_session, hh, user, "Flour")
    await _staple(db_session, hh, "water")

    svc = MealieQueryService(db_session)
    recipes = [{"recipe_id": "dough", "name": "Dough", "ingredients": ["flour", "Water"]}]
    [m] = await svc.annotate_makeability(hh.id, recipes)
    assert m.makeable is True
    assert m.missing == []
    assert m.available_ingredients == 2


@pytest.mark.asyncio
async def test_non_staple_missing_ingredient_still_listed(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    await _stock(db_session, hh, user, "Flour")
    await _staple(db_session, hh, "water")

    svc = MealieQueryService(db_session)
    recipes = [{"recipe_id": "r", "name": "R", "ingredients": ["flour", "water", "yeast"]}]
    [m] = await svc.annotate_makeability(hh.id, recipes)
    assert m.makeable is False
    assert m.missing == ["yeast"]
    assert m.available_ingredients == 2


@pytest.mark.asyncio
async def test_no_ingredients_is_not_makeable(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh = admin_household["household"]
    svc = MealieQueryService(db_session)
    [m] = await svc.annotate_makeability(hh.id, [{"recipe_id": "x", "name": "X", "ingredients": []}])
    assert m.makeable is False
    assert m.total_ingredients == 0
