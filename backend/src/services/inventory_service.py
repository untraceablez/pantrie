"""Inventory service for managing inventory items."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AuthorizationError, NotFoundError
from src.core.logging import setup_logging
from src.models.household_membership import MemberRole
from src.models.inventory_item import InventoryItem
from src.schemas.inventory import InventoryItemCreate, InventoryItemUpdate
from src.services.household_service import HouseholdService

logger = setup_logging()


class InventoryService:
    """Service for inventory operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def create_item(
        self, user_id: int, item_data: InventoryItemCreate
    ) -> InventoryItem:
        """Create a new inventory item."""
        # Check if user has at least editor role
        await self.household_service._check_user_role(
            item_data.household_id, user_id, MemberRole.EDITOR
        )

        # Create inventory item
        item = InventoryItem(
            household_id=item_data.household_id,
            added_by_user_id=user_id,
            name=item_data.name,
            description=item_data.description,
            quantity=item_data.quantity,
            unit=item_data.unit,
            category_id=item_data.category_id,
            location_id=item_data.location_id,
            purchase_date=item_data.purchase_date,
            expiration_date=item_data.expiration_date,
            barcode=item_data.barcode,
            brand=item_data.brand,
            image_url=item_data.image_url,
            notes=item_data.notes,
        )

        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)

        logger.info(
            "Inventory item created",
            item_id=item.id,
            household_id=item.household_id,
            user_id=user_id,
            name=item.name,
        )
        return item

    async def get_item_by_id(
        self, item_id: int, user_id: int
    ) -> InventoryItem:
        """Get inventory item by ID."""
        result = await self.db.execute(
            select(InventoryItem).where(InventoryItem.id == item_id)
        )
        item = result.scalars().first()

        if not item:
            raise NotFoundError(
                message="Inventory item not found",
                details={"item_id": item_id},
            )

        # Check if user has access to this household
        await self.household_service._check_user_role(
            item.household_id, user_id, MemberRole.VIEWER
        )

        return item

    async def update_item(
        self, item_id: int, user_id: int, update_data: InventoryItemUpdate
    ) -> InventoryItem:
        """Update inventory item."""
        # Get item
        result = await self.db.execute(
            select(InventoryItem).where(InventoryItem.id == item_id)
        )
        item = result.scalars().first()

        if not item:
            raise NotFoundError(
                message="Inventory item not found",
                details={"item_id": item_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            item.household_id, user_id, MemberRole.EDITOR
        )

        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(item, field, value)

        await self.db.commit()
        await self.db.refresh(item)

        logger.info(
            "Inventory item updated",
            item_id=item_id,
            household_id=item.household_id,
            user_id=user_id,
        )
        return item

    async def delete_item(self, item_id: int, user_id: int) -> None:
        """Delete inventory item."""
        # Get item
        result = await self.db.execute(
            select(InventoryItem).where(InventoryItem.id == item_id)
        )
        item = result.scalars().first()

        if not item:
            raise NotFoundError(
                message="Inventory item not found",
                details={"item_id": item_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            item.household_id, user_id, MemberRole.EDITOR
        )

        await self.db.delete(item)
        await self.db.commit()

        logger.info(
            "Inventory item deleted",
            item_id=item_id,
            household_id=item.household_id,
            user_id=user_id,
        )

    async def list_household_items(
        self, household_id: int, user_id: int
    ) -> list[InventoryItem]:
        """List all inventory items for a household."""
        # Check if user has access
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        result = await self.db.execute(
            select(InventoryItem)
            .where(InventoryItem.household_id == household_id)
            .order_by(InventoryItem.created_at.desc())
        )

        return list(result.scalars().all())
