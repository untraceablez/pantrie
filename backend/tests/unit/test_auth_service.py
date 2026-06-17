"""Tests for AuthService (register, login, refresh, revoke, get-by-id).

DB-backed via the real ``db_session``. The real ``core.security`` helpers
(hash/verify password, create/verify JWTs) are used as-is — they're pure and
fast. Only EmailService is monkeypatched, and only for the SMTP-configured
branches; with no SystemSettings row, ``get_smtp_settings`` returns None and
the email paths are skipped.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

import src.services.auth_service as auth_mod
from src.core.exceptions import AlreadyExistsError, AuthenticationError, NotFoundError
from src.core.security import create_access_token, create_refresh_token, hash_password
from src.models.refresh_token import RefreshToken
from src.models.system_settings import SystemSettings
from src.models.user import User
from src.schemas.user import UserCreate, UserLogin
from src.services.auth_service import AuthService


async def _enable_email_confirmation(db):
    db.add(SystemSettings(smtp_host="smtp.example.com", require_email_confirmation=True))
    await db.commit()


async def _make_user(db, *, email="u@example.com", username="user", password="Password1",
                     is_active=True, is_verified=True, oauth_provider=None) -> User:
    user = User(
        email=email, username=username,
        hashed_password=hash_password(password) if password else None,
        is_active=is_active, is_verified=is_verified, oauth_provider=oauth_provider,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# --------------------------------------------------------------------------- #
# register
# --------------------------------------------------------------------------- #
async def test_register_creates_unverified_user(db_session):
    svc = AuthService(db_session)
    user = await svc.register(
        UserCreate(email="new@example.com", username="newbie", password="Password1")
    )
    assert user.id is not None
    assert user.is_verified is False
    assert user.hashed_password is not None


async def test_register_duplicate_email_rejected(db_session):
    await _make_user(db_session, email="dup@example.com", username="orig")
    svc = AuthService(db_session)
    with pytest.raises(AlreadyExistsError):
        await svc.register(
            UserCreate(email="dup@example.com", username="different", password="Password1")
        )


async def test_register_duplicate_username_rejected(db_session):
    await _make_user(db_session, email="orig@example.com", username="taken")
    svc = AuthService(db_session)
    with pytest.raises(AlreadyExistsError):
        await svc.register(
            UserCreate(email="other@example.com", username="taken", password="Password1")
        )


async def test_register_sends_confirmation_email_when_smtp_configured(db_session, monkeypatch):
    await _enable_email_confirmation(db_session)
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(auth_mod.EmailService, "send_confirmation_email", sender)
    svc = AuthService(db_session)

    await svc.register(
        UserCreate(email="confirm@example.com", username="confirmer", password="Password1")
    )
    sender.assert_awaited_once()


async def test_register_succeeds_even_if_email_send_fails(db_session, monkeypatch):
    await _enable_email_confirmation(db_session)
    monkeypatch.setattr(
        auth_mod.EmailService, "send_confirmation_email",
        AsyncMock(side_effect=RuntimeError("smtp down")),
    )
    svc = AuthService(db_session)

    user = await svc.register(
        UserCreate(email="resilient@example.com", username="resilient", password="Password1")
    )
    assert user.id is not None  # registration not rolled back by email failure


# --------------------------------------------------------------------------- #
# login
# --------------------------------------------------------------------------- #
async def test_login_success_returns_tokens_and_stores_refresh(db_session):
    user = await _make_user(db_session, email="login@example.com", username="login",
                            password="Password1")
    svc = AuthService(db_session)

    resp = await svc.login(UserLogin(email="login@example.com", password="Password1"))
    assert resp.access_token and resp.refresh_token
    stored = (await db_session.execute(
        RefreshToken.__table__.select().where(RefreshToken.user_id == user.id)
    )).first()
    assert stored is not None


async def test_login_unknown_email_rejected(db_session):
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.login(UserLogin(email="nobody@example.com", password="Password1"))


async def test_login_oauth_only_user_rejected(db_session):
    await _make_user(db_session, email="oauth@example.com", username="oauthuser",
                     password=None, oauth_provider="google")
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError, match="Google"):
        await svc.login(UserLogin(email="oauth@example.com", password="Password1"))


async def test_login_wrong_password_rejected(db_session):
    await _make_user(db_session, email="wp@example.com", username="wp", password="Password1")
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.login(UserLogin(email="wp@example.com", password="WrongPass9"))


async def test_login_inactive_user_rejected(db_session):
    await _make_user(db_session, email="off@example.com", username="off",
                     password="Password1", is_active=False)
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError, match="disabled"):
        await svc.login(UserLogin(email="off@example.com", password="Password1"))


async def test_login_unverified_rejected_when_confirmation_required(db_session):
    await _make_user(db_session, email="unv@example.com", username="unv",
                     password="Password1", is_verified=False)
    await _enable_email_confirmation(db_session)
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError, match="not verified"):
        await svc.login(UserLogin(email="unv@example.com", password="Password1"))


async def test_login_verified_succeeds_when_confirmation_required(db_session):
    await _make_user(db_session, email="ver@example.com", username="ver",
                     password="Password1", is_verified=True)
    await _enable_email_confirmation(db_session)
    svc = AuthService(db_session)
    resp = await svc.login(UserLogin(email="ver@example.com", password="Password1"))
    assert resp.access_token


# --------------------------------------------------------------------------- #
# refresh_access_token
# --------------------------------------------------------------------------- #
async def _store_refresh(db, user_id, *, token=None, is_revoked=False, days=7):
    token = token or create_refresh_token({"sub": str(user_id)})
    db.add(RefreshToken(
        user_id=user_id, token=token, is_revoked=is_revoked,
        expires_at=datetime.now(timezone.utc) + timedelta(days=days),
    ))
    await db.commit()
    return token


async def test_refresh_access_token_success(db_session):
    user = await _make_user(db_session, email="r@example.com", username="r")
    token = await _store_refresh(db_session, user.id)
    svc = AuthService(db_session)

    resp = await svc.refresh_access_token(token)
    assert resp.access_token
    assert resp.refresh_token == token  # same refresh token returned


async def test_refresh_access_token_not_stored_rejected(db_session):
    user = await _make_user(db_session, email="r@example.com", username="r")
    # valid signature, but never persisted
    token = create_refresh_token({"sub": str(user.id)})
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.refresh_access_token(token)


async def test_refresh_access_token_revoked_rejected(db_session):
    user = await _make_user(db_session, email="r@example.com", username="r")
    token = await _store_refresh(db_session, user.id, is_revoked=True)
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.refresh_access_token(token)


async def test_refresh_access_token_wrong_token_type_rejected(db_session):
    user = await _make_user(db_session, email="r@example.com", username="r")
    access = create_access_token({"sub": str(user.id)})
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError, match="token type"):
        await svc.refresh_access_token(access)


async def test_refresh_access_token_inactive_user_rejected(db_session):
    user = await _make_user(db_session, email="r@example.com", username="r",
                            is_active=False)
    token = await _store_refresh(db_session, user.id)
    svc = AuthService(db_session)
    with pytest.raises(AuthenticationError, match="not found or inactive"):
        await svc.refresh_access_token(token)


# --------------------------------------------------------------------------- #
# revoke_refresh_token
# --------------------------------------------------------------------------- #
async def test_revoke_refresh_token_marks_revoked(db_session):
    user = await _make_user(db_session, email="rv@example.com", username="rv")
    token = await _store_refresh(db_session, user.id)
    svc = AuthService(db_session)

    await svc.revoke_refresh_token(token)
    # a revoked token can no longer be refreshed
    with pytest.raises(AuthenticationError):
        await svc.refresh_access_token(token)


async def test_revoke_refresh_token_unknown_is_noop(db_session):
    svc = AuthService(db_session)
    # should not raise
    await svc.revoke_refresh_token("does-not-exist")


# --------------------------------------------------------------------------- #
# get_user_by_id
# --------------------------------------------------------------------------- #
async def test_get_user_by_id_found(db_session):
    user = await _make_user(db_session, email="g@example.com", username="g")
    svc = AuthService(db_session)
    got = await svc.get_user_by_id(user.id)
    assert got.id == user.id


async def test_get_user_by_id_not_found(db_session):
    svc = AuthService(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_user_by_id(9999)
