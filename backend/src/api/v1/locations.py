"""Location API endpoints."""
from fastapi import APIRouter, Depends, status

from src.core.deps import CurrentUserId, DbSession
from src.schemas.location import (
    LocationCreate,
    LocationResponse,
    LocationUpdate,
)
from src.services.location_service import LocationService

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    user_id: CurrentUserId,
    db: DbSession,
) -> LocationResponse:
    """Create a new location."""
    location_service = LocationService(db)
    location = await location_service.create_location(user_id, location_data)
    return LocationResponse.model_validate(location)


@router.get("/households/{household_id}", response_model=list[LocationResponse])
async def list_household_locations(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> list[LocationResponse]:
    """List all locations for a household."""
    location_service = LocationService(db)
    locations = await location_service.list_household_locations(household_id, user_id)
    return [LocationResponse.model_validate(location) for location in locations]


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> LocationResponse:
    """Get location by ID."""
    location_service = LocationService(db)
    location = await location_service.get_location_by_id(location_id, user_id)
    return LocationResponse.model_validate(location)


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: int,
    update_data: LocationUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> LocationResponse:
    """Update location."""
    location_service = LocationService(db)
    location = await location_service.update_location(location_id, user_id, update_data)
    return LocationResponse.model_validate(location)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Delete location."""
    location_service = LocationService(db)
    await location_service.delete_location(location_id, user_id)
