"""Tests for EmailService send_email + token verify/confirm.

send_email uses the blocking ``smtplib.SMTP`` directly, so we monkeypatch the
module's ``smtplib.SMTP`` with a recording fake. send_confirmation_email is
already exercised transitively by the auth-register tests.
"""
from datetime import datetime, timedelta, timezone

import pytest

import src.services.email_service as email_mod
from src.models.system_settings import SystemSettings
from src.models.user import User
from src.services.email_service import EmailService


class _FakeSMTP:
    """Records the SMTP conversation; instances live in ``_FakeSMTP.last``."""

    last: "dict" = {}

    def __init__(self, host, port):
        _FakeSMTP.last = {"host": host, "port": port, "tls": False,
                          "login": None, "sent": False, "quit": False}

    def starttls(self):
        _FakeSMTP.last["tls"] = True

    def login(self, user, password):
        _FakeSMTP.last["login"] = (user, password)

    def send_message(self, msg):
        _FakeSMTP.last["sent"] = True

    def quit(self):
        _FakeSMTP.last["quit"] = True


class _BoomSMTP:
    def __init__(self, host, port):
        raise OSError("connection refused")


async def _settings(db, **kwargs):
    defaults = dict(smtp_host="smtp.example.com", smtp_port=587,
                    smtp_from_email="from@example.com", smtp_from_name="Pantrie")
    defaults.update(kwargs)
    db.add(SystemSettings(**defaults))
    await db.commit()


# --------------------------------------------------------------------------- #
# send_email
# --------------------------------------------------------------------------- #
async def test_send_email_returns_false_when_unconfigured(db_session):
    # no SystemSettings row at all
    assert await EmailService.send_email(db_session, "to@x.com", "S", "<p>h</p>") is False


async def test_send_email_returns_false_when_host_missing(db_session):
    await _settings(db_session, smtp_host=None)
    assert await EmailService.send_email(db_session, "to@x.com", "S", "<p>h</p>") is False


async def test_send_email_tls_with_login_success(db_session, monkeypatch):
    await _settings(db_session, smtp_use_tls=True, smtp_user="u", smtp_password="p")
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _FakeSMTP)

    ok = await EmailService.send_email(
        db_session, "to@x.com", "Subject", "<p>hi</p>", text_body="hi"
    )
    assert ok is True
    assert _FakeSMTP.last["tls"] is True
    assert _FakeSMTP.last["login"] == ("u", "p")
    assert _FakeSMTP.last["sent"] and _FakeSMTP.last["quit"]


async def test_send_email_no_tls_no_login(db_session, monkeypatch):
    await _settings(db_session, smtp_use_tls=False, smtp_user=None, smtp_password=None)
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _FakeSMTP)

    ok = await EmailService.send_email(db_session, "to@x.com", "Subject", "<p>hi</p>")
    assert ok is True
    assert _FakeSMTP.last["tls"] is False
    assert _FakeSMTP.last["login"] is None


async def test_send_email_returns_false_on_smtp_error(db_session, monkeypatch):
    await _settings(db_session)
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _BoomSMTP)
    assert await EmailService.send_email(db_session, "to@x.com", "S", "<p>h</p>") is False


# --------------------------------------------------------------------------- #
# verify_confirmation_token
# --------------------------------------------------------------------------- #
async def _user_with_token(db, token, *, sent_at) -> User:
    user = User(email="u@example.com", username="u", hashed_password="x",
                email_confirmation_token=token, email_confirmation_sent_at=sent_at)
    db.add(user)
    await db.commit()
    return user


async def test_verify_confirmation_token_valid(db_session):
    await _user_with_token(db_session, "tok-1", sent_at=datetime.now(timezone.utc))
    user = await EmailService.verify_confirmation_token(db_session, "tok-1")
    assert user is not None and user.email == "u@example.com"


async def test_verify_confirmation_token_unknown_returns_none(db_session):
    assert await EmailService.verify_confirmation_token(db_session, "missing") is None


async def test_verify_confirmation_token_expired_returns_none(db_session):
    stale = datetime.now(timezone.utc) - timedelta(hours=25)
    await _user_with_token(db_session, "tok-old", sent_at=stale)
    assert await EmailService.verify_confirmation_token(db_session, "tok-old") is None


# --------------------------------------------------------------------------- #
# confirm_email
# --------------------------------------------------------------------------- #
async def test_confirm_email_success_marks_verified_and_clears_token(db_session):
    user = await _user_with_token(db_session, "tok-c", sent_at=datetime.now(timezone.utc))
    assert await EmailService.confirm_email(db_session, "tok-c") is True
    await db_session.refresh(user)
    assert user.is_verified is True
    assert user.email_confirmed_at is not None
    assert user.email_confirmation_token is None


async def test_confirm_email_invalid_token_returns_false(db_session):
    assert await EmailService.confirm_email(db_session, "nope") is False
