"""Inventory API endpoints."""
from fastapi import APIRouter, Depends, status

from src.core.deps import CurrentUserId, DbSession
from src.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
)
from src.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_data: InventoryItemCreate,
    user_id: CurrentUserId,
    db: DbSession,
) -> InventoryItemResponse:
    """Create a new inventory item."""
    inventory_service = InventoryService(db)
    item = await inventory_service.create_item(user_id, item_data)
    return InventoryItemResponse.model_validate(item)


@router.get("/households/{household_id}", response_model=list[InventoryItemResponse])
async def list_household_items(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> list[InventoryItemResponse]:
    """List all inventory items for a household."""
    inventory_service = InventoryService(db)
    items = await inventory_service.list_household_items(household_id, user_id)
    return [InventoryItemResponse.model_validate(item) for item in items]


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_item(
    item_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> InventoryItemResponse:
    """Get inventory item by ID."""
    inventory_service = InventoryService(db)
    item = await inventory_service.get_item_by_id(item_id, user_id)
    return InventoryItemResponse.model_validate(item)


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: int,
    update_data: InventoryItemUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> InventoryItemResponse:
    """Update inventory item."""
    inventory_service = InventoryService(db)
    item = await inventory_service.update_item(item_id, user_id, update_data)
    return InventoryItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Delete inventory item."""
    inventory_service = InventoryService(db)
    await inventory_service.delete_item(item_id, user_id)
