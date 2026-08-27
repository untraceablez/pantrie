"""Pydantic schemas for the household dashboard summary."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from src.schemas.inventory import InventoryItemResponse


class DashboardCounts(BaseModel):
    """Headline counts rendered as the dashboard's summary cards."""

    total_items: int = Field(description="Every item in the household")
    expired: int = Field(description="Items whose expiration date is in the past")
    expiring_soon: int = Field(
        description="Items expiring today through the requested horizon"
    )
    low_stock: int = Field(description="Items at or below the low-stock threshold")
    no_expiration_date: int = Field(description="Items without an expiration date")


class LocationBreakdown(BaseModel):
    """Item count for a single storage location."""

    location_id: int | None = Field(description="None for items with no location")
    name: str
    icon: str | None = None
    item_count: int


class CategoryBreakdown(BaseModel):
    """Item count for a single category."""

    category_id: int | None = Field(description="None for items with no category")
    name: str
    icon: str | None = None
    item_count: int


class DashboardSummaryResponse(BaseModel):
    """Aggregated inventory health for one household."""

    household_id: int
    generated_on: date = Field(description="Date the counts were computed against")
    expiring_within_days: int = Field(description="Horizon used for expiring_soon")
    low_stock_threshold: Decimal = Field(
        description="Quantity at or below which an item counts as low stock"
    )
    counts: DashboardCounts
    by_location: list[LocationBreakdown]
    by_category: list[CategoryBreakdown]
    recently_added: list[InventoryItemResponse]
