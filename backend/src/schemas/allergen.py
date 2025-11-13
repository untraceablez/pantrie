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
