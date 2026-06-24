"""Staple API routes (household assumed-on-hand ingredients)."""
from fastapi import APIRouter, HTTPException, status

from src.core.deps import CurrentUserId, DbSession
from src.core.exceptions import AlreadyExistsError, AuthorizationError, NotFoundError
from src.schemas.staple import Staple, StapleCreate
from src.services.staple_service import StapleService

router = APIRouter()


@router.post(
    "/{household_id}/staples", response_model=Staple, status_code=status.HTTP_201_CREATED
)
async def create_staple(
    household_id: int,
    staple: StapleCreate,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Create a new staple for a household."""
    service = StapleService(db)
    try:
        return await service.create_staple(user_id, household_id, staple)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except AlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{household_id}/staples", response_model=list[Staple])
async def list_staples(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
):
    """List all staples for a household."""
    service = StapleService(db)
    try:
        return await service.list_household_staples(household_id, user_id)
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/staples/{staple_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staple(
    staple_id: int,
    user_id: CurrentUserId,
    db: DbSession,
):
    """Delete a staple."""
    service = StapleService(db)
    try:
        await service.delete_staple(staple_id, user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
