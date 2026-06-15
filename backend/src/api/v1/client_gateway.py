"""Client-facing gateway: token exchange + inventory queries (Mealie integration)."""
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from src.core.deps import DbSession, require_client_scope
from src.core.rate_limit import enforce_client_rate_limit
from src.models.api_client import APIClient
from src.schemas.api_client import TokenRequest, TokenResponse
from src.schemas.mealie import (
    AvailabilityResult,
    BulkAvailabilityRequest,
    BulkAvailabilityResponse,
    DecrementRequest,
    DecrementResult,
    IngredientQuery,
)
from src.services.client_auth_service import ClientAuthService
from src.services.mealie_query_service import MealieQueryService

router = APIRouter(prefix="/clients", tags=["Client Gateway"])


@router.post("/token", response_model=TokenResponse)
async def issue_token(body: TokenRequest, db: DbSession) -> TokenResponse:
    """Exchange client credentials for a short-lived access token."""
    service = ClientAuthService(db)
    return await service.issue_token(body.client_id, body.client_secret)


@router.get(
    "/inventory/availability",
    response_model=AvailabilityResult,
    dependencies=[Depends(enforce_client_rate_limit)],
)
async def check_single_availability(
    db: DbSession,
    name: str = Query(...),
    amount: Decimal | None = Query(None),
    unit: str | None = Query(None),
    client: APIClient = Depends(require_client_scope("read")),
) -> AvailabilityResult:
    """Check availability of a single ingredient by name."""
    service = MealieQueryService(db)
    [result] = await service.check_availability(
        client.household_id, [IngredientQuery(name=name, amount=amount, unit=unit)]
    )
    return result


@router.post(
    "/inventory/availability",
    response_model=BulkAvailabilityResponse,
    dependencies=[Depends(enforce_client_rate_limit)],
)
async def check_bulk_availability(
    body: BulkAvailabilityRequest,
    db: DbSession,
    client: APIClient = Depends(require_client_scope("read")),
) -> BulkAvailabilityResponse:
    """Check availability of multiple ingredients in one request."""
    service = MealieQueryService(db)
    results = await service.check_availability(client.household_id, body.ingredients)
    return BulkAvailabilityResponse(results=results)


@router.post(
    "/inventory/{item_id}/decrement",
    response_model=DecrementResult,
    dependencies=[Depends(enforce_client_rate_limit)],
)
async def decrement_item(
    item_id: int,
    body: DecrementRequest,
    db: DbSession,
    client: APIClient = Depends(require_client_scope("write")),
) -> DecrementResult:
    """Decrement an item's quantity (clamped to zero; write scope required)."""
    service = MealieQueryService(db)
    return await service.decrement_item(client.household_id, item_id, body.amount)
