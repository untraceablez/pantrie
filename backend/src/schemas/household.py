"""Pydantic schemas for Household model."""
from datetime import datetime

from pydantic import BaseModel, Field

from src.models.household_membership import MemberRole


class HouseholdBase(BaseModel):
    """Base household schema with common fields."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=500)


class HouseholdCreate(HouseholdBase):
    """Schema for creating a household."""

    pass


class HouseholdUpdate(BaseModel):
    """Schema for updating household information."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=500)


class HouseholdResponse(HouseholdBase):
    """Schema for household response."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HouseholdMemberBase(BaseModel):
    """Base schema for household member."""

    user_id: int
    household_id: int
    role: MemberRole


class HouseholdMemberResponse(HouseholdMemberBase):
    """Schema for household member response."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HouseholdMemberUpdate(BaseModel):
    """Schema for updating household member role."""

    role: MemberRole


class HouseholdWithMembership(HouseholdResponse):
    """Schema for household with user's membership role."""

    user_role: MemberRole
