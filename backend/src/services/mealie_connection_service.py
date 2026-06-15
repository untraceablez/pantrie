"""Service for managing a household's outbound Mealie connection (Phase 2)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.core.security import encrypt_secret
from src.models.household_membership import MemberRole
from src.models.mealie_connection import MealieConnection
from src.schemas.mealie import MealieConnectionConfig
from src.services.household_service import HouseholdService

logger = setup_logging()


class MealieConnectionService:
    """Configure, fetch, and remove a household's Mealie connection."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def _get(self, household_id: int) -> MealieConnection | None:
        result = await self.db.execute(
            select(MealieConnection).where(MealieConnection.household_id == household_id)
        )
        return result.scalars().first()

    async def configure(
        self, household_id: int, user_id: int, config: MealieConnectionConfig
    ) -> MealieConnection:
        """Create or update the connection (admin only). API key stored encrypted."""
        await self.household_service._check_user_role(household_id, user_id, MemberRole.ADMIN)

        base_url = str(config.base_url).rstrip("/")
        api_key_enc = encrypt_secret(config.api_key)

        conn = await self._get(household_id)
        if conn:
            conn.base_url = base_url
            conn.api_key_enc = api_key_enc
            conn.is_active = True
        else:
            conn = MealieConnection(
                household_id=household_id, base_url=base_url, api_key_enc=api_key_enc
            )
            self.db.add(conn)

        await self.db.commit()
        await self.db.refresh(conn)
        logger.info("Mealie connection configured", household_id=household_id, base_url=base_url)
        return conn

    async def get(self, household_id: int, user_id: int) -> MealieConnection | None:
        """Return the connection for display (members); never exposes the key."""
        await self.household_service._check_user_role(household_id, user_id, MemberRole.VIEWER)
        return await self._get(household_id)

    async def get_active(self, household_id: int) -> MealieConnection:
        """Internal: fetch an active connection or raise (used for outbound calls)."""
        conn = await self._get(household_id)
        if not conn or not conn.is_active:
            raise NotFoundError(message="No active Mealie connection is configured")
        return conn

    async def delete(self, household_id: int, user_id: int) -> None:
        await self.household_service._check_user_role(household_id, user_id, MemberRole.ADMIN)
        conn = await self._get(household_id)
        if not conn:
            raise NotFoundError(message="No Mealie connection to remove")
        await self.db.delete(conn)
        await self.db.commit()
        logger.info("Mealie connection removed", household_id=household_id)
