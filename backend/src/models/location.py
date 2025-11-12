"""Location model for tracking where items are stored."""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class Location(Base, TimestampMixin):
    """Location model for tracking storage locations.

    Locations represent where items are stored in the household
    (e.g., Pantry, Refrigerator, Freezer, Kitchen Cabinet, etc.)
    """

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # Icon name or emoji for UI

    def __repr__(self) -> str:
        return f"<Location(id={self.id}, name='{self.name}')>"
