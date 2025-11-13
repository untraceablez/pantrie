"""Location model for tracking where items are stored."""
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class Location(Base, TimestampMixin):
    """Location model for tracking storage locations.

    Locations represent where items are stored in the household
    (e.g., Pantry, Refrigerator, Freezer, Kitchen Cabinet, etc.)
    """

    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("household_id", "name", name="uq_household_location_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # Icon name or emoji for UI

    def __repr__(self) -> str:
        return f"<Location(id={self.id}, name='{self.name}')>"
