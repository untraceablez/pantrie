"""Dashboard API endpoints."""
from decimal import Decimal

from fastapi import APIRouter, Query

from src.core.deps import CurrentUserId, DbSession
from src.schemas.dashboard import DashboardSummaryResponse
from src.services.dashboard_service import (
    DEFAULT_EXPIRING_WITHIN_DAYS,
    DEFAULT_LOW_STOCK_THRESHOLD,
    DEFAULT_RECENT_LIMIT,
    DashboardService,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/households/{household_id}/summary")
async def get_household_summary(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
    expiring_within_days: int = Query(
        DEFAULT_EXPIRING_WITHIN_DAYS,
        ge=0,
        le=365,
        description="Horizon in days for the 'expiring soon' count",
    ),
    low_stock_threshold: Decimal = Query(
        DEFAULT_LOW_STOCK_THRESHOLD,
        ge=0,
        description="Quantity at or below which an item counts as low stock",
    ),
    recent_limit: int = Query(
        DEFAULT_RECENT_LIMIT,
        ge=1,
        le=50,
        description="How many recently added items to return",
    ),
) -> DashboardSummaryResponse:
    """Aggregated inventory health for a household."""
    dashboard_service = DashboardService(db)
    return await dashboard_service.get_summary(
        household_id=household_id,
        user_id=user_id,
        expiring_within_days=expiring_within_days,
        low_stock_threshold=low_stock_threshold,
        recent_limit=recent_limit,
    )
