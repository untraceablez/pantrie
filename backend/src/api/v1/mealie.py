"""User-facing Mealie endpoints: connection config + recipe makeability (Phase 2)."""
from fastapi import APIRouter, status

from src.core.deps import CurrentUserId, DbSession
from src.core.exceptions import NotFoundError
from src.core.security import decrypt_secret
from src.schemas.mealie import (
    MealieConnectionConfig,
    MealieConnectionResponse,
    RecipesResponse,
    ShoppingListPushRequest,
    ShoppingListPushResult,
    ShoppingListsResponse,
)
from src.services.mealie_client_service import MealieClientService
from src.services.mealie_connection_service import MealieConnectionService
from src.services.mealie_query_service import MealieQueryService

router = APIRouter(prefix="/households/{household_id}/mealie", tags=["Mealie"])

_NO_ACTIVE_CONNECTION = "No active Mealie connection is configured"


@router.put("/connection", response_model=MealieConnectionResponse)
async def configure_connection(
    household_id: int,
    config: MealieConnectionConfig,
    user_id: CurrentUserId,
    db: DbSession,
) -> MealieConnectionResponse:
    """Configure (create or update) the household's Mealie connection (admin only)."""
    conn = await MealieConnectionService(db).configure(household_id, user_id, config)
    return MealieConnectionResponse.model_validate(conn)


@router.get("/connection", response_model=MealieConnectionResponse)
async def get_connection(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> MealieConnectionResponse:
    """Get the household's Mealie connection (never returns the API key)."""
    conn = await MealieConnectionService(db).get(household_id, user_id)
    if not conn:
        raise NotFoundError(message="No Mealie connection is configured")
    return MealieConnectionResponse.model_validate(conn)


@router.delete("/connection", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Remove the household's Mealie connection (admin only)."""
    await MealieConnectionService(db).delete(household_id, user_id)


@router.get("/recipes", response_model=RecipesResponse)
async def list_recipes(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> RecipesResponse:
    """Fetch recipes from the configured Mealie instance, annotated with makeability."""
    conn_service = MealieConnectionService(db)
    # Membership is enforced here; raises if the user isn't a member.
    conn = await conn_service.get(household_id, user_id)
    if not conn or not conn.is_active:
        raise NotFoundError(message=_NO_ACTIVE_CONNECTION)

    client = MealieClientService(conn.base_url, decrypt_secret(conn.api_key_enc))
    recipes = await client.fetch_recipes_with_ingredients()
    annotated = await MealieQueryService(db).annotate_makeability(household_id, recipes)
    return RecipesResponse(recipes=annotated)


@router.get("/shopping-lists")
async def list_shopping_lists(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> ShoppingListsResponse:
    """List the household's Mealie shopping lists (for choosing a push target)."""
    conn_service = MealieConnectionService(db)
    conn = await conn_service.get(household_id, user_id)
    if not conn or not conn.is_active:
        raise NotFoundError(message=_NO_ACTIVE_CONNECTION)

    client = MealieClientService(conn.base_url, decrypt_secret(conn.api_key_enc))
    lists = await client.list_shopping_lists()
    return ShoppingListsResponse(lists=lists)


@router.post("/shopping-list", response_model=ShoppingListPushResult)
async def push_to_shopping_list(
    household_id: int,
    body: ShoppingListPushRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> ShoppingListPushResult:
    """Add ingredients (e.g. a recipe's missing items) to a Mealie shopping list.

    The target is ``create_list_name`` (a new list), else ``list_id``, else the
    first list.
    """
    conn_service = MealieConnectionService(db)
    conn = await conn_service.get(household_id, user_id)
    if not conn or not conn.is_active:
        raise NotFoundError(message=_NO_ACTIVE_CONNECTION)

    client = MealieClientService(conn.base_url, decrypt_secret(conn.api_key_enc))

    target_list_id = body.list_id
    if body.create_list_name:
        new_list = await client.create_shopping_list(body.create_list_name)
        target_list_id = new_list["id"]

    results = await client.add_to_shopping_list(body.items, list_id=target_list_id)
    return ShoppingListPushResult(
        requested=len(body.items),
        added=sum(1 for r in results if r["added"]),
        updated=sum(1 for r in results if r.get("updated")),
        items=results,
    )
