"""Allergen API routes."""
from fastapi import APIRouter, HTTPException, status

from src.core.deps import CurrentUserId, DbSession
from src.core.exceptions import AuthorizationError, NotFoundError
from src.schemas.allergen import Allergen, AllergenCreate
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
