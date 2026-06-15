"""APIClient model for external machine-to-machine integrations (e.g. Mealie)."""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin

DEFAULT_PERMISSIONS: dict[str, bool] = {"read": True, "write": False, "delete": False}


class APIClient(Base, TimestampMixin):
    """Credentials and access policy for an external API client, scoped to a household.

    The plaintext secret is generated server-side, returned exactly once on
    creation, and only ever stored as a bcrypt hash (non-recoverable).
    """

    __tablename__ = "api_clients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    client_secret_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    permissions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=lambda: dict(DEFAULT_PERMISSIONS)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<APIClient(id={self.id}, name='{self.name}', household_id={self.household_id})>"
