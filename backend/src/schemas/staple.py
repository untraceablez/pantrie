"""Staple schemas for validation and serialization."""
from datetime import datetime

from pydantic import BaseModel, Field


class StapleBase(BaseModel):
    """Base staple schema."""

    name: str = Field(..., min_length=1, max_length=100)


class StapleCreate(StapleBase):
    """Schema for creating a staple."""

    pass


class Staple(StapleBase):
    """Schema for staple responses."""

    id: int
    household_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
