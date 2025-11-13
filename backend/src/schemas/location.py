"""Pydantic schemas for Location model."""
from datetime import datetime

from pydantic import BaseModel, Field


class LocationBase(BaseModel):
    """Base location schema with common fields."""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    icon: str | None = Field(None, max_length=50)


class LocationCreate(LocationBase):
    """Schema for creating a location."""

    household_id: int


class LocationUpdate(BaseModel):
    """Schema for updating a location."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    icon: str | None = Field(None, max_length=50)


class LocationResponse(LocationBase):
    """Schema for location response."""

    id: int
    household_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
