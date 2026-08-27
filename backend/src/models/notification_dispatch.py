"""NotificationDispatch model recording which digests already went out."""
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class NotificationDispatch(Base, TimestampMixin):
    """One row per (household, event type, day) digest that was dispatched.

    The scheduled notification job writes a row after dispatching so that a
    second run on the same day — a restart, a manual trigger, a misfire that
    APScheduler catches up on — does not send the digest twice. The unique
    constraint makes the guard safe even if two runs overlap.
    """

    __tablename__ = "notification_dispatches"
    __table_args__ = (
        UniqueConstraint(
            "household_id",
            "event_type",
            "dispatch_date",
            name="uq_notification_dispatch_per_day",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "expiring_items" or "low_stock" — same vocabulary as the webhook events.
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Outcome of the dispatch, kept for diagnostics.
    item_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    emails_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    webhooks_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<NotificationDispatch(household_id={self.household_id}, "
            f"event_type='{self.event_type}', dispatch_date={self.dispatch_date})>"
        )
