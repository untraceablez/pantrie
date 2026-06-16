"""Tests for OAuthService (provider config, user find/link/create, callback).

`settings` and `oauth` are module-level singletons in oauth_service, so we
monkeypatch their attributes/methods. The authlib client is replaced with a
fake exposing async authorize_access_token / authorize_redirect / parse_id_token.
"""
import pytest
from sqlalchemy import select

import src.services.oauth_service as oauth_mod
from src.core.exceptions import AuthenticationError, ConfigurationError
from src.models.user import User
from src.schemas.user import TokenResponse
from src.services.oauth_service import OAuthService


def _configure_google(monkeypatch):
    monkeypatch.setattr(oauth_mod.settings, "OAUTH_GOOGLE_CLIENT_ID", "gid")
    monkeypatch.setattr(oauth_mod.settings, "OAUTH_GOOGLE_CLIENT_SECRET", "gsec")


def _fake_client(*, token=None, raise_on_token=None, redirect="http://authorize"):
    class _Client:
        async def authorize_access_token(self, request):
            if raise_on_token is not None:
                raise raise_on_token
            return token

        async def authorize_redirect(self, redirect_uri):
            return redirect

        async def parse_id_token(self, tok):
            return tok.get("_id_token", {})

    return _Client()


def _install_client(monkeypatch, client):
    monkeypatch.setattr(oauth_mod.oauth, "create_client", lambda provider: client)


# --------------------------------------------------------------------------- #
# get_provider_config
# --------------------------------------------------------------------------- #
def test_get_provider_config_google_not_configured(monkeypatch):
    monkeypatch.setattr(oauth_mod.settings, "OAUTH_GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(oauth_mod.settings, "OAUTH_GOOGLE_CLIENT_SECRET", None)
    with pytest.raises(ConfigurationError):
        OAuthService.get_provider_config("google")


def test_get_provider_config_google_configured(monkeypatch):
    _configure_google(monkeypatch)
    cfg = OAuthService.get_provider_config("google")
    assert cfg["client_id"] == "gid"
    assert cfg["name"] == "Google"


def test_get_provider_config_authentik_not_configured(monkeypatch):
    monkeypatch.setattr(oauth_mod.settings, "OAUTH_AUTHENTIK_CLIENT_ID", None)
    with pytest.raises(ConfigurationError):
        OAuthService.get_provider_config("authentik")


def test_get_provider_config_authentik_configured(monkeypatch):
    for key, val in {
        "OAUTH_AUTHENTIK_CLIENT_ID": "aid",
        "OAUTH_AUTHENTIK_CLIENT_SECRET": "asec",
        "OAUTH_AUTHENTIK_BASE_URL": "http://ak",
        "OAUTH_AUTHENTIK_SLUG": "pantrie",
    }.items():
        monkeypatch.setattr(oauth_mod.settings, key, val)
    cfg = OAuthService.get_provider_config("authentik")
    assert cfg["slug"] == "pantrie"
    assert cfg["name"] == "Authentik"


def test_get_provider_config_unsupported_provider():
    with pytest.raises(ConfigurationError):
        OAuthService.get_provider_config("facebook")  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# _find_or_create_oauth_user
# --------------------------------------------------------------------------- #
async def test_find_or_create_creates_new_verified_user(db_session):
    svc = OAuthService(db_session)
    user = await svc._find_or_create_oauth_user(
        provider="google", oauth_id="oid-new", email="newuser@example.com",
        email_verified=True, first_name="New", last_name="User", avatar_url="http://a",
    )
    assert user.id is not None
    assert user.username == "newuser"
    assert user.oauth_provider == "google"
    assert user.oauth_id == "oid-new"
    assert user.is_verified is True
    assert user.email_confirmed_at is not None
    assert user.hashed_password is None


async def test_find_or_create_dedupes_username_on_collision(db_session):
    db_session.add(User(email="other@example.com", username="alice",
                        hashed_password=None, is_active=True))
    await db_session.commit()
    svc = OAuthService(db_session)
    user = await svc._find_or_create_oauth_user(
        provider="google", oauth_id="oid-collide", email="alice@example.com",
        email_verified=False,
    )
    assert user.username == "alice1"
    assert user.is_verified is False
    assert user.email_confirmed_at is None


async def test_find_or_create_returns_and_updates_existing_oauth_user(db_session):
    db_session.add(User(
        email="known@example.com", username="known", hashed_password=None, is_active=True,
        oauth_provider="google", oauth_id="oid-known", is_verified=False, first_name=None,
    ))
    await db_session.commit()
    svc = OAuthService(db_session)
    user = await svc._find_or_create_oauth_user(
        provider="google", oauth_id="oid-known", email="known@example.com",
        email_verified=True, first_name="Updated", avatar_url="http://new",
    )
    assert user.first_name == "Updated"
    assert user.avatar_url == "http://new"
    assert user.is_verified is True  # flipped because email_verified


async def test_find_or_create_autolinks_to_existing_email_when_verified(db_session):
    db_session.add(User(
        email="link@example.com", username="link", hashed_password="hash", is_active=True,
        oauth_provider=None, oauth_id=None, is_verified=False,
    ))
    await db_session.commit()
    svc = OAuthService(db_session)
    user = await svc._find_or_create_oauth_user(
        provider="authentik", oauth_id="oid-link", email="link@example.com",
        email_verified=True, first_name="Linked",
    )
    assert user.oauth_provider == "authentik"
    assert user.oauth_id == "oid-link"
    assert user.is_verified is True
    assert user.first_name == "Linked"
    # linked, not duplicated
    count = len((await db_session.execute(
        select(User).where(User.email == "link@example.com"))).scalars().all())
    assert count == 1


async def test_find_or_create_unverified_skips_autolink_and_creates(db_session):
    svc = OAuthService(db_session)
    user = await svc._find_or_create_oauth_user(
        provider="google", oauth_id="oid-unverified", email="fresh@example.com",
        email_verified=False,
    )
    assert user.id is not None
    assert user.is_verified is False
    assert user.email_confirmed_at is None
    assert user.oauth_provider == "google"


# --------------------------------------------------------------------------- #
# handle_callback
# --------------------------------------------------------------------------- #
async def test_handle_callback_happy_path_returns_tokens_and_persists_user(db_session, monkeypatch):
    _configure_google(monkeypatch)
    token = {"userinfo": {
        "email": "oauth@example.com", "sub": "sub-1", "email_verified": True,
        "given_name": "O", "family_name": "Auth", "picture": "http://pic",
    }}
    _install_client(monkeypatch, _fake_client(token=token))
    svc = OAuthService(db_session)

    resp = await svc.handle_callback("google", code="abc", redirect_uri="http://cb", request=None)

    assert isinstance(resp, TokenResponse)
    assert resp.access_token and resp.refresh_token
    user = (await db_session.execute(
        select(User).where(User.email == "oauth@example.com"))).scalars().first()
    assert user is not None and user.oauth_id == "sub-1"


async def test_handle_callback_token_exchange_failure_raises_auth_error(db_session, monkeypatch):
    _configure_google(monkeypatch)
    _install_client(monkeypatch, _fake_client(raise_on_token=RuntimeError("exchange failed")))
    svc = OAuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.handle_callback("google", "abc", "http://cb", None)


async def test_handle_callback_missing_user_info_raises_auth_error(db_session, monkeypatch):
    _configure_google(monkeypatch)
    _install_client(monkeypatch, _fake_client(token={"userinfo": {"email": None, "sub": None}}))
    svc = OAuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.handle_callback("google", "abc", "http://cb", None)


async def test_handle_callback_inactive_user_raises_auth_error(db_session, monkeypatch):
    db_session.add(User(
        email="inactive@example.com", username="inactive", hashed_password=None,
        is_active=False, oauth_provider="google", oauth_id="sub-inactive",
    ))
    await db_session.commit()
    _configure_google(monkeypatch)
    token = {"userinfo": {"email": "inactive@example.com", "sub": "sub-inactive", "email_verified": True}}
    _install_client(monkeypatch, _fake_client(token=token))
    svc = OAuthService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.handle_callback("google", "abc", "http://cb", None)


# --------------------------------------------------------------------------- #
# get_authorization_url
# --------------------------------------------------------------------------- #
async def test_get_authorization_url_returns_redirect(monkeypatch):
    _configure_google(monkeypatch)
    _install_client(monkeypatch, _fake_client(redirect="http://authorize-me"))
    svc = OAuthService(None)
    assert await svc.get_authorization_url("google", "http://cb") == "http://authorize-me"


async def test_get_authorization_url_unregistered_client_raises(monkeypatch):
    _configure_google(monkeypatch)
    _install_client(monkeypatch, None)
    svc = OAuthService(None)
    with pytest.raises(ConfigurationError):
        await svc.get_authorization_url("google", "http://cb")
