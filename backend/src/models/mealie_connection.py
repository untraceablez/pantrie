"""MealieConnection model: per-household outbound connection to a Mealie instance."""
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class MealieConnection(Base, TimestampMixin):
    """Configuration for calling a household's Mealie instance.

    The API key is stored encrypted (recoverable, since it must be replayed to
    Mealie) and never returned in responses. One connection per household.
    """

    __tablename__ = "mealie_connections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_enc: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<MealieConnection(household_id={self.household_id}, base_url='{self.base_url}')>"
