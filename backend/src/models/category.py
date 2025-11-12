"""Category model for organizing inventory items."""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class Category(Base, TimestampMixin):
    """Category model for inventory organization.

    Categories help organize inventory items into logical groups
    (e.g., Fruits, Vegetables, Dairy, Meat, Beverages, etc.)
    """

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # Icon name or emoji for UI

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name='{self.name}')>"
