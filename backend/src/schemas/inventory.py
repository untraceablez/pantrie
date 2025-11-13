"""Pydantic schemas for InventoryItem model."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class InventoryItemBase(BaseModel):
    """Base inventory item schema with common fields."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(None)
    quantity: Decimal = Field(gt=0)
    unit: str | None = Field(None, max_length=50)
    category_id: int | None = None
    location_id: int | None = None
    purchase_date: date | None = None
    expiration_date: date | None = None
    barcode: str | None = Field(None, max_length=100)
    brand: str | None = Field(None, max_length=200)
    image_url: str | None = None
    notes: str | None = None
    ingredients: str | None = None
    nutritional_info: str | None = None  # JSON string

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        """Validate quantity has at most 2 decimal places."""
        if v.as_tuple().exponent < -2:
            raise ValueError("Quantity can have at most 2 decimal places")
        return v

    @field_validator("expiration_date")
    @classmethod
    def validate_expiration_date(cls, v: date | None, info) -> date | None:
        """Allow expiration date even if before purchase date - warning shown in UI."""
        # Removed validation error - frontend will show warning instead
        return v


class InventoryItemCreate(InventoryItemBase):
    """Schema for creating an inventory item."""

    household_id: int


class InventoryItemUpdate(BaseModel):
    """Schema for updating an inventory item."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    quantity: Decimal | None = Field(None, gt=0)
    unit: str | None = Field(None, max_length=50)
    category_id: int | None = None
    location_id: int | None = None
    purchase_date: date | None = None
    expiration_date: date | None = None
    barcode: str | None = Field(None, max_length=100)
    brand: str | None = Field(None, max_length=200)
    image_url: str | None = None
    notes: str | None = None
    ingredients: str | None = None
    nutritional_info: str | None = None  # JSON string

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Decimal | None) -> Decimal | None:
        """Validate quantity has at most 2 decimal places."""
        if v is not None and v.as_tuple().exponent < -2:
            raise ValueError("Quantity can have at most 2 decimal places")
        return v


class InventoryItemResponse(InventoryItemBase):
    """Schema for inventory item response."""

    id: int
    household_id: int
    added_by_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemListResponse(BaseModel):
    """Schema for paginated inventory item list response."""

    items: list[InventoryItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
