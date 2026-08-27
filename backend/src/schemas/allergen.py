"""Allergen schemas for validation and serialization."""
from datetime import datetime

from pydantic import BaseModel, Field


class AllergenBase(BaseModel):
    """Base allergen schema."""

    name: str = Field(..., min_length=1, max_length=100)


class AllergenCreate(AllergenBase):
    """Schema for creating an allergen."""

    pass


class Allergen(AllergenBase):
    """Schema for allergen responses."""

    id: int
    household_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Allergen checking (stored items, manual entry) ---


class AllergenCheckRequest(BaseModel):
    """Free-text snippets to check against the household's allergens.

    Sent as a batch so a caller with several fields (or several items) pays for
    one round trip and one allergen lookup.
    """

    texts: list[str] = Field(min_length=1, max_length=100)


class AllergenTextMatch(BaseModel):
    """The allergens one piece of free text implicates."""

    text: str
    allergens: list[str]


class AllergenCheckResponse(BaseModel):
    """One result per submitted text, in the order submitted."""

    results: list[AllergenTextMatch]


class InventoryAllergenMatch(BaseModel):
    """A stored inventory item whose ingredients implicate household allergens."""

    item_id: int
    name: str
    allergens: list[str]


class InventoryAllergenMatchesResponse(BaseModel):
    """Allergen matches across a household's whole inventory.

    Only matching items appear in ``matches``; items absent from the list have
    no warning.
    """

    matches: list[InventoryAllergenMatch]
