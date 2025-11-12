"""HouseholdMembership model for user-household relationships with roles."""
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base, TimestampMixin


class MemberRole(str, PyEnum):
    """Roles for household members."""

    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class HouseholdMembership(Base, TimestampMixin):
    """Association table for users and households with role-based access."""

    __tablename__ = "household_memberships"
    __table_args__ = (UniqueConstraint("user_id", "household_id", name="uq_user_household"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, native_enum=False, length=20),
        nullable=False,
        default=MemberRole.VIEWER,
    )

    def __repr__(self) -> str:
        return f"<HouseholdMembership(user_id={self.user_id}, household_id={self.household_id}, role='{self.role}')>"
