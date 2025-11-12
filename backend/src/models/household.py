"""Household model for multi-user inventory management."""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class Household(Base, TimestampMixin):
    """Household model representing a shared inventory space."""

    __tablename__ = "households"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<Household(id={self.id}, name='{self.name}')>"
