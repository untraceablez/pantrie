"""Tests for SetupService.perform_initial_setup + is_setup_complete.

The .env-writing helpers (_read_env_file/_write_env_file) are covered in
test_setup_env_file.py; here they're monkeypatched so the OAuth branch is
exercised without touching the filesystem.
"""
import pytest

import src.services.setup_service as setup_mod
from src.core.exceptions import ValidationError
from src.models.household_membership import MemberRole
from src.models.system_settings import SystemSettings
from src.models.user import User
from src.schemas.setup import NotificationConfig, OAuthConfig, ProxyConfig, SMTPConfig
from src.services.setup_service import SetupService


async def _run_setup(db, **kwargs):
    defaults = dict(
        admin_email="admin@example.com", admin_username="admin",
        admin_password="Password1", household_name="Home",
    )
    defaults.update(kwargs)
    return await SetupService.perform_initial_setup(db, **defaults)


# --------------------------------------------------------------------------- #
# is_setup_complete
# --------------------------------------------------------------------------- #
async def test_is_setup_complete_false_when_no_users(db_session):
    assert await SetupService.is_setup_complete(db_session) is False


async def test_is_setup_complete_true_when_user_exists(db_session):
    db_session.add(User(email="u@example.com", username="u", hashed_password="x"))
    await db_session.commit()
    assert await SetupService.is_setup_complete(db_session) is True


# --------------------------------------------------------------------------- #
# perform_initial_setup
# --------------------------------------------------------------------------- #
async def test_perform_initial_setup_minimal_creates_admin_and_household(db_session):
    result = await _run_setup(db_session)

    assert result["message"] == "Initial setup completed successfully"
    user = (await db_session.execute(
        User.__table__.select().where(User.email == "admin@example.com")
    )).first()
    assert user is not None
    # the created user is a verified site administrator
    svc_user = await SetupService.is_setup_complete(db_session)
    assert svc_user is True
    assert result["household"]["name"] == "Home"


async def test_perform_initial_setup_marks_user_verified_site_admin(db_session):
    await _run_setup(db_session)
    user = (await db_session.execute(
        User.__table__.select().where(User.email == "admin@example.com")
    )).first()
    assert user.is_verified is True
    assert user.site_role == "site_administrator"


async def test_perform_initial_setup_rejects_when_already_complete(db_session):
    db_session.add(User(email="existing@example.com", username="existing",
                        hashed_password="x"))
    await db_session.commit()
    with pytest.raises(ValidationError):
        await _run_setup(db_session)


async def test_perform_initial_setup_creates_system_settings_from_configs(db_session):
    await _run_setup(
        db_session,
        smtp_config=SMTPConfig(smtp_host="smtp.x", smtp_port=587,
                               smtp_from_email="from@example.com"),
        proxy_config=ProxyConfig(proxy_mode="external",
                                 external_proxy_url="https://proxy"),
        notification_config=NotificationConfig(email_notifications_enabled=True,
                                               expiry_warning_days=14),
    )
    settings = (await db_session.execute(SystemSettings.__table__.select())).first()
    assert settings is not None
    assert settings.smtp_host == "smtp.x"
    assert settings.proxy_mode == "external"
    assert settings.email_notifications_enabled is True
    assert settings.expiry_warning_days == 14
    assert settings.require_email_confirmation is True


async def test_perform_initial_setup_updates_existing_system_settings(db_session):
    # Pre-existing settings row, but no users yet -> update branch is taken.
    db_session.add(SystemSettings(smtp_host="old", proxy_mode="none"))
    await db_session.commit()

    await _run_setup(
        db_session,
        smtp_config=SMTPConfig(smtp_host="new.smtp", smtp_port=25,
                               smtp_from_email="from@example.com"),
        proxy_config=ProxyConfig(proxy_mode="builtin"),
        notification_config=NotificationConfig(email_notifications_enabled=True,
                                               notify_low_stock=False,
                                               expiry_warning_days=3),
    )
    rows = (await db_session.execute(SystemSettings.__table__.select())).all()
    assert len(rows) == 1  # updated, not duplicated
    assert rows[0].smtp_host == "new.smtp"
    assert rows[0].proxy_mode == "builtin"
    assert rows[0].email_notifications_enabled is True
    assert rows[0].notify_low_stock is False
    assert rows[0].expiry_warning_days == 3


async def test_perform_initial_setup_writes_oauth_env(db_session, monkeypatch):
    captured = {}

    def fake_read(path):
        return {}

    def fake_write(path, env_vars):
        captured.update(env_vars)

    monkeypatch.setattr(setup_mod, "_read_env_file", fake_read)
    monkeypatch.setattr(setup_mod, "_write_env_file", fake_write)

    await _run_setup(
        db_session,
        oauth_config=OAuthConfig(
            google_client_id="gid", google_client_secret="gsec",
            authentik_client_id="aid", authentik_client_secret="asec",
            authentik_base_url="https://ak", authentik_slug="pantrie",
        ),
    )
    assert captured["OAUTH_GOOGLE_CLIENT_ID"] == "gid"
    assert captured["OAUTH_GOOGLE_CLIENT_SECRET"] == "gsec"
    assert captured["OAUTH_AUTHENTIK_CLIENT_ID"] == "aid"
    assert captured["OAUTH_AUTHENTIK_SLUG"] == "pantrie"
