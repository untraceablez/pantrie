"""Tests for the daily notification digest orchestration.

``NotificationService.run_daily_notifications`` is what the scheduler calls: it
walks every household, gathers expiring / low-stock items and hands them to the
existing notify_* delivery paths, at most once per household per day.
"""
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

from sqlalchemy import select

from src.config import Settings
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.inventory_item import InventoryItem
from src.models.location import Location
from src.models.notification_dispatch import NotificationDispatch
from src.models.system_settings import SystemSettings
from src.models.user import User
from src.models.webhook import Webhook
from src.services.email_service import EmailService
from src.services.inventory_service import InventoryService
from src.services.notification_service import NotificationService


def _app_settings(**overrides) -> Settings:
    """Application settings with the notification knobs pinned for the test."""
    defaults = {
        "ENVIRONMENT": "test",
        "NOTIFICATIONS_EXPIRY_WARNING_DAYS": 7,
        "NOTIFICATIONS_LOW_STOCK_THRESHOLD": 1.0,
    }
    defaults.update(overrides)
    return Settings(**defaults)


async def _make_settings(db_session, **flags) -> SystemSettings:
    settings = SystemSettings(**flags)
    db_session.add(settings)
    await db_session.commit()
    return settings


async def _make_item(db_session, *, household_id, user_id, name, **kwargs) -> InventoryItem:
    item = InventoryItem(
        household_id=household_id,
        added_by_user_id=user_id,
        name=name,
        quantity=kwargs.pop("quantity", Decimal("5")),
        **kwargs,
    )
    db_session.add(item)
    await db_session.flush()
    return item


def _stub_delivery(monkeypatch, *, emails=1, webhooks=1):
    """Stub both delivery paths; returns the notify_* mocks."""
    expiring = AsyncMock(return_value={"emails_sent": emails, "webhooks_sent": webhooks})
    low_stock = AsyncMock(return_value={"emails_sent": emails, "webhooks_sent": webhooks})
    monkeypatch.setattr(NotificationService, "notify_expiring_items", expiring)
    monkeypatch.setattr(NotificationService, "notify_low_stock", low_stock)
    return expiring, low_stock


# --------------------------------------------------------------------------- #
# Dispatch bookkeeping
# --------------------------------------------------------------------------- #
async def test_already_dispatched_false_then_true(db_session, admin_household):
    household = admin_household["household"]
    today = date.today()

    assert await NotificationService.already_dispatched(
        db_session, household.id, "expiring_items", today
    ) is False

    await NotificationService.record_dispatch(
        db_session,
        household_id=household.id,
        event_type="expiring_items",
        on_date=today,
        item_count=3,
        results={"emails_sent": 2, "webhooks_sent": 1},
    )

    assert await NotificationService.already_dispatched(
        db_session, household.id, "expiring_items", today
    ) is True
    # A different event type or a different day is not covered by the record.
    assert await NotificationService.already_dispatched(
        db_session, household.id, "low_stock", today
    ) is False
    assert await NotificationService.already_dispatched(
        db_session, household.id, "expiring_items", today + timedelta(days=1)
    ) is False


async def test_record_dispatch_persists_counts(db_session, admin_household):
    household = admin_household["household"]
    record = await NotificationService.record_dispatch(
        db_session,
        household_id=household.id,
        event_type="low_stock",
        on_date=date(2026, 5, 4),
        item_count=7,
        results={"emails_sent": 4, "webhooks_sent": 2},
    )

    assert record.id is not None
    assert "low_stock" in repr(record)
    stored = (
        await db_session.execute(select(NotificationDispatch))
    ).scalars().one()
    assert stored.item_count == 7
    assert stored.emails_sent == 4
    assert stored.webhooks_sent == 2
    assert stored.dispatch_date == date(2026, 5, 4)


async def test_record_dispatch_defaults_missing_counts(db_session, admin_household):
    record = await NotificationService.record_dispatch(
        db_session,
        household_id=admin_household["household"].id,
        event_type="low_stock",
        on_date=date.today(),
        item_count=1,
        results={},
    )
    assert record.emails_sent == 0
    assert record.webhooks_sent == 0


# --------------------------------------------------------------------------- #
# Recipients
# --------------------------------------------------------------------------- #
async def test_get_household_recipients_only_active_members(db_session, admin_household):
    household = admin_household["household"]

    inactive = User(email="gone@example.com", username="gone", is_active=False)
    outsider = User(email="out@example.com", username="out", is_active=True)
    db_session.add_all([inactive, outsider])
    await db_session.flush()
    db_session.add(
        HouseholdMembership(
            user_id=inactive.id, household_id=household.id, role=MemberRole.VIEWER
        )
    )
    await db_session.commit()

    recipients = await NotificationService.get_household_recipients(db_session, household.id)

    assert [u.username for u in recipients] == ["admin"]


# --------------------------------------------------------------------------- #
# run_daily_notifications
# --------------------------------------------------------------------------- #
async def test_run_daily_notifications_without_system_settings(db_session):
    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["households_processed"] == 0
    assert summary["expiring_items_dispatched"] == 0
    assert summary["low_stock_dispatched"] == 0


async def test_run_daily_notifications_all_digests_disabled(
    db_session, admin_household, monkeypatch
):
    await _make_settings(db_session, notify_expiring_items=False, notify_low_stock=False)
    expiring, low_stock = _stub_delivery(monkeypatch)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["households_processed"] == 0
    expiring.assert_not_awaited()
    low_stock.assert_not_awaited()


async def test_run_daily_notifications_dispatches_both_digests(
    db_session, admin_household, monkeypatch
):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(
        db_session,
        notify_expiring_items=True,
        notify_low_stock=True,
        expiry_warning_days=7,
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Milk",
        expiration_date=date.today() + timedelta(days=1),
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Flour",
        quantity=Decimal("0.5"),
    )
    await db_session.commit()
    expiring, low_stock = _stub_delivery(monkeypatch, emails=2, webhooks=1)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["households_processed"] == 1
    assert summary["expiring_items_dispatched"] == 1
    assert summary["low_stock_dispatched"] == 1
    assert summary["emails_sent"] == 4
    assert summary["webhooks_sent"] == 2
    assert summary["skipped_duplicates"] == 0
    assert summary["errors"] == 0

    # Delivery went through the existing notify_* paths, with the real items.
    assert [i.name for i in expiring.await_args.args[1]] == ["Milk"]
    assert [i.name for i in low_stock.await_args.args[1]] == ["Flour"]
    assert [u.id for u in expiring.await_args.args[3]] == [user.id]

    dispatches = (await db_session.execute(select(NotificationDispatch))).scalars().all()
    assert {d.event_type for d in dispatches} == {"expiring_items", "low_stock"}


async def test_run_daily_notifications_skips_duplicate_run_same_day(
    db_session, admin_household, monkeypatch
):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(db_session, notify_expiring_items=True, notify_low_stock=True)
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Milk",
        expiration_date=date.today(), quantity=Decimal("0.5"),
    )
    await db_session.commit()
    expiring, low_stock = _stub_delivery(monkeypatch)

    first = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )
    second = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert first["expiring_items_dispatched"] == 1
    assert first["low_stock_dispatched"] == 1
    assert second["expiring_items_dispatched"] == 0
    assert second["low_stock_dispatched"] == 0
    assert second["skipped_duplicates"] == 2
    # Still exactly one delivery per digest.
    assert expiring.await_count == 1
    assert low_stock.await_count == 1


async def test_run_daily_notifications_sends_again_on_a_new_day(
    db_session, admin_household, monkeypatch
):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(db_session, notify_expiring_items=True, notify_low_stock=False)
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Milk",
        expiration_date=date.today(),
    )
    await db_session.commit()
    expiring, _ = _stub_delivery(monkeypatch)

    await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings(), on_date=date(2026, 5, 1)
    )
    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings(), on_date=date(2026, 5, 2)
    )

    assert summary["expiring_items_dispatched"] == 1
    assert expiring.await_count == 2


async def test_run_daily_notifications_honours_individual_flags(
    db_session, admin_household, monkeypatch
):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(db_session, notify_expiring_items=False, notify_low_stock=True)
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Milk",
        expiration_date=date.today(), quantity=Decimal("0.1"),
    )
    await db_session.commit()
    expiring, low_stock = _stub_delivery(monkeypatch)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["expiring_items_dispatched"] == 0
    assert summary["low_stock_dispatched"] == 1
    expiring.assert_not_awaited()
    low_stock.assert_awaited_once()


async def test_run_daily_notifications_nothing_to_report(
    db_session, admin_household, monkeypatch
):
    await _make_settings(db_session, notify_expiring_items=True, notify_low_stock=True)
    expiring, low_stock = _stub_delivery(monkeypatch)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["households_processed"] == 1
    assert summary["expiring_items_dispatched"] == 0
    assert summary["low_stock_dispatched"] == 0
    expiring.assert_not_awaited()
    low_stock.assert_not_awaited()
    assert (await db_session.execute(select(NotificationDispatch))).scalars().all() == []


async def test_run_daily_notifications_falls_back_to_config_window(
    db_session, admin_household, monkeypatch
):
    """A zero/unset expiry_warning_days falls back to the app setting."""
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(
        db_session, notify_expiring_items=True, notify_low_stock=False, expiry_warning_days=0
    )
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Cheese",
        expiration_date=date.today() + timedelta(days=25),
    )
    await db_session.commit()
    expiring, _ = _stub_delivery(monkeypatch)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings(NOTIFICATIONS_EXPIRY_WARNING_DAYS=30)
    )

    assert summary["expiring_items_dispatched"] == 1
    assert [i.name for i in expiring.await_args.args[1]] == ["Cheese"]


async def test_run_daily_notifications_survives_a_failing_household(
    db_session, admin_household, monkeypatch
):
    await _make_settings(db_session, notify_expiring_items=True, notify_low_stock=True)
    second = Household(name="Second Household")
    db_session.add(second)
    await db_session.commit()

    monkeypatch.setattr(
        InventoryService,
        "get_expiring_items",
        AsyncMock(side_effect=RuntimeError("query exploded")),
    )
    _stub_delivery(monkeypatch)

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["households_processed"] == 2
    assert summary["errors"] == 2
    assert summary["expiring_items_dispatched"] == 0


async def test_run_daily_notifications_end_to_end_through_delivery(
    db_session, admin_household, monkeypatch
):
    """No notify_* stubs: the real orchestrators build the email and webhook."""
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(
        db_session,
        notify_expiring_items=True,
        notify_low_stock=False,
        email_notifications_enabled=True,
        smtp_host="smtp.test",
    )
    location = Location(household_id=household.id, name="Fridge")
    db_session.add(location)
    await db_session.flush()
    await _make_item(
        db_session, household_id=household.id, user_id=user.id, name="Milk",
        expiration_date=date.today(), location_id=location.id,
    )
    db_session.add(
        Webhook(
            name="hook",
            url="http://hook.test/x",
            is_active=True,
            event_types="expiring_items",
            household_id=household.id,
            created_by_id=user.id,
        )
    )
    await db_session.commit()

    send_email = AsyncMock(return_value=True)
    monkeypatch.setattr(EmailService, "send_email", send_email)
    monkeypatch.setattr(NotificationService, "send_webhook", AsyncMock(return_value=True))

    summary = await NotificationService.run_daily_notifications(
        db_session, app_settings=_app_settings()
    )

    assert summary["emails_sent"] == 1
    assert summary["webhooks_sent"] == 1
    assert send_email.await_args.kwargs["to_email"] == user.email
    # The joined location made it into the rendered email.
    assert "Fridge" in send_email.await_args.kwargs["html_body"]


async def test_location_name_falls_back_to_unknown():
    assert NotificationService._location_name(SimpleNamespace()) == "Unknown"
    assert NotificationService._location_name(SimpleNamespace(location=None)) == "Unknown"
    assert (
        NotificationService._location_name(
            SimpleNamespace(location=SimpleNamespace(name="Pantry"))
        )
        == "Pantry"
    )
