"""Inventory API endpoints."""
from fastapi import APIRouter, Depends, Query, status

from src.core.deps import CurrentUserId, DbSession
from src.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemListResponse,
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


@router.get("/households/{household_id}/list", response_model=InventoryItemListResponse)
async def list_inventory(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search term for name, description, or brand"),
    category_id: int | None = Query(None, description="Filter by category ID"),
    location_id: int | None = Query(None, description="Filter by location ID"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
) -> InventoryItemListResponse:
    """List inventory items with pagination, search, and filtering."""
    inventory_service = InventoryService(db)
    items, total = await inventory_service.list_inventory(
        household_id=household_id,
        user_id=user_id,
        page=page,
        page_size=page_size,
        search=search,
        category_id=category_id,
        location_id=location_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    total_pages = (total + page_size - 1) // page_size

    return InventoryItemListResponse(
        items=[InventoryItemResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


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
