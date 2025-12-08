"""Webhook model for storing webhook configurations."""
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base, TimestampMixin


class Webhook(Base, TimestampMixin):
    """Webhook configuration for notifications."""

    __tablename__ = "webhooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Webhook name for identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Webhook URL to send notifications to
    url: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional secret for HMAC signature verification
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Whether the webhook is active
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Event types to trigger on (comma-separated: "expiring_items,low_stock,new_member")
    event_types: Mapped[str] = mapped_column(
        String(255), default="expiring_items,low_stock,new_member", nullable=False
    )

    # Optional household association (null = all households for site admins)
    household_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True
    )

    # User who created the webhook
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    household = relationship("Household", backref="webhooks")
    created_by = relationship("User", backref="webhooks")
