"""Dashboard service: aggregate inventory health for a household.

Deliberately separate from ``InventoryService`` — this is read-only aggregation
over ``inventory_items`` and has no CRUD concerns.
"""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import setup_logging
from src.models.category import Category
from src.models.household_membership import MemberRole
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.schemas.dashboard import (
    CategoryBreakdown,
    DashboardCounts,
    DashboardSummaryResponse,
    LocationBreakdown,
)
from src.schemas.inventory import InventoryItemResponse
from src.services.household_service import HouseholdService

logger = setup_logging()

# Defaults shared with the API layer so the router and the service agree.
DEFAULT_EXPIRING_WITHIN_DAYS = 7
DEFAULT_LOW_STOCK_THRESHOLD = Decimal("1")
DEFAULT_RECENT_LIMIT = 5

# Label used for the bucket of items with no location / category assigned.
UNASSIGNED_LABEL = "Unassigned"


class DashboardService:
    """Service for household dashboard aggregations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.household_service = HouseholdService(db)

    async def get_summary(
        self,
        household_id: int,
        user_id: int,
        expiring_within_days: int = DEFAULT_EXPIRING_WITHIN_DAYS,
        low_stock_threshold: Decimal = DEFAULT_LOW_STOCK_THRESHOLD,
        recent_limit: int = DEFAULT_RECENT_LIMIT,
        today: date | None = None,
    ) -> DashboardSummaryResponse:
        """Build the dashboard summary for a household.

        Args:
            household_id: Household to summarise.
            user_id: User making the request (must be a member).
            expiring_within_days: Horizon, in days, for the "expiring soon" count.
            low_stock_threshold: Quantity at or below which an item is low stock.
            recent_limit: How many recently added items to include.
            today: Reference date; defaults to the current date (injectable for tests).

        Returns:
            The populated :class:`DashboardSummaryResponse`.

        Raises:
            AuthorizationError: If the user is not a member of the household.
        """
        await self.household_service._check_user_role(
            household_id, user_id, MemberRole.VIEWER
        )

        reference_date = today or date.today()

        counts = await self._get_counts(
            household_id, reference_date, expiring_within_days, low_stock_threshold
        )
        by_location = await self._get_location_breakdown(household_id)
        by_category = await self._get_category_breakdown(household_id)
        recently_added = await self._get_recently_added(household_id, recent_limit)

        logger.info(
            "Dashboard summary generated",
            household_id=household_id,
            user_id=user_id,
            total_items=counts.total_items,
            expired=counts.expired,
            expiring_soon=counts.expiring_soon,
            low_stock=counts.low_stock,
        )

        return DashboardSummaryResponse(
            household_id=household_id,
            generated_on=reference_date,
            expiring_within_days=expiring_within_days,
            low_stock_threshold=low_stock_threshold,
            counts=counts,
            by_location=by_location,
            by_category=by_category,
            recently_added=recently_added,
        )

    async def _get_counts(
        self,
        household_id: int,
        reference_date: date,
        expiring_within_days: int,
        low_stock_threshold: Decimal,
    ) -> DashboardCounts:
        """Compute every headline count in a single aggregate query."""
        horizon = reference_date + timedelta(days=expiring_within_days)
        expiration = InventoryItem.expiration_date

        result = await self.db.execute(
            select(
                func.count().label("total_items"),
                func.count()
                .filter(and_(expiration.is_not(None), expiration < reference_date))
                .label("expired"),
                func.count()
                .filter(
                    and_(
                        expiration.is_not(None),
                        expiration >= reference_date,
                        expiration <= horizon,
                    )
                )
                .label("expiring_soon"),
                func.count()
                .filter(InventoryItem.quantity <= low_stock_threshold)
                .label("low_stock"),
                func.count().filter(expiration.is_(None)).label("no_expiration_date"),
            ).where(InventoryItem.household_id == household_id)
        )
        row = result.one()

        return DashboardCounts(
            total_items=row.total_items,
            expired=row.expired,
            expiring_soon=row.expiring_soon,
            low_stock=row.low_stock,
            no_expiration_date=row.no_expiration_date,
        )

    async def _get_location_breakdown(
        self, household_id: int
    ) -> list[LocationBreakdown]:
        """Item counts grouped by storage location (largest bucket first)."""
        item_count = func.count(InventoryItem.id).label("item_count")
        result = await self.db.execute(
            select(InventoryItem.location_id, Location.name, Location.icon, item_count)
            .select_from(InventoryItem)
            .outerjoin(Location, Location.id == InventoryItem.location_id)
            .where(InventoryItem.household_id == household_id)
            .group_by(InventoryItem.location_id, Location.name, Location.icon)
            .order_by(item_count.desc(), Location.name.asc())
        )

        return [
            LocationBreakdown(
                location_id=row.location_id,
                name=row.name or UNASSIGNED_LABEL,
                icon=row.icon,
                item_count=row.item_count,
            )
            for row in result.all()
        ]

    async def _get_category_breakdown(
        self, household_id: int
    ) -> list[CategoryBreakdown]:
        """Item counts grouped by category (largest bucket first)."""
        item_count = func.count(InventoryItem.id).label("item_count")
        result = await self.db.execute(
            select(InventoryItem.category_id, Category.name, Category.icon, item_count)
            .select_from(InventoryItem)
            .outerjoin(Category, Category.id == InventoryItem.category_id)
            .where(InventoryItem.household_id == household_id)
            .group_by(InventoryItem.category_id, Category.name, Category.icon)
            .order_by(item_count.desc(), Category.name.asc())
        )

        return [
            CategoryBreakdown(
                category_id=row.category_id,
                name=row.name or UNASSIGNED_LABEL,
                icon=row.icon,
                item_count=row.item_count,
            )
            for row in result.all()
        ]

    async def _get_recently_added(
        self, household_id: int, limit: int
    ) -> list[InventoryItemResponse]:
        """The most recently created items for the household."""
        result = await self.db.execute(
            select(InventoryItem)
            .where(InventoryItem.household_id == household_id)
            .order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
            .limit(limit)
        )

        return [
            InventoryItemResponse.model_validate(item) for item in result.scalars().all()
        ]
