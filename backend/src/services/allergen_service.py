"""Household allergen CRUD plus the shared allergen checker.

The checker is the one place that decides whether a piece of free text — a
product's ingredient list, a recipe ingredient, or what someone just typed into
the add/edit form — implicates one of a household's declared allergens.
Everything that warns about allergens goes through :func:`match_allergens` so
the answer is the same everywhere.

Matching delegates to :mod:`src.services.ingredient_matching`, the same
normalised, tiered matcher recipe makeability and shopping-list dedup use, so
``"Corn Starch"`` matches ``"cornstarch"`` while ``"corn"`` still does **not**
(a deliberate non-match: warning about corn because a product contains
cornstarch is the kind of false positive that teaches people to ignore
warnings).
"""
import re
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.models.household_allergen import HouseholdAllergen
from src.models.household_membership import MemberRole
from src.models.inventory_item import InventoryItem
from src.schemas.allergen import (
    AllergenCreate,
    AllergenTextMatch,
    InventoryAllergenMatch,
)
from src.services.household_service import HouseholdService
from src.services.ingredient_matching import is_match

logger = setup_logging()

# Ingredient text is free-form: comma/semicolon separated, with parenthesised
# sub-lists ("chocolate (cocoa butter, milk)"), slashes, and trailing prose
# ("May contain traces of nuts."). Split on all of those so each ingredient is
# matched on its own — handing the whole blob to the matcher would never hit,
# since it compares whole names rather than looking for substrings.
_INGREDIENT_SPLIT_RE = re.compile(
    r"[,;:/\n\r()\[\]{}.*|]|&|\+|\band\b|\bor\b|\bwith\b|\bcontains\b",
    re.IGNORECASE,
)


def split_ingredients(text: str | None) -> list[str]:
    """Split a free-text ingredient list into individual ingredient phrases."""
    if not text:
        return []
    return [part.strip() for part in _INGREDIENT_SPLIT_RE.split(text) if part.strip()]


def match_allergens(text: str | None, allergen_names: Sequence[str]) -> list[str]:
    """Return the allergens from ``allergen_names`` that ``text`` implicates.

    Names come back in the order given, at most once each (de-duplicated
    case-insensitively), spelled as the household declared them.
    """
    phrases = split_ingredients(text)
    if not phrases or not allergen_names:
        return []

    matched: list[str] = []
    seen: set[str] = set()
    for allergen in allergen_names:
        key = allergen.strip().lower()
        if not key or key in seen:
            continue
        if any(is_match(phrase, allergen) for phrase in phrases):
            seen.add(key)
            matched.append(allergen)
    return matched


def format_allergen_tags(allergen_tags: list[str] | None) -> str | None:
    """Format a product database's allergen tags into a readable string.

    Args:
        allergen_tags: Tags as returned by Open Food Facts, e.g.
            ``["en:milk", "en:soybeans"]``.

    Returns:
        A readable, comma-separated string (``"Milk, Soybeans"``), or ``None``
        when there are no tags.
    """
    if not allergen_tags:
        return None

    # Drop the language prefix ("en:") and turn the slug into words.
    return ", ".join(
        tag.split(":")[-1].replace("-", " ").title() for tag in allergen_tags
    )


class AllergenService:
    """Service for allergen operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def create_allergen(
        self, user_id: int, household_id: int, allergen_data: AllergenCreate
    ) -> HouseholdAllergen:
        """Create a new allergen for a household."""
        # Check if user has at least editor role
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.EDITOR
        )

        # Create allergen
        allergen = HouseholdAllergen(
            household_id=household_id,
            name=allergen_data.name.strip().lower(),
        )

        self.db.add(allergen)
        await self.db.commit()
        await self.db.refresh(allergen)

        logger.info(
            "Allergen created",
            allergen_id=allergen.id,
            household_id=household_id,
            user_id=user_id,
            name=allergen.name,
        )
        return allergen

    async def list_household_allergens(
        self, household_id: int, user_id: int
    ) -> list[HouseholdAllergen]:
        """List all allergens for a household."""
        # Check if user has access
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        result = await self.db.execute(
            select(HouseholdAllergen)
            .where(HouseholdAllergen.household_id == household_id)
            .order_by(HouseholdAllergen.name)
        )

        return list(result.scalars().all())

    async def delete_allergen(self, allergen_id: int, user_id: int) -> None:
        """Delete an allergen."""
        # Get allergen
        result = await self.db.execute(
            select(HouseholdAllergen).where(HouseholdAllergen.id == allergen_id)
        )
        allergen = result.scalars().first()

        if not allergen:
            raise NotFoundError(
                message="Allergen not found",
                details={"allergen_id": allergen_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            allergen.household_id, user_id, MemberRole.EDITOR
        )

        await self.db.delete(allergen)
        await self.db.commit()

        logger.info(
            "Allergen deleted",
            allergen_id=allergen_id,
            household_id=allergen.household_id,
            user_id=user_id,
        )

    # ------------------------------------------------------------------ #
    # Checking
    # ------------------------------------------------------------------ #
    async def get_allergen_names(self, household_id: int) -> list[str]:
        """The household's declared allergen names, in one query.

        No permission check: this is the internal building block for the
        checkers below and for callers (e.g. the Mealie recipe listing) that
        have already established membership.
        """
        result = await self.db.execute(
            select(HouseholdAllergen.name)
            .where(HouseholdAllergen.household_id == household_id)
            .order_by(HouseholdAllergen.name)
        )
        return list(result.scalars().all())

    async def check_texts(
        self, household_id: int, user_id: int, texts: Sequence[str]
    ) -> list[AllergenTextMatch]:
        """Check arbitrary free text (e.g. a form's ingredients field).

        The household's allergens are loaded once and every text is matched
        against that one list, so checking a batch costs a single query.
        """
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )
        names = await self.get_allergen_names(household_id)
        return [
            AllergenTextMatch(text=text, allergens=match_allergens(text, names))
            for text in texts
        ]

    async def match_inventory_items(
        self, household_id: int, user_id: int
    ) -> list[InventoryAllergenMatch]:
        """Allergen matches for every stored item in the household.

        Two queries total — the allergens once and the items once — then all
        matching happens in memory, so flagging a whole inventory page costs
        the same as flagging a single item. That is why this is a household-wide
        batch call rather than a per-item lookup: a per-item endpoint would
        N+1 across a list request.

        Only items that actually match are returned, keeping the payload
        proportional to the warnings rather than to the inventory.
        """
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )
        names = await self.get_allergen_names(household_id)
        if not names:
            return []

        result = await self.db.execute(
            select(InventoryItem.id, InventoryItem.name, InventoryItem.ingredients)
            .where(InventoryItem.household_id == household_id)
            .order_by(InventoryItem.id)
        )

        matches: list[InventoryAllergenMatch] = []
        for item_id, item_name, ingredients in result.all():
            allergens = match_allergens(ingredients, names)
            if allergens:
                matches.append(
                    InventoryAllergenMatch(
                        item_id=item_id, name=item_name, allergens=allergens
                    )
                )
        return matches
