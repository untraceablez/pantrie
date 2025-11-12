"""Household service for managing households and memberships."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AuthorizationError, NotFoundError
from src.core.logging import setup_logging
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.schemas.household import HouseholdCreate, HouseholdUpdate, HouseholdWithMembership

logger = setup_logging()


class HouseholdService:
    """Service for household operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_household(self, user_id: int, household_data: HouseholdCreate) -> Household:
        """Create a new household with the creator as admin."""
        # Create household
        household = Household(
            name=household_data.name,
            description=household_data.description,
        )
        self.db.add(household)
        await self.db.flush()

        # Add creator as admin
        membership = HouseholdMembership(
            user_id=user_id,
            household_id=household.id,
            role=MemberRole.ADMIN,
        )
        self.db.add(membership)

        await self.db.commit()
        await self.db.refresh(household)

        logger.info(
            "Household created",
            household_id=household.id,
            name=household.name,
            creator_id=user_id,
        )
        return household

    async def get_household_by_id(self, household_id: int, user_id: int) -> HouseholdWithMembership:
        """Get household by ID with user's membership role."""
        # Get household
        result = await self.db.execute(select(Household).where(Household.id == household_id))
        household = result.scalars().first()

        if not household:
            raise NotFoundError(
                message="Household not found",
                details={"household_id": household_id},
            )

        # Get user's membership
        result = await self.db.execute(
            select(HouseholdMembership).where(
                HouseholdMembership.household_id == household_id,
                HouseholdMembership.user_id == user_id,
            )
        )
        membership = result.scalars().first()

        if not membership:
            raise AuthorizationError(
                message="You are not a member of this household",
                details={"household_id": household_id},
            )

        # Convert to response schema
        return HouseholdWithMembership(
            id=household.id,
            name=household.name,
            description=household.description,
            created_at=household.created_at,
            updated_at=household.updated_at,
            user_role=membership.role,
        )

    async def list_user_households(self, user_id: int) -> list[HouseholdWithMembership]:
        """List all households the user is a member of."""
        result = await self.db.execute(
            select(Household, HouseholdMembership.role)
            .join(HouseholdMembership, Household.id == HouseholdMembership.household_id)
            .where(HouseholdMembership.user_id == user_id)
        )

        households = []
        for household, role in result.all():
            households.append(
                HouseholdWithMembership(
                    id=household.id,
                    name=household.name,
                    description=household.description,
                    created_at=household.created_at,
                    updated_at=household.updated_at,
                    user_role=role,
                )
            )

        return households

    async def update_household(
        self, household_id: int, user_id: int, update_data: HouseholdUpdate
    ) -> Household:
        """Update household information (admin only)."""
        # Check if user is admin
        await self._check_user_role(household_id, user_id, MemberRole.ADMIN)

        # Get household
        result = await self.db.execute(select(Household).where(Household.id == household_id))
        household = result.scalars().first()

        if not household:
            raise NotFoundError(
                message="Household not found",
                details={"household_id": household_id},
            )

        # Update fields
        if update_data.name is not None:
            household.name = update_data.name
        if update_data.description is not None:
            household.description = update_data.description

        await self.db.commit()
        await self.db.refresh(household)

        logger.info("Household updated", household_id=household_id, user_id=user_id)
        return household

    async def delete_household(self, household_id: int, user_id: int) -> None:
        """Delete household (admin only)."""
        # Check if user is admin
        await self._check_user_role(household_id, user_id, MemberRole.ADMIN)

        # Get household
        result = await self.db.execute(select(Household).where(Household.id == household_id))
        household = result.scalars().first()

        if not household:
            raise NotFoundError(
                message="Household not found",
                details={"household_id": household_id},
            )

        await self.db.delete(household)
        await self.db.commit()

        logger.info("Household deleted", household_id=household_id, user_id=user_id)

    async def _check_user_role(
        self, household_id: int, user_id: int, required_role: MemberRole
    ) -> None:
        """Check if user has required role in household."""
        result = await self.db.execute(
            select(HouseholdMembership).where(
                HouseholdMembership.household_id == household_id,
                HouseholdMembership.user_id == user_id,
            )
        )
        membership = result.scalars().first()

        if not membership:
            raise AuthorizationError(message="You are not a member of this household")

        # Define role hierarchy: admin > editor > viewer
        role_hierarchy = {MemberRole.ADMIN: 3, MemberRole.EDITOR: 2, MemberRole.VIEWER: 1}

        if role_hierarchy[membership.role] < role_hierarchy[required_role]:
            raise AuthorizationError(
                message=f"You need {required_role.value} role to perform this action"
            )
