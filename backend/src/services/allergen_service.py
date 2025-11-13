"""Allergen service for managing household allergens."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.models.household_allergen import HouseholdAllergen
from src.models.household_membership import MemberRole
from src.schemas.allergen import AllergenCreate
from src.services.household_service import HouseholdService

logger = setup_logging()


class AllergenService:
    """Service for allergen operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def create_allergen(
        self, user_id: int, household_id: int, allergen_data: AllergenCreate
    ) -> HouseholdAllergen:
        """Create a new allergen for a household."""
        # Check if user has at least editor role
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.EDITOR
        )

        # Create allergen
        allergen = HouseholdAllergen(
            household_id=household_id,
            name=allergen_data.name.strip().lower(),
        )

        self.db.add(allergen)
        await self.db.commit()
        await self.db.refresh(allergen)

        logger.info(
            "Allergen created",
            allergen_id=allergen.id,
            household_id=household_id,
            user_id=user_id,
            name=allergen.name,
        )
        return allergen

    async def list_household_allergens(
        self, household_id: int, user_id: int
    ) -> list[HouseholdAllergen]:
        """List all allergens for a household."""
        # Check if user has access
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        result = await self.db.execute(
            select(HouseholdAllergen)
            .where(HouseholdAllergen.household_id == household_id)
            .order_by(HouseholdAllergen.name)
        )

        return list(result.scalars().all())

    async def delete_allergen(self, allergen_id: int, user_id: int) -> None:
        """Delete an allergen."""
        # Get allergen
        result = await self.db.execute(
            select(HouseholdAllergen).where(HouseholdAllergen.id == allergen_id)
        )
        allergen = result.scalars().first()

        if not allergen:
            raise NotFoundError(
                message="Allergen not found",
                details={"allergen_id": allergen_id},
            )

        # Check if user has editor role
        await self.household_service._check_user_role(
            allergen.household_id, user_id, MemberRole.EDITOR
        )

        await self.db.delete(allergen)
        await self.db.commit()

        logger.info(
            "Allergen deleted",
            allergen_id=allergen_id,
            household_id=allergen.household_id,
            user_id=user_id,
        )
