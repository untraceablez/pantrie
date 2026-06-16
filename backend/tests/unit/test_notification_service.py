"""Tests for NotificationService (webhooks + email notification orchestration).

`send_webhook` builds its own httpx.AsyncClient, so we swap the module's
`httpx` for a fake that records the request and returns a chosen status. The
notify_* orchestrators are exercised against the real DB (settings + webhook
rows) with EmailService.send_email and send_webhook stubbed so we can assert
counts and that the HTML/text email builders run.
"""
import hashlib
import hmac
import json
import types
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import src.services.notification_service as notif_mod
from src.models.system_settings import SystemSettings
from src.models.webhook import Webhook
from src.services.email_service import EmailService
from src.services.notification_service import NotificationService


# --------------------------------------------------------------------------- #
# Fake httpx for send_webhook
# --------------------------------------------------------------------------- #
def _install_fake_httpx(monkeypatch, *, status_code=200, sink=None, raise_exc=None):
    """Replace notification_service.httpx with a fake AsyncClient."""

    class _Resp:
        def __init__(self, code):
            self.status_code = code

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, json=None, headers=None):
            if sink is not None:
                sink["url"] = url
                sink["json"] = json
                sink["headers"] = headers
            if raise_exc is not None:
                raise raise_exc
            return _Resp(status_code)

    monkeypatch.setattr(notif_mod, "httpx", types.SimpleNamespace(AsyncClient=_Client))


def _webhook(**kw):
    """In-memory Webhook (send_webhook only reads url/is_active/event_types/secret)."""
    defaults = dict(
        name="w",
        url="http://hook.test/x",
        is_active=True,
        event_types="expiring_items,low_stock,new_member",
        secret=None,
    )
    defaults.update(kw)
    return Webhook(**defaults)


async def test_send_webhook_inactive_returns_false(monkeypatch):
    _install_fake_httpx(monkeypatch)
    assert await NotificationService.send_webhook(_webhook(is_active=False), "low_stock", {}) is False


async def test_send_webhook_event_not_enabled_returns_false(monkeypatch):
    _install_fake_httpx(monkeypatch)
    wh = _webhook(event_types="low_stock")
    assert await NotificationService.send_webhook(wh, "expiring_items", {}) is False


async def test_send_webhook_success_builds_payload_and_headers(monkeypatch):
    sink = {}
    _install_fake_httpx(monkeypatch, status_code=200, sink=sink)
    ok = await NotificationService.send_webhook(_webhook(), "low_stock", {"k": "v"})
    assert ok is True
    assert sink["url"] == "http://hook.test/x"
    assert sink["json"]["event"] == "low_stock"
    assert sink["json"]["data"] == {"k": "v"}
    assert "timestamp" in sink["json"]
    assert sink["headers"]["X-Pantrie-Event"] == "low_stock"
    assert sink["headers"]["Content-Type"] == "application/json"
    assert "X-Pantrie-Signature" not in sink["headers"]  # no secret configured


async def test_send_webhook_signs_payload_when_secret_set(monkeypatch):
    sink = {}
    _install_fake_httpx(monkeypatch, status_code=201, sink=sink)
    ok = await NotificationService.send_webhook(
        _webhook(secret="topsecret"), "new_member", {"id": 1}
    )
    assert ok is True  # 201 is 2xx
    expected = "sha256=" + hmac.new(
        b"topsecret", json.dumps(sink["json"]).encode(), hashlib.sha256
    ).hexdigest()
    assert sink["headers"]["X-Pantrie-Signature"] == expected


async def test_send_webhook_non_2xx_returns_false(monkeypatch):
    _install_fake_httpx(monkeypatch, status_code=500)
    assert await NotificationService.send_webhook(_webhook(), "low_stock", {}) is False


async def test_send_webhook_swallows_transport_error(monkeypatch):
    _install_fake_httpx(monkeypatch, raise_exc=RuntimeError("boom"))
    assert await NotificationService.send_webhook(_webhook(), "low_stock", {}) is False


# --------------------------------------------------------------------------- #
# notify_* orchestration (DB-backed)
# --------------------------------------------------------------------------- #
async def _make_settings(db_session, **flags):
    settings = SystemSettings(**flags)
    db_session.add(settings)
    await db_session.commit()
    return settings


async def _make_webhook(db_session, *, household_id, created_by_id, event_types):
    wh = Webhook(
        name="hook",
        url="http://hook.test/x",
        is_active=True,
        event_types=event_types,
        household_id=household_id,
        created_by_id=created_by_id,
    )
    db_session.add(wh)
    await db_session.commit()
    return wh


async def test_notify_expiring_items_no_settings_returns_zero(db_session):
    household = SimpleNamespace(id=1, name="H")
    result = await NotificationService.notify_expiring_items(db_session, [], household, [])
    assert result == {"emails_sent": 0, "webhooks_sent": 0}


async def test_notify_expiring_items_disabled_returns_zero(db_session):
    await _make_settings(db_session, notify_expiring_items=False)
    household = SimpleNamespace(id=1, name="H")
    result = await NotificationService.notify_expiring_items(db_session, [], household, [])
    assert result == {"emails_sent": 0, "webhooks_sent": 0}


async def test_notify_expiring_items_sends_email_and_webhook(db_session, admin_household, monkeypatch):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(
        db_session,
        notify_expiring_items=True,
        email_notifications_enabled=True,
        smtp_host="smtp.test",
    )
    await _make_webhook(
        db_session,
        household_id=household.id,
        created_by_id=user.id,
        event_types="expiring_items",
    )
    send_email = AsyncMock(return_value=True)
    monkeypatch.setattr(EmailService, "send_email", send_email)
    monkeypatch.setattr(NotificationService, "send_webhook", AsyncMock(return_value=True))

    items = [
        SimpleNamespace(name="Milk", expiration_date=date(2026, 1, 1),
                        location=SimpleNamespace(name="Fridge"), quantity=2),
        SimpleNamespace(name="Eggs", expiration_date=None, location=None, quantity=12),
    ]
    result = await NotificationService.notify_expiring_items(db_session, items, household, [user])

    assert result == {"emails_sent": 1, "webhooks_sent": 1}
    # The real _send_expiring_items_email built a body and called EmailService.
    assert send_email.await_count == 1
    assert send_email.await_args.kwargs["to_email"] == user.email
    assert "Expiring Items Alert" in send_email.await_args.kwargs["subject"]


async def test_notify_low_stock_sends_email_and_webhook(db_session, admin_household, monkeypatch):
    household = admin_household["household"]
    user = admin_household["user"]
    await _make_settings(
        db_session,
        notify_low_stock=True,
        email_notifications_enabled=True,
        smtp_host="smtp.test",
    )
    await _make_webhook(
        db_session,
        household_id=None,  # global webhook also matches
        created_by_id=user.id,
        event_types="low_stock",
    )
    send_email = AsyncMock(return_value=True)
    monkeypatch.setattr(EmailService, "send_email", send_email)
    monkeypatch.setattr(NotificationService, "send_webhook", AsyncMock(return_value=True))

    items = [SimpleNamespace(name="Flour", quantity=1, location=None)]
    result = await NotificationService.notify_low_stock(db_session, items, household, [user])

    assert result == {"emails_sent": 1, "webhooks_sent": 1}
    assert "Low Stock Alert" in send_email.await_args.kwargs["subject"]


async def test_notify_new_member_excludes_new_member_from_emails(db_session, admin_household, monkeypatch):
    household = admin_household["household"]
    recipient = admin_household["user"]
    await _make_settings(
        db_session,
        notify_new_member=True,
        email_notifications_enabled=True,
        smtp_host="smtp.test",
    )
    send_email = AsyncMock(return_value=True)
    monkeypatch.setattr(EmailService, "send_email", send_email)
    monkeypatch.setattr(NotificationService, "send_webhook", AsyncMock(return_value=True))

    new_user = SimpleNamespace(id=999, username="newbie", email="new@example.com")
    added_by = SimpleNamespace(id=recipient.id, username=recipient.username)

    # recipients includes the new member, who must NOT be emailed about themselves.
    result = await NotificationService.notify_new_member(
        db_session, new_user, household, added_by, [recipient, new_user]
    )

    assert result["emails_sent"] == 1
    assert send_email.await_count == 1
    assert send_email.await_args.kwargs["to_email"] == recipient.email


async def test_notify_new_member_disabled_returns_zero(db_session):
    await _make_settings(db_session, notify_new_member=False)
    household = SimpleNamespace(id=1, name="H")
    new_user = SimpleNamespace(id=2, username="n", email="n@e.com")
    added_by = SimpleNamespace(id=3, username="a")
    result = await NotificationService.notify_new_member(
        db_session, new_user, household, added_by, []
    )
    assert result == {"emails_sent": 0, "webhooks_sent": 0}
