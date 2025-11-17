"""
Setup API endpoints for initial application configuration.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.schemas.setup import (
    InitialSetupRequest,
    InitialSetupResponse,
    SetupStatusResponse,
)
from src.services.setup_service import SetupService

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status(db: AsyncSession = Depends(get_db)) -> SetupStatusResponse:
    """
    Check if initial setup has been completed.

    Returns the current setup status of the application.
    """
    is_complete = await SetupService.is_setup_complete(db)

    if is_complete:
        return SetupStatusResponse(
            setup_complete=True,
            message="Application setup is complete",
        )
    else:
        return SetupStatusResponse(
            setup_complete=False,
            message="Application requires initial setup",
        )


@router.post(
    "/initialize",
    response_model=InitialSetupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def initialize_application(
    setup_data: InitialSetupRequest,
    db: AsyncSession = Depends(get_db),
) -> InitialSetupResponse:
    """
    Perform initial application setup.

    Creates the first administrator account and initial household.
    This endpoint can only be used when no users exist in the system.

    Args:
        setup_data: Initial setup configuration
        db: Database session

    Returns:
        Information about the created user and household

    Raises:
        400: If setup has already been completed
        422: If validation fails
    """
    result = await SetupService.perform_initial_setup(
        db=db,
        admin_email=setup_data.admin_email,
        admin_username=setup_data.admin_username,
        admin_password=setup_data.admin_password,
        household_name=setup_data.household_name,
        smtp_config=setup_data.smtp_config,
        proxy_config=setup_data.proxy_config,
        oauth_config=setup_data.oauth_config,
    )

    return InitialSetupResponse(**result)
