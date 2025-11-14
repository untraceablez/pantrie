"""Household service for managing households and memberships."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AlreadyExistsError, AuthorizationError, NotFoundError
from src.core.logging import setup_logging
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.user import User
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

    async def list_household_members(self, household_id: int, user_id: int) -> list[dict]:
        """List all members of a household with their roles."""
        # Check if user is a member of the household
        await self._check_user_role(household_id, user_id, MemberRole.VIEWER)

        # Get all members
        result = await self.db.execute(
            select(HouseholdMembership, User)
            .join(User, HouseholdMembership.user_id == User.id)
            .where(HouseholdMembership.household_id == household_id)
        )

        members = []
        for membership, user in result.all():
            members.append({
                "id": membership.id,
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "role": membership.role.value,
                "joined_at": membership.created_at,
            })

        return members

    async def add_household_member(
        self, household_id: int, admin_id: int, user_email: str, role: MemberRole
    ) -> dict:
        """Add a new member to the household (admin only)."""
        # Check if requester is admin
        await self._check_user_role(household_id, admin_id, MemberRole.ADMIN)

        # Find user by email
        result = await self.db.execute(select(User).where(User.email == user_email))
        user = result.scalars().first()

        if not user:
            raise NotFoundError(
                message="User not found with this email",
                details={"email": user_email},
            )

        # Check if user is already a member
        result = await self.db.execute(
            select(HouseholdMembership).where(
                HouseholdMembership.household_id == household_id,
                HouseholdMembership.user_id == user.id,
            )
        )
        existing = result.scalars().first()

        if existing:
            raise AlreadyExistsError(
                message="User is already a member of this household",
                details={"email": user_email},
            )

        # Create membership
        membership = HouseholdMembership(
            user_id=user.id,
            household_id=household_id,
            role=role,
        )
        self.db.add(membership)
        await self.db.commit()
        await self.db.refresh(membership)

        logger.info(
            "Member added to household",
            household_id=household_id,
            user_id=user.id,
            role=role.value,
        )

        return {
            "id": membership.id,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": role.value,
            "joined_at": membership.created_at,
        }

    async def update_member_role(
        self, household_id: int, admin_id: int, membership_id: int, new_role: MemberRole
    ) -> dict:
        """Update a member's role in the household (admin only)."""
        # Check if requester is admin
        await self._check_user_role(household_id, admin_id, MemberRole.ADMIN)

        # Get membership
        result = await self.db.execute(
            select(HouseholdMembership).where(HouseholdMembership.id == membership_id)
        )
        membership = result.scalars().first()

        if not membership:
            raise NotFoundError(
                message="Membership not found",
                details={"membership_id": membership_id},
            )

        if membership.household_id != household_id:
            raise AuthorizationError(message="Membership does not belong to this household")

        # Don't allow changing own role
        if membership.user_id == admin_id:
            raise AuthorizationError(message="You cannot change your own role")

        # Update role
        membership.role = new_role
        await self.db.commit()
        await self.db.refresh(membership)

        # Get user details
        result = await self.db.execute(select(User).where(User.id == membership.user_id))
        user = result.scalars().first()

        logger.info(
            "Member role updated",
            household_id=household_id,
            membership_id=membership_id,
            new_role=new_role.value,
        )

        return {
            "id": membership.id,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": new_role.value,
            "joined_at": membership.created_at,
        }

    async def remove_household_member(
        self, household_id: int, admin_id: int, membership_id: int
    ) -> None:
        """Remove a member from the household (admin only)."""
        # Check if requester is admin
        await self._check_user_role(household_id, admin_id, MemberRole.ADMIN)

        # Get membership
        result = await self.db.execute(
            select(HouseholdMembership).where(HouseholdMembership.id == membership_id)
        )
        membership = result.scalars().first()

        if not membership:
            raise NotFoundError(
                message="Membership not found",
                details={"membership_id": membership_id},
            )

        if membership.household_id != household_id:
            raise AuthorizationError(message="Membership does not belong to this household")

        # Don't allow removing yourself
        if membership.user_id == admin_id:
            raise AuthorizationError(message="You cannot remove yourself from the household")

        await self.db.delete(membership)
        await self.db.commit()

        logger.info(
            "Member removed from household",
            household_id=household_id,
            membership_id=membership_id,
        )
