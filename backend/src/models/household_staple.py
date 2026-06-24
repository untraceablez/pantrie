"""Household staple model: always-on-hand ingredients (e.g. water).

A staple is treated as in-stock during recipe makeability without needing a
matching inventory row, so common pantry items don't clutter the missing list
or shopping-list pushes. Per-household and user-configurable; every household is
seeded with ``water``.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class HouseholdStaple(Base):
    """Model for household-specific assumed staples."""

    __tablename__ = "household_staples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    household: Mapped["Household"] = relationship("Household", back_populates="staples")
