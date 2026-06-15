"""Unit tests for client-driven inventory decrement (US3)."""
from decimal import Decimal
from typing import Any

import pytest

from src.core.exceptions import NotFoundError
from src.models.inventory_item import InventoryItem
from src.services.mealie_query_service import MealieQueryService


async def _add_item(db: Any, household: Any, user: Any, qty: str) -> InventoryItem:
    item = InventoryItem(
        household_id=household.id,
        added_by_user_id=user.id,
        name="Sugar",
        quantity=Decimal(qty),
        unit="kg",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@pytest.mark.asyncio
async def test_decrement_reduces_quantity(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item = await _add_item(db_session, hh, user, "5")

    svc = MealieQueryService(db_session)
    result = await svc.decrement_item(hh.id, item.id, Decimal("2"))
    assert result.removed == Decimal("2")
    assert result.remaining == Decimal("3")
    assert result.clamped is False


@pytest.mark.asyncio
async def test_decrement_clamps_to_zero(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    item = await _add_item(db_session, hh, user, "3")

    svc = MealieQueryService(db_session)
    result = await svc.decrement_item(hh.id, item.id, Decimal("10"))
    assert result.removed == Decimal("3")
    assert result.remaining == Decimal("0")
    assert result.clamped is True


@pytest.mark.asyncio
async def test_decrement_other_household_not_found(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    """An item id that is not in the given household must not be decremented."""
    from src.models.household import Household

    hh, user = admin_household["household"], admin_household["user"]
    item = await _add_item(db_session, hh, user, "5")

    other = Household(name="Other")
    db_session.add(other)
    await db_session.flush()
    await db_session.commit()

    svc = MealieQueryService(db_session)
    with pytest.raises(NotFoundError):
        await svc.decrement_item(other.id, item.id, Decimal("1"))
