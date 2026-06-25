"""Unit tests for the SQLAlchemy declarative base + TimestampMixin.

The real models all declare ``class X(Base, TimestampMixin)``, so Base.__init__
wins the MRO and the mixin's __init__ is exercised only when the mixin comes
first. A throwaway probe model (on its own isolated declarative base, so it
never touches the app's metadata) puts it first to cover that __init__.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from src.db.base import TimestampMixin


class _ProbeBase(DeclarativeBase):
    pass


class _TimestampProbe(TimestampMixin, _ProbeBase):
    __tablename__ = "_timestamp_probe"

    id: Mapped[int] = mapped_column(primary_key=True)


def test_timestamp_mixin_defaults_to_now():
    obj = _TimestampProbe(id=1)
    assert obj.created_at is not None
    assert obj.updated_at is not None
    assert obj.created_at.tzinfo is not None
    assert obj.updated_at.tzinfo is not None


def test_timestamp_mixin_preserves_explicit_values():
    dt = datetime(2020, 1, 1, tzinfo=timezone.utc)
    obj = _TimestampProbe(id=2, created_at=dt, updated_at=dt)
    assert obj.created_at == dt
    assert obj.updated_at == dt
