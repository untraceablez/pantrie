"""Service for managing API clients (external machine-to-machine integrations)."""
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.core.logging import setup_logging
from src.core.security import hash_password
from src.models.api_client import APIClient
from src.models.household_membership import MemberRole
from src.schemas.api_client import APIClientCreate
from src.services.household_service import HouseholdService

logger = setup_logging()


class APIClientService:
    """Create, list, and revoke household-scoped API clients (admin only)."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    @staticmethod
    def _generate_credentials() -> tuple[str, str, str]:
        """Return (client_id, plaintext_secret, secret_hash)."""
        client_id = secrets.token_hex(16)
        secret = secrets.token_urlsafe(32)
        return client_id, secret, hash_password(secret)

    async def create_client(
        self, household_id: int, user_id: int, data: APIClientCreate
    ) -> tuple[APIClient, str]:
        """Create a client; returns the model and the one-time plaintext secret."""
        await self.household_service._check_user_role(household_id, user_id, MemberRole.ADMIN)

        client_id, secret, secret_hash = self._generate_credentials()
        client = APIClient(
            household_id=household_id,
            name=data.name,
            client_id=client_id,
            client_secret_hash=secret_hash,
            permissions=data.permissions.model_dump(),
            is_active=True,
        )
        self.db.add(client)
        await self.db.commit()
        await self.db.refresh(client)

        logger.info(
            "API client created",
            household_id=household_id,
            client_id=client_id,
            created_by=user_id,
        )
        return client, secret

    async def list_clients(self, household_id: int, user_id: int) -> list[APIClient]:
        await self.household_service._check_user_role(household_id, user_id, MemberRole.ADMIN)
        result = await self.db.execute(
            select(APIClient).where(APIClient.household_id == household_id)
        )
        return list(result.scalars().all())

    async def revoke_client(self, household_id: int, user_id: int, client_pk: int) -> None:
        await self.household_service._check_user_role(household_id, user_id, MemberRole.ADMIN)
        result = await self.db.execute(
            select(APIClient).where(
                APIClient.id == client_pk, APIClient.household_id == household_id
            )
        )
        client = result.scalars().first()
        if not client:
            raise NotFoundError(message="API client not found")

        client.is_active = False
        await self.db.commit()
        logger.info(
            "API client revoked",
            household_id=household_id,
            client_id=client.client_id,
            revoked_by=user_id,
        )
