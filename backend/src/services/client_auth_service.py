"""Authentication for API clients (client-credentials grant)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AuthenticationError
from src.core.logging import setup_logging
from src.core.security import create_client_token, verify_password
from src.models.api_client import APIClient
from src.schemas.api_client import TokenResponse

logger = setup_logging()


def scopes_from_permissions(permissions: dict[str, bool]) -> list[str]:
    """Convert a permissions mapping to a list of granted scope names."""
    return [scope for scope in ("read", "write", "delete") if permissions.get(scope)]


class ClientAuthService:
    """Verify client credentials and issue access tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, client_id: str, client_secret: str) -> APIClient:
        result = await self.db.execute(
            select(APIClient).where(APIClient.client_id == client_id)
        )
        client = result.scalars().first()

        if not client or not client.is_active:
            logger.warning("Client auth failed: unknown or inactive", client_id=client_id)
            raise AuthenticationError(message="Invalid client credentials")

        if not verify_password(client_secret, client.client_secret_hash):
            logger.warning("Client auth failed: bad secret", client_id=client_id)
            raise AuthenticationError(message="Invalid client credentials")

        return client

    async def issue_token(self, client_id: str, client_secret: str) -> TokenResponse:
        client = await self.authenticate(client_id, client_secret)
        scopes = scopes_from_permissions(client.permissions)
        token, expires_in = create_client_token(client.client_id, client.household_id, scopes)
        logger.info("Client token issued", client_id=client_id, household_id=client.household_id)
        return TokenResponse(access_token=token, expires_in=expires_in, scopes=scopes)
