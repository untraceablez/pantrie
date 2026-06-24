"""Pydantic schemas for client-facing inventory queries (Mealie integration)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl


class IngredientQuery(BaseModel):
    """A single ingredient to check, optionally with a desired amount/unit."""

    name: str = Field(min_length=1)
    amount: Decimal | None = Field(default=None, ge=0)
    unit: str | None = None


class BulkAvailabilityRequest(BaseModel):
    """Bulk ingredient availability request."""

    ingredients: list[IngredientQuery] = Field(min_length=1, max_length=100)


class AvailabilityResult(BaseModel):
    """Availability of one ingredient against current inventory."""

    query: str
    in_stock: bool
    matched_item_id: int | None = None
    matched_name: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    sufficiency_determinable: bool = False
    sufficient: bool | None = None
    ambiguous: bool = False


class BulkAvailabilityResponse(BaseModel):
    """One result per requested ingredient."""

    results: list[AvailabilityResult]


class DecrementRequest(BaseModel):
    """Request to decrement an item's quantity."""

    amount: Decimal = Field(gt=0)
    unit: str | None = None


class DecrementResult(BaseModel):
    """Outcome of a decrement (clamped to zero if it would go negative)."""

    item_id: int
    removed: Decimal
    remaining: Decimal
    clamped: bool


# --- Phase 2: outbound Mealie connection (Pantrie -> Mealie) ---


class MealieConnectionConfig(BaseModel):
    """Request to configure a household's Mealie connection."""

    base_url: HttpUrl
    api_key: str = Field(min_length=1)


class MealieConnectionResponse(BaseModel):
    """Mealie connection details (never includes the API key)."""

    id: int
    household_id: int
    base_url: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecipeMakeability(BaseModel):
    """A Mealie recipe with whether it can be made from current inventory."""

    recipe_id: str
    name: str
    makeable: bool
    total_ingredients: int
    available_ingredients: int
    missing: list[str]


class RecipesResponse(BaseModel):
    """Recipes pulled from Mealie, annotated with makeability."""

    recipes: list[RecipeMakeability]


class ShoppingList(BaseModel):
    """A Mealie shopping list the user can target."""

    id: str
    name: str


class ShoppingListsResponse(BaseModel):
    """The household's available Mealie shopping lists."""

    lists: list[ShoppingList]


class ShoppingListPushRequest(BaseModel):
    """Ingredients to add to a Mealie shopping list.

    Target resolution: ``create_list_name`` (make a new list) takes precedence,
    then ``list_id`` (an existing list); if neither is given the first list is
    used (back-compat).
    """

    items: list[str] = Field(min_length=1, max_length=100)
    list_id: str | None = None
    create_list_name: str | None = Field(default=None, max_length=255)


class ShoppingListPushItem(BaseModel):
    """Result of attempting to add one ingredient to the Mealie shopping list."""

    name: str
    added: bool  # successfully applied to the list (newly created or incremented)
    updated: bool = False  # True when an existing line item's quantity was incremented
    detail: str | None = None


class ShoppingListPushResult(BaseModel):
    """Outcome of pushing missing ingredients to a Mealie shopping list."""

    requested: int
    added: int  # total successfully applied (new + incremented)
    updated: int = 0  # subset of ``added`` that incremented an existing item
    items: list[ShoppingListPushItem]
