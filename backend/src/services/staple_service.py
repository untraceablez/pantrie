"""Staple service for managing a household's assumed-on-hand ingredients."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AlreadyExistsError, NotFoundError
from src.core.logging import setup_logging
from src.models.household_membership import MemberRole
from src.models.household_staple import HouseholdStaple
from src.schemas.staple import StapleCreate
from src.services.household_service import HouseholdService

logger = setup_logging()

# Seeded for every household; users can add/remove afterwards.
DEFAULT_STAPLES = ["water"]


class StapleService:
    """Service for household staple operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    @staticmethod
    def _normalize(name: str) -> str:
        return name.strip().lower()

    async def seed_default_staples(self, household_id: int) -> None:
        """Add the default staples (``water``) to a household.

        Caller is responsible for flush/commit. Idempotent: skips names that are
        already present so re-running (or the migration backfill) never
        duplicates.
        """
        existing = await self._staple_names(household_id)
        for name in DEFAULT_STAPLES:
            if name not in existing:
                self.db.add(HouseholdStaple(household_id=household_id, name=name))

    async def _staple_names(self, household_id: int) -> set[str]:
        result = await self.db.execute(
            select(HouseholdStaple.name).where(
                HouseholdStaple.household_id == household_id
            )
        )
        return set(result.scalars().all())

    async def create_staple(
        self, user_id: int, household_id: int, staple_data: StapleCreate
    ) -> HouseholdStaple:
        """Create a new staple for a household (editor+)."""
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.EDITOR
        )

        name = self._normalize(staple_data.name)
        if name in await self._staple_names(household_id):
            raise AlreadyExistsError(
                message="Staple already exists",
                details={"name": name},
            )

        staple = HouseholdStaple(household_id=household_id, name=name)
        self.db.add(staple)
        await self.db.commit()
        await self.db.refresh(staple)

        logger.info(
            "Staple created",
            staple_id=staple.id,
            household_id=household_id,
            user_id=user_id,
            name=staple.name,
        )
        return staple

    async def list_household_staples(
        self, household_id: int, user_id: int
    ) -> list[HouseholdStaple]:
        """List all staples for a household (viewer+)."""
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        result = await self.db.execute(
            select(HouseholdStaple)
            .where(HouseholdStaple.household_id == household_id)
            .order_by(HouseholdStaple.name)
        )
        return list(result.scalars().all())

    async def delete_staple(self, staple_id: int, user_id: int) -> None:
        """Delete a staple (editor+)."""
        result = await self.db.execute(
            select(HouseholdStaple).where(HouseholdStaple.id == staple_id)
        )
        staple = result.scalars().first()

        if not staple:
            raise NotFoundError(
                message="Staple not found",
                details={"staple_id": staple_id},
            )

        await self.household_service._check_user_role(
            staple.household_id, user_id, MemberRole.EDITOR
        )

        await self.db.delete(staple)
        await self.db.commit()

        logger.info(
            "Staple deleted",
            staple_id=staple_id,
            household_id=staple.household_id,
            user_id=user_id,
        )
