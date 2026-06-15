"""Pydantic schemas for client-facing inventory queries (Mealie integration)."""
from decimal import Decimal

from pydantic import BaseModel, Field


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
