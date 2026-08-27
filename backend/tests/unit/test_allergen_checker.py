"""Tests for the shared household-allergen checker.

Covers the pure helpers in :mod:`src.services.allergen_service`, the DB-backed
``AllergenService`` checkers, the barcode service still formatting product
allergens through the shared helper, and recipe ingredient flagging.
"""
from decimal import Decimal
from typing import Any

import pytest

from src.core.exceptions import AuthorizationError
from src.models.household import Household
from src.models.household_allergen import HouseholdAllergen
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.inventory_item import InventoryItem
from src.models.user import User
from src.services.allergen_service import (
    AllergenService,
    format_allergen_tags,
    match_allergens,
    split_ingredients,
)
from src.services.barcode_service import BarcodeService
from src.services.mealie_query_service import MealieQueryService


# =========================================================================== #
# split_ingredients
# =========================================================================== #
def test_split_ingredients_handles_empty_input():
    assert split_ingredients(None) == []
    assert split_ingredients("") == []
    assert split_ingredients("  ,  ; ") == []


def test_split_ingredients_splits_on_list_punctuation():
    assert split_ingredients("Water, Sugar; Salt") == ["Water", "Sugar", "Salt"]


def test_split_ingredients_unwraps_parenthesised_sublists():
    assert split_ingredients("Chocolate (cocoa butter, milk)") == [
        "Chocolate",
        "cocoa butter",
        "milk",
    ]


def test_split_ingredients_separates_trailing_prose_from_the_list():
    assert split_ingredients("Oats. May contain traces of peanuts.") == [
        "Oats",
        "May contain traces of peanuts",
    ]


# =========================================================================== #
# match_allergens
# =========================================================================== #
def test_match_allergens_matches_a_listed_ingredient():
    assert match_allergens("Water, Whole Milk, Sugar", ["milk"]) == ["milk"]


def test_match_allergens_is_spacing_and_plural_insensitive():
    # Canonical equality: "Corn Starch" == "cornstarch"; plurals collapse.
    assert match_allergens("Water, Corn Starch", ["cornstarch"]) == ["cornstarch"]
    assert match_allergens("Water, Eggs", ["egg"]) == ["egg"]


def test_match_allergens_matches_a_more_specific_ingredient():
    # Token subset: {milk} is a subset of {nonfat, milk, solid}.
    assert match_allergens("Nonfat Milk Solids", ["milk"]) == ["milk"]


def test_match_allergens_does_not_report_corn_for_cornstarch():
    """The known false positive: cornstarch must not trip a corn allergy."""
    assert match_allergens("Water, Cornstarch, Salt", ["corn"]) == []


def test_match_allergens_reports_corn_for_a_spelled_out_corn_ingredient():
    """"Corn Starch" spelled as two words names corn, so it *is* flagged.

    The token-subset tier deliberately treats a more specific ingredient as
    satisfying a generic name; for allergens that is the fail-safe direction.
    Only the single-token "cornstarch" stays a non-match.
    """
    assert match_allergens("Water, Corn Starch, Salt", ["corn"]) == ["corn"]


def test_match_allergens_catches_a_may_contain_warning():
    assert match_allergens("Oats. May contain traces of peanuts.", ["peanuts"]) == [
        "peanuts"
    ]


def test_match_allergens_does_not_report_egg_for_eggplant():
    assert match_allergens("Eggplant, Olive Oil", ["egg"]) == []


def test_match_allergens_returns_empty_for_missing_inputs():
    assert match_allergens(None, ["milk"]) == []
    assert match_allergens("Water, Milk", []) == []
    assert match_allergens("Water, Milk", ["   "]) == []


def test_match_allergens_preserves_order_and_deduplicates():
    result = match_allergens(
        "Wheat flour, whole milk, soy lecithin", ["soy", "milk", "Milk"]
    )
    # Declared order is kept; "Milk" is not reported twice.
    assert result == ["soy", "milk"]


def test_match_allergens_reports_the_declared_spelling():
    assert match_allergens("water, peanuts", ["Peanut"]) == ["Peanut"]


# =========================================================================== #
# format_allergen_tags — barcode-scan behaviour, now shared
# =========================================================================== #
def test_format_allergen_tags_none_returns_none():
    assert format_allergen_tags(None) is None
    assert format_allergen_tags([]) is None


def test_format_allergen_tags_strips_prefix_and_titlecases():
    assert format_allergen_tags(["en:milk", "en:soy-beans"]) == "Milk, Soy Beans"


def test_barcode_service_still_formats_allergens_through_the_shared_helper():
    """The existing barcode-scan behaviour is preserved after the lift."""
    service = BarcodeService()
    assert service._format_allergens(None) is None
    assert service._format_allergens(["en:milk", "en:soy-beans"]) == "Milk, Soy Beans"

    parsed = service._parse_product_data(
        {"product_name": "Cookie", "allergens_tags": ["en:nuts"], "code": "1"}
    )
    assert parsed["allergens"] == "Nuts"


# =========================================================================== #
# AllergenService checkers (DB-backed)
# =========================================================================== #
async def _make_user(db: Any, *, email: str, username: str) -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _household_with(db: Any, *allergens: str) -> tuple[User, Household]:
    user = await _make_user(db, email="checker@example.com", username="checker")
    household = Household(name="Checker House", description=None)
    db.add(household)
    await db.flush()
    db.add(
        HouseholdMembership(
            user_id=user.id, household_id=household.id, role=MemberRole.EDITOR
        )
    )
    for name in allergens:
        db.add(HouseholdAllergen(household_id=household.id, name=name))
    await db.commit()
    return user, household


async def _item(db: Any, household: Household, user: User, name: str, ingredients):
    item = InventoryItem(
        household_id=household.id,
        added_by_user_id=user.id,
        name=name,
        quantity=Decimal("1"),
        unit="count",
        ingredients=ingredients,
    )
    db.add(item)
    await db.commit()
    return item


async def test_get_allergen_names_returns_sorted_names(db_session: Any):
    user, household = await _household_with(db_session, "soy", "milk")
    names = await AllergenService(db_session).get_allergen_names(household.id)
    assert names == ["milk", "soy"]


async def test_check_texts_flags_each_text_independently(db_session: Any):
    user, household = await _household_with(db_session, "milk")
    svc = AllergenService(db_session)
    results = await svc.check_texts(
        household.id, user.id, ["Water, Whole Milk", "Water, Salt"]
    )
    assert [r.text for r in results] == ["Water, Whole Milk", "Water, Salt"]
    assert results[0].allergens == ["milk"]
    assert results[1].allergens == []


async def test_check_texts_requires_membership(db_session: Any):
    _, household = await _household_with(db_session, "milk")
    stranger = await _make_user(
        db_session, email="stranger@example.com", username="stranger"
    )
    await db_session.commit()
    with pytest.raises(AuthorizationError):
        await AllergenService(db_session).check_texts(
            household.id, stranger.id, ["milk"]
        )


async def test_match_inventory_items_returns_only_matching_items(db_session: Any):
    user, household = await _household_with(db_session, "milk")
    flagged = await _item(
        db_session, household, user, "Cookies", "Wheat flour, whole milk, sugar"
    )
    await _item(db_session, household, user, "Rice", "Rice")
    await _item(db_session, household, user, "Mystery", None)

    matches = await AllergenService(db_session).match_inventory_items(
        household.id, user.id
    )
    assert [(m.item_id, m.name, m.allergens) for m in matches] == [
        (flagged.id, "Cookies", ["milk"])
    ]


async def test_match_inventory_items_is_empty_without_declared_allergens(
    db_session: Any,
):
    user, household = await _household_with(db_session)
    await _item(db_session, household, user, "Cookies", "Wheat flour, whole milk")
    assert (
        await AllergenService(db_session).match_inventory_items(household.id, user.id)
        == []
    )


async def test_match_inventory_items_requires_membership(db_session: Any):
    _, household = await _household_with(db_session, "milk")
    stranger = await _make_user(
        db_session, email="nosy@example.com", username="nosy"
    )
    await db_session.commit()
    with pytest.raises(AuthorizationError):
        await AllergenService(db_session).match_inventory_items(
            household.id, stranger.id
        )


# =========================================================================== #
# Recipe ingredient flagging
# =========================================================================== #
async def test_recipes_flag_ingredients_matching_household_allergens(
    db_session: Any, admin_household: dict[str, Any]
):
    hh = admin_household["household"]
    db_session.add(HouseholdAllergen(household_id=hh.id, name="milk"))
    await db_session.commit()

    recipes = [
        {
            "recipe_id": "pancakes",
            "name": "Pancakes",
            "ingredients": ["flour", "whole milk", "cornstarch"],
        }
    ]
    [annotated] = await MealieQueryService(db_session).annotate_makeability(
        hh.id, recipes
    )
    assert [
        (f.ingredient, f.allergens) for f in annotated.allergen_ingredients
    ] == [("whole milk", ["milk"])]


async def test_recipes_carry_no_flags_without_declared_allergens(
    db_session: Any, admin_household: dict[str, Any]
):
    hh = admin_household["household"]
    recipes = [
        {"recipe_id": "toast", "name": "Toast", "ingredients": ["bread", "butter"]}
    ]
    [annotated] = await MealieQueryService(db_session).annotate_makeability(
        hh.id, recipes
    )
    assert annotated.allergen_ingredients == []
