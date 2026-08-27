"""Allergen API routes."""
from fastapi import APIRouter, HTTPException, status

from src.core.deps import CurrentUserId, DbSession
from src.core.exceptions import AuthorizationError, NotFoundError
from src.schemas.allergen import (
    Allergen,
    AllergenCheckRequest,
    AllergenCheckResponse,
    AllergenCreate,
    InventoryAllergenMatchesResponse,
)
from src.services.allergen_service import AllergenService

router = APIRouter()


@router.post("/{household_id}/allergens", response_model=Allergen, status_code=status.HTTP_201_CREATED)
async def create_allergen(
    household_id: int,
    allergen: AllergenCreate,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Create a new allergen for a household."""
    service = AllergenService(db)
    try:
        return await service.create_allergen(user_id, household_id, allergen)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{household_id}/allergens", response_model=list[Allergen])
async def list_allergens(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
):
    """List all allergens for a household."""
    service = AllergenService(db)
    try:
        return await service.list_household_allergens(household_id, user_id)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get(
    "/{household_id}/allergens/inventory-matches",
    response_model=InventoryAllergenMatchesResponse,
)
async def list_inventory_allergen_matches(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Flag every stored inventory item whose ingredients hit a household allergen.

    One household-wide call rather than one per item, so a list view can flag
    all of its cards without an N+1 of lookups. Items with no match are omitted.
    """
    service = AllergenService(db)
    try:
        matches = await service.match_inventory_items(household_id, user_id)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return InventoryAllergenMatchesResponse(matches=matches)


@router.post("/{household_id}/allergens/check", response_model=AllergenCheckResponse)
async def check_allergens(
    household_id: int,
    body: AllergenCheckRequest,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Check free text (e.g. an add/edit form's ingredients) for household allergens."""
    service = AllergenService(db)
    try:
        results = await service.check_texts(household_id, user_id, body.texts)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return AllergenCheckResponse(results=results)


@router.delete("/allergens/{allergen_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_allergen(
    allergen_id: int,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Delete an allergen."""
    service = AllergenService(db)
    try:
        await service.delete_allergen(allergen_id, user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
