"""Inventory queries for external clients: availability and decrement (US2/US3)."""
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.models.household_staple import HouseholdStaple
from src.models.inventory_item import InventoryItem
from src.schemas.mealie import (
    AvailabilityResult,
    DecrementResult,
    IngredientQuery,
    RecipeMakeability,
)
from src.services.ingredient_matching import find_matches, is_match

logger = setup_logging()


class MealieQueryService:
    """Match ingredient names to inventory and report/adjust availability.

    Matching is name-based within a household via the shared, normalised
    matcher (see :mod:`src.services.ingredient_matching`): canonical equality,
    then token-subset, then a high-threshold ratio — so spacing/plural/case
    variants line up. Sufficiency is only computed when the requested unit
    matches the stored unit (no unit conversion in the MVP).
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_items(self, household_id: int) -> list[InventoryItem]:
        result = await self.db.execute(
            select(InventoryItem).where(InventoryItem.household_id == household_id)
        )
        return list(result.scalars().all())

    async def _load_staple_names(self, household_id: int) -> list[str]:
        result = await self.db.execute(
            select(HouseholdStaple.name).where(
                HouseholdStaple.household_id == household_id
            )
        )
        return list(result.scalars().all())

    @staticmethod
    def _is_staple(ingredient: str, staples: list[str]) -> bool:
        """Whether an ingredient matches one of the household's staples."""
        return any(is_match(ingredient, staple) for staple in staples)

    @staticmethod
    def _build_result(query: IngredientQuery, matches: list[InventoryItem]) -> AvailabilityResult:
        if not matches:
            return AvailabilityResult(query=query.name, in_stock=False)

        # Prefer the match with the greatest quantity when several exist.
        item = max(matches, key=lambda i: i.quantity)
        result = AvailabilityResult(
            query=query.name,
            in_stock=item.quantity > 0,
            matched_item_id=item.id,
            matched_name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            ambiguous=len(matches) > 1,
        )

        if query.amount is not None and query.unit and item.unit:
            if query.unit.strip().lower() == item.unit.strip().lower():
                result.sufficiency_determinable = True
                result.sufficient = item.quantity >= query.amount
        return result

    async def check_availability(
        self, household_id: int, queries: list[IngredientQuery]
    ) -> list[AvailabilityResult]:
        # Load the household's items once and match each query in memory so the
        # normalised/fuzzy matcher can run (it can't be expressed as a single
        # SQL predicate).
        items = await self._load_items(household_id)
        results: list[AvailabilityResult] = []
        for query in queries:
            matches = find_matches(query.name, items, key=lambda i: i.name)
            results.append(self._build_result(query, matches))
        logger.info(
            "Client availability check",
            household_id=household_id,
            count=len(queries),
        )
        return results

    async def annotate_makeability(
        self, household_id: int, recipes: list[dict]
    ) -> list[RecipeMakeability]:
        """Annotate Mealie recipes with whether they're makeable from inventory.

        Each recipe is ``{recipe_id, name, ingredients: [str]}``. A recipe is
        makeable when it has ingredients and all of them are in stock — where
        "in stock" also covers the household's assumed staples (e.g. water),
        which are treated as on-hand without an inventory row.
        """
        staples = await self._load_staple_names(household_id)
        annotated: list[RecipeMakeability] = []
        for recipe in recipes:
            ingredients: list[str] = recipe.get("ingredients", [])
            results = await self.check_availability(
                household_id, [IngredientQuery(name=n) for n in ingredients]
            )
            missing = [
                r.query
                for r in results
                if not r.in_stock and not self._is_staple(r.query, staples)
            ]
            annotated.append(
                RecipeMakeability(
                    recipe_id=recipe["recipe_id"],
                    name=recipe["name"],
                    makeable=bool(ingredients) and not missing,
                    total_ingredients=len(ingredients),
                    available_ingredients=len(ingredients) - len(missing),
                    missing=missing,
                )
            )
        return annotated

    async def decrement_item(
        self, household_id: int, item_id: int, amount: Decimal
    ) -> DecrementResult:
        result = await self.db.execute(
            select(InventoryItem).where(
                InventoryItem.id == item_id,
                InventoryItem.household_id == household_id,
            )
        )
        item = result.scalars().first()
        if not item:
            raise NotFoundError(message="Inventory item not found")

        available = item.quantity
        removed = min(available, amount)
        clamped = amount > available
        item.quantity = available - removed
        await self.db.commit()
        await self.db.refresh(item)

        logger.info(
            "Client decremented item",
            household_id=household_id,
            item_id=item_id,
            removed=str(removed),
            clamped=clamped,
        )
        return DecrementResult(
            item_id=item_id, removed=removed, remaining=item.quantity, clamped=clamped
        )
