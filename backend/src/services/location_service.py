"""Location service for managing storage locations."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.models.household_membership import MemberRole
from src.models.location import Location
from src.schemas.location import LocationCreate, LocationUpdate
from src.services.household_service import HouseholdService

logger = setup_logging()


class LocationService:
    """Service for location operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def create_location(
        self, user_id: int, location_data: LocationCreate
    ) -> Location:
        """Create a new location."""
        # Check if user has at least editor role
        await self.household_service._check_user_role(
            location_data.household_id, user_id, MemberRole.EDITOR
        )

        # Create location
        location = Location(
            household_id=location_data.household_id,
            name=location_data.name,
            description=location_data.description,
            icon=location_data.icon,
        )

        self.db.add(location)
        await self.db.commit()
        await self.db.refresh(location)

        logger.info(
            "Location created",
            location_id=location.id,
            household_id=location.household_id,
            user_id=user_id,
            name=location.name,
        )
        return location

    async def get_location_by_id(
        self, location_id: int, user_id: int
    ) -> Location:
        """Get location by ID."""
        result = await self.db.execute(
            select(Location).where(Location.id == location_id)
        )
        location = result.scalars().first()

        if not location:
            raise NotFoundError(
                message="Location not found",
                details={"location_id": location_id},
            )

        # Check if user has access to this household
        await self.household_service._check_user_role(
            location.household_id, user_id, MemberRole.VIEWER
        )

        return location

    async def list_household_locations(
        self, household_id: int, user_id: int
    ) -> list[Location]:
        """List all locations for a household."""
        # Check if user has access
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        result = await self.db.execute(
            select(Location)
            .where(Location.household_id == household_id)
            .order_by(Location.name.asc())
        )

        return list(result.scalars().all())

    async def update_location(
        self, location_id: int, user_id: int, update_data: LocationUpdate
    ) -> Location:
        """Update location."""
        # Get location
        result = await self.db.execute(
            select(Location).where(Location.id == location_id)
        )
        location = result.scalars().first()

        if not location:
            raise NotFoundError(
                message="Location not found",
                details={"location_id": location_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            location.household_id, user_id, MemberRole.EDITOR
        )

        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(location, field, value)

        await self.db.commit()
        await self.db.refresh(location)

        logger.info(
            "Location updated",
            location_id=location_id,
            household_id=location.household_id,
            user_id=user_id,
        )
        return location

    async def delete_location(self, location_id: int, user_id: int) -> None:
        """Delete location."""
        # Get location
        result = await self.db.execute(
            select(Location).where(Location.id == location_id)
        )
        location = result.scalars().first()

        if not location:
            raise NotFoundError(
                message="Location not found",
                details={"location_id": location_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            location.household_id, user_id, MemberRole.EDITOR
        )

        await self.db.delete(location)
        await self.db.commit()

        logger.info(
            "Location deleted",
            location_id=location_id,
            household_id=location.household_id,
            user_id=user_id,
        )
