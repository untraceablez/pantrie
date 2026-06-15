"""API client management endpoints (household admin, user-authenticated)."""
from fastapi import APIRouter, status

from src.core.deps import CurrentUserId, DbSession
from src.schemas.api_client import APIClientCreate, APIClientCreated, APIClientResponse
from src.services.api_client_service import APIClientService

router = APIRouter(prefix="/households/{household_id}/api-clients", tags=["API Clients"])


@router.post("", response_model=APIClientCreated, status_code=status.HTTP_201_CREATED)
async def create_api_client(
    household_id: int,
    data: APIClientCreate,
    user_id: CurrentUserId,
    db: DbSession,
) -> APIClientCreated:
    """Create an API client. The secret is returned exactly once."""
    service = APIClientService(db)
    client, secret = await service.create_client(household_id, user_id, data)
    return APIClientCreated(
        **APIClientResponse.model_validate(client).model_dump(),
        client_secret=secret,
    )


@router.get("", response_model=list[APIClientResponse])
async def list_api_clients(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> list[APIClientResponse]:
    """List the household's API clients (never includes secrets)."""
    service = APIClientService(db)
    clients = await service.list_clients(household_id, user_id)
    return [APIClientResponse.model_validate(c) for c in clients]


@router.delete("/{client_pk}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_client(
    household_id: int,
    client_pk: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Revoke (deactivate) an API client."""
    service = APIClientService(db)
    await service.revoke_client(household_id, user_id, client_pk)
