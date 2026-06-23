"""Endpoint tests for site_settings, notifications, and oauth routers.

site_settings + notifications gate on get_current_site_admin (site_role ==
"site_administrator"); helpers below mint site-admin and regular-user tokens.
oauth's authorize/callback are exercised with a fake authlib client and a
monkeypatched OAuthService.handle_callback.
"""
from typing import Any

import pytest
from httpx import AsyncClient

import src.api.v1.oauth as oauth_router_mod
from src.config import get_settings
from src.core.security import create_access_token
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.user import User
from src.models.webhook import Webhook
from src.schemas.user import TokenResponse

API = "/api/v1"


async def _user(db, *, email, username, site_role="user") -> User:
    user = User(email=email, username=username, hashed_password="x",
                is_active=True, is_verified=True, site_role=site_role)
    db.add(user)
    await db.commit()
    return user


def _bearer(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


async def _admin_headers(db) -> dict[str, str]:
    admin = await _user(db, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    return _bearer(admin.id)


# =========================================================================== #
# site_settings router
# =========================================================================== #
async def test_smtp_settings_defaults_create_update(async_client: AsyncClient, db_session):
    headers = await _admin_headers(db_session)

    # defaults (no settings row)
    resp = await async_client.get(f"{API}/site-settings/smtp", headers=headers)
    assert resp.status_code == 200 and resp.json()["smtp_host"] is None

    # create
    resp = await async_client.put(
        f"{API}/site-settings/smtp",
        json={"smtp_host": "smtp.x", "smtp_port": 587, "smtp_password": "pw",
              "smtp_from_email": "from@example.com"},
        headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["smtp_host"] == "smtp.x"

    # GET with existing settings row (return-with-settings branch)
    resp = await async_client.get(f"{API}/site-settings/smtp", headers=headers)
    assert resp.status_code == 200 and resp.json()["smtp_host"] == "smtp.x"

    # update existing (password omitted -> kept)
    resp = await async_client.put(
        f"{API}/site-settings/smtp",
        json={"smtp_host": "smtp.y", "smtp_port": 25,
              "smtp_from_email": "from@example.com"},
        headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["smtp_host"] == "smtp.y"

    # update existing WITH password provided (password-set branch)
    resp = await async_client.put(
        f"{API}/site-settings/smtp",
        json={"smtp_host": "smtp.z", "smtp_port": 465, "smtp_password": "newpw",
              "smtp_from_email": "from@example.com"},
        headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["smtp_host"] == "smtp.z"


async def test_smtp_settings_requires_site_admin(async_client: AsyncClient, db_session):
    regular = await _user(db_session, email="r@example.com", username="r")
    resp = await async_client.get(f"{API}/site-settings/smtp", headers=_bearer(regular.id))
    assert resp.status_code == 403


async def test_proxy_settings_defaults_create_update(async_client: AsyncClient, db_session):
    headers = await _admin_headers(db_session)

    resp = await async_client.get(f"{API}/site-settings/proxy", headers=headers)
    assert resp.status_code == 200 and resp.json()["proxy_mode"] == "none"

    resp = await async_client.put(
        f"{API}/site-settings/proxy",
        json={"proxy_mode": "external", "external_proxy_url": "https://p"}, headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["proxy_mode"] == "external"

    resp = await async_client.put(
        f"{API}/site-settings/proxy",
        json={"proxy_mode": "builtin"}, headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["proxy_mode"] == "builtin"

    # GET with existing settings row (return-with-settings branch)
    resp = await async_client.get(f"{API}/site-settings/proxy", headers=headers)
    assert resp.status_code == 200 and resp.json()["proxy_mode"] == "builtin"


# =========================================================================== #
# notifications router — email settings
# =========================================================================== #
async def test_email_notification_settings_defaults_create_update(
    async_client: AsyncClient, db_session
):
    headers = await _admin_headers(db_session)

    resp = await async_client.get(f"{API}/notifications/email", headers=headers)
    assert resp.status_code == 200 and resp.json()["email_notifications_enabled"] is False

    resp = await async_client.put(
        f"{API}/notifications/email",
        json={"email_notifications_enabled": True, "expiry_warning_days": 10},
        headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["expiry_warning_days"] == 10

    resp = await async_client.put(
        f"{API}/notifications/email",
        json={"email_notifications_enabled": False}, headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["email_notifications_enabled"] is False

    # GET with existing settings row (return-with-settings branch); the last PUT
    # omitted expiry_warning_days so it fell back to the default of 7.
    resp = await async_client.get(f"{API}/notifications/email", headers=headers)
    assert resp.status_code == 200 and resp.json()["expiry_warning_days"] == 7


# =========================================================================== #
# notifications router — webhooks
# =========================================================================== #
async def test_webhook_crud_and_permissions(async_client: AsyncClient, db_session):
    headers = await _admin_headers(db_session)

    # empty list
    resp = await async_client.get(f"{API}/notifications/webhooks", headers=headers)
    assert resp.status_code == 200 and resp.json() == []

    # create (admin can create a global webhook)
    resp = await async_client.post(
        f"{API}/notifications/webhooks",
        json={"name": "wh", "url": "https://hook", "event_types": ["low_stock"]},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    wid = resp.json()["id"]
    assert resp.json()["event_types"] == ["low_stock"]

    # get
    resp = await async_client.get(f"{API}/notifications/webhooks/{wid}", headers=headers)
    assert resp.status_code == 200

    # update (all mutable fields -> exercises every field branch)
    resp = await async_client.put(
        f"{API}/notifications/webhooks/{wid}",
        json={"name": "wh2", "url": "https://hook2", "secret": "sek",
              "is_active": False, "event_types": ["new_member"]},
        headers=headers,
    )
    body = resp.json()
    assert resp.status_code == 200
    assert body["name"] == "wh2" and body["url"] == "https://hook2"
    assert body["event_types"] == ["new_member"]

    # list (admin sees all)
    resp = await async_client.get(f"{API}/notifications/webhooks", headers=headers)
    assert len(resp.json()) == 1

    # delete
    resp = await async_client.delete(f"{API}/notifications/webhooks/{wid}", headers=headers)
    assert resp.status_code == 204

    # get after delete -> 404
    resp = await async_client.get(f"{API}/notifications/webhooks/{wid}", headers=headers)
    assert resp.status_code == 404


async def test_webhook_non_admin_global_create_forbidden(async_client: AsyncClient, db_session):
    regular = await _user(db_session, email="r@example.com", username="r")
    resp = await async_client.post(
        f"{API}/notifications/webhooks",
        json={"name": "wh", "url": "https://hook"},  # household_id None -> global
        headers=_bearer(regular.id),
    )
    assert resp.status_code == 403


async def test_webhook_access_denied_for_other_users_webhook(
    async_client: AsyncClient, db_session
):
    owner = await _user(db_session, email="o@example.com", username="owner")
    other = await _user(db_session, email="x@example.com", username="other")
    wh = Webhook(name="w", url="https://h", event_types="low_stock",
                 household_id=None, created_by_id=owner.id)
    db_session.add(wh)
    await db_session.commit()

    resp = await async_client.get(
        f"{API}/notifications/webhooks/{wh.id}", headers=_bearer(other.id)
    )
    assert resp.status_code == 403


async def test_webhook_list_regular_user_sees_only_own(async_client: AsyncClient, db_session):
    owner = await _user(db_session, email="o@example.com", username="owner")
    other = await _user(db_session, email="x@example.com", username="other")
    db_session.add_all([
        Webhook(name="mine", url="https://h", event_types="low_stock",
                household_id=None, created_by_id=owner.id),
        Webhook(name="theirs", url="https://h", event_types="low_stock",
                household_id=None, created_by_id=other.id),
    ])
    await db_session.commit()

    resp = await async_client.get(f"{API}/notifications/webhooks", headers=_bearer(owner.id))
    assert resp.status_code == 200
    names = [w["name"] for w in resp.json()]
    assert names == ["mine"]


async def test_webhook_test_endpoint_success(async_client: AsyncClient, db_session, monkeypatch):
    import httpx
    owner = await _user(db_session, email="o@example.com", username="owner")
    wh = Webhook(name="w", url="https://hook", event_types="low_stock",
                 secret="s3cr3t", household_id=None, created_by_id=owner.id)
    db_session.add(wh)
    await db_session.commit()

    real = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda *a, **k: real(transport=httpx.MockTransport(lambda r: httpx.Response(200))),
    )
    resp = await async_client.post(
        f"{API}/notifications/webhooks/{wh.id}/test", headers=_bearer(owner.id)
    )
    assert resp.status_code == 200 and resp.json()["success"] is True


async def test_webhook_test_endpoint_non_2xx_and_errors(
    async_client: AsyncClient, db_session, monkeypatch
):
    import httpx
    owner = await _user(db_session, email="o@example.com", username="owner")
    wh = Webhook(name="w", url="https://hook", event_types="low_stock",
                 household_id=None, created_by_id=owner.id)
    db_session.add(wh)
    await db_session.commit()
    real = httpx.AsyncClient

    # non-2xx -> success False with status_code
    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda *a, **k: real(transport=httpx.MockTransport(lambda r: httpx.Response(500))),
    )
    resp = await async_client.post(
        f"{API}/notifications/webhooks/{wh.id}/test", headers=_bearer(owner.id)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False and body["status_code"] == 500

    # timeout -> success False, timed-out message
    def _timeout(r):
        raise httpx.TimeoutException("boom")
    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda *a, **k: real(transport=httpx.MockTransport(_timeout)),
    )
    resp = await async_client.post(
        f"{API}/notifications/webhooks/{wh.id}/test", headers=_bearer(owner.id)
    )
    assert resp.status_code == 200 and resp.json()["success"] is False
    assert "timed out" in resp.json()["message"]

    # request error -> success False, connect-failed message
    def _reqerr(r):
        raise httpx.ConnectError("nope")
    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda *a, **k: real(transport=httpx.MockTransport(_reqerr)),
    )
    resp = await async_client.post(
        f"{API}/notifications/webhooks/{wh.id}/test", headers=_bearer(owner.id)
    )
    assert resp.status_code == 200 and resp.json()["success"] is False
    assert "Failed to connect" in resp.json()["message"]


async def test_webhook_update_delete_test_not_found_and_access_denied(
    async_client: AsyncClient, db_session
):
    owner = await _user(db_session, email="o@example.com", username="owner")
    other = await _user(db_session, email="x@example.com", username="other")
    wh = Webhook(name="w", url="https://h", event_types="low_stock",
                 household_id=None, created_by_id=owner.id)
    db_session.add(wh)
    await db_session.commit()

    # not found (404) for update/delete/test
    resp = await async_client.put(f"{API}/notifications/webhooks/999999",
                                  json={"name": "x"}, headers=_bearer(owner.id))
    assert resp.status_code == 404
    resp = await async_client.delete(f"{API}/notifications/webhooks/999999",
                                     headers=_bearer(owner.id))
    assert resp.status_code == 404
    resp = await async_client.post(f"{API}/notifications/webhooks/999999/test",
                                   headers=_bearer(owner.id))
    assert resp.status_code == 404

    # access denied (403) for update/delete/test by a non-owner non-admin
    resp = await async_client.put(f"{API}/notifications/webhooks/{wh.id}",
                                  json={"name": "x"}, headers=_bearer(other.id))
    assert resp.status_code == 403
    resp = await async_client.delete(f"{API}/notifications/webhooks/{wh.id}",
                                     headers=_bearer(other.id))
    assert resp.status_code == 403
    resp = await async_client.post(f"{API}/notifications/webhooks/{wh.id}/test",
                                   headers=_bearer(other.id))
    assert resp.status_code == 403


# =========================================================================== #
# oauth router
# =========================================================================== #
async def test_oauth_providers_empty_by_default(async_client: AsyncClient):
    resp = await async_client.get(f"{API}/auth/oauth/providers")
    assert resp.status_code == 200 and resp.json()["providers"] == []


async def test_oauth_providers_lists_configured(async_client: AsyncClient, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "OAUTH_GOOGLE_CLIENT_ID", "gid")
    monkeypatch.setattr(settings, "OAUTH_GOOGLE_CLIENT_SECRET", "gsec")
    monkeypatch.setattr(settings, "OAUTH_AUTHENTIK_CLIENT_ID", "aid")
    monkeypatch.setattr(settings, "OAUTH_AUTHENTIK_CLIENT_SECRET", "asec")
    monkeypatch.setattr(settings, "OAUTH_AUTHENTIK_BASE_URL", "https://ak")
    resp = await async_client.get(f"{API}/auth/oauth/providers")
    assert set(resp.json()["providers"]) == {"google", "authentik"}


class _FakeOAuthClient:
    async def authorize_redirect(self, request, redirect_uri, state=None):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=redirect_uri)


async def test_oauth_authorize_redirects_and_https_rewrite(
    async_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(oauth_router_mod.oauth, "create_client", lambda p: _FakeOAuthClient())
    resp = await async_client.get(
        f"{API}/auth/oauth/google/authorize",
        params={"redirect_uri": "https://front/cb"},
        headers={"X-Forwarded-Proto": "https"},
    )
    assert resp.status_code in (302, 307)
    assert resp.headers["location"].startswith("https://")


async def test_oauth_authorize_https_from_redirect_uri_fallback(
    async_client: AsyncClient, monkeypatch
):
    # No proxy headers; the https redirect_uri triggers the callback https rewrite.
    monkeypatch.setattr(oauth_router_mod.oauth, "create_client", lambda p: _FakeOAuthClient())
    resp = await async_client.get(
        f"{API}/auth/oauth/google/authorize",
        params={"redirect_uri": "https://front/cb"},
    )
    assert resp.status_code in (302, 307)
    assert resp.headers["location"].startswith("https://")


async def test_oauth_callback_redirects_to_frontend_with_tokens(
    async_client: AsyncClient, monkeypatch
):
    async def fake_handle_callback(self, **kwargs):
        return TokenResponse(access_token="acc", refresh_token="ref", expires_in=60)

    monkeypatch.setattr(
        oauth_router_mod.OAuthService, "handle_callback", fake_handle_callback
    )
    resp = await async_client.get(
        f"{API}/auth/oauth/google/callback",
        params={"code": "abc", "state": "https://front/cb"},
    )
    assert resp.status_code in (302, 307)
    loc = resp.headers["location"]
    assert "access_token=acc" in loc and "refresh_token=ref" in loc


# =========================================================================== #
# site_admin router — user management
# =========================================================================== #
async def _household(db, *, name="H") -> Household:
    hh = Household(name=name)
    db.add(hh)
    await db.commit()
    return hh


async def test_site_admin_list_users_includes_household_count(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    member = await _user(db_session, email="m@example.com", username="m")
    hh = await _household(db_session)
    db_session.add(HouseholdMembership(user_id=member.id, household_id=hh.id,
                                       role=MemberRole.ADMIN))
    await db_session.commit()

    resp = await async_client.get(f"{API}/site-admin/users", headers=_bearer(admin.id))
    assert resp.status_code == 200
    by_username = {u["username"]: u for u in resp.json()}
    assert by_username["m"]["household_count"] == 1
    assert by_username["sa"]["household_count"] == 0


async def test_site_admin_requires_site_admin(async_client: AsyncClient, db_session):
    regular = await _user(db_session, email="r@example.com", username="r")
    resp = await async_client.get(f"{API}/site-admin/users", headers=_bearer(regular.id))
    assert resp.status_code == 403


async def test_site_admin_get_user_detail_found_and_404(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    target = await _user(db_session, email="t@example.com", username="t")

    resp = await async_client.get(f"{API}/site-admin/users/{target.id}",
                                  headers=_bearer(admin.id))
    assert resp.status_code == 200 and resp.json()["email"] == "t@example.com"

    resp = await async_client.get(f"{API}/site-admin/users/999999",
                                  headers=_bearer(admin.id))
    assert resp.status_code == 404


async def test_site_admin_create_user_and_conflicts(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    headers = _bearer(admin.id)

    resp = await async_client.post(
        f"{API}/site-admin/users",
        json={"email": "new@example.com", "username": "new", "password": "Password1",
              "site_role": "user"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == "new@example.com"

    # duplicate email -> 409
    resp = await async_client.post(
        f"{API}/site-admin/users",
        json={"email": "new@example.com", "username": "other", "password": "Password1"},
        headers=headers,
    )
    assert resp.status_code == 409

    # duplicate username -> 409
    resp = await async_client.post(
        f"{API}/site-admin/users",
        json={"email": "other@example.com", "username": "new", "password": "Password1"},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_site_admin_update_user_all_fields(async_client: AsyncClient, db_session):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    target = await _user(db_session, email="t@example.com", username="t")

    resp = await async_client.put(
        f"{API}/site-admin/users/{target.id}",
        json={"email": "t2@example.com", "username": "t2", "first_name": "F",
              "last_name": "L", "is_active": False, "is_verified": True,
              "site_role": "user", "password": "NewPass123"},
        headers=_bearer(admin.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "t2@example.com" and body["username"] == "t2"
    assert body["first_name"] == "F" and body["is_active"] is False


async def test_site_admin_update_user_404(async_client: AsyncClient, db_session):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    resp = await async_client.put(f"{API}/site-admin/users/999999",
                                  json={"first_name": "X"}, headers=_bearer(admin.id))
    assert resp.status_code == 404


async def test_site_admin_cannot_demote_self(async_client: AsyncClient, db_session):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    resp = await async_client.put(
        f"{API}/site-admin/users/{admin.id}",
        json={"site_role": "user"}, headers=_bearer(admin.id),
    )
    assert resp.status_code == 400


async def test_site_admin_update_user_email_username_conflicts(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    a = await _user(db_session, email="a@example.com", username="a")
    b = await _user(db_session, email="b@example.com", username="b")

    # changing a -> b's email conflicts
    resp = await async_client.put(
        f"{API}/site-admin/users/{a.id}",
        json={"email": "b@example.com"}, headers=_bearer(admin.id),
    )
    assert resp.status_code == 409

    # changing a -> b's username conflicts
    resp = await async_client.put(
        f"{API}/site-admin/users/{a.id}",
        json={"username": "b"}, headers=_bearer(admin.id),
    )
    assert resp.status_code == 409


async def test_site_admin_delete_user_and_guards(async_client: AsyncClient, db_session):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    target = await _user(db_session, email="t@example.com", username="t")
    headers = _bearer(admin.id)

    # cannot delete self -> 400
    resp = await async_client.delete(f"{API}/site-admin/users/{admin.id}", headers=headers)
    assert resp.status_code == 400

    # delete missing -> 404
    resp = await async_client.delete(f"{API}/site-admin/users/999999", headers=headers)
    assert resp.status_code == 404

    # delete target -> 204
    resp = await async_client.delete(f"{API}/site-admin/users/{target.id}", headers=headers)
    assert resp.status_code == 204


# =========================================================================== #
# site_admin router — household management
# =========================================================================== #
async def test_site_admin_list_households_with_member_count(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    member = await _user(db_session, email="m@example.com", username="m")
    hh = await _household(db_session, name="Home")
    db_session.add(HouseholdMembership(user_id=member.id, household_id=hh.id,
                                       role=MemberRole.VIEWER))
    await db_session.commit()

    resp = await async_client.get(f"{API}/site-admin/households", headers=_bearer(admin.id))
    assert resp.status_code == 200
    item = next(h for h in resp.json() if h["name"] == "Home")
    assert item["member_count"] == 1


async def test_site_admin_get_household_detail_found_and_404(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    member = await _user(db_session, email="m@example.com", username="m")
    hh = await _household(db_session, name="Home")
    db_session.add(HouseholdMembership(user_id=member.id, household_id=hh.id,
                                       role=MemberRole.ADMIN))
    await db_session.commit()

    resp = await async_client.get(f"{API}/site-admin/households/{hh.id}",
                                  headers=_bearer(admin.id))
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Home"
    assert body["members"][0]["username"] == "m"

    resp = await async_client.get(f"{API}/site-admin/households/999999",
                                  headers=_bearer(admin.id))
    assert resp.status_code == 404


async def test_site_admin_create_household_and_missing_admin(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    owner = await _user(db_session, email="o@example.com", username="owner")
    headers = _bearer(admin.id)

    resp = await async_client.post(
        f"{API}/site-admin/households",
        json={"name": "New Home", "admin_user_id": owner.id}, headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "New Home"
    assert body["members"][0]["role"] == "admin"

    # admin_user_id that doesn't exist -> 404
    resp = await async_client.post(
        f"{API}/site-admin/households",
        json={"name": "X", "admin_user_id": 999999}, headers=headers,
    )
    assert resp.status_code == 404


async def test_site_admin_update_household_and_404(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    hh = await _household(db_session, name="Old")

    resp = await async_client.put(
        f"{API}/site-admin/households/{hh.id}",
        json={"name": "Renamed"}, headers=_bearer(admin.id),
    )
    assert resp.status_code == 200 and resp.json()["name"] == "Renamed"

    resp = await async_client.put(
        f"{API}/site-admin/households/999999",
        json={"name": "X"}, headers=_bearer(admin.id),
    )
    assert resp.status_code == 404


async def test_site_admin_delete_household_and_404(
    async_client: AsyncClient, db_session
):
    admin = await _user(db_session, email="sa@example.com", username="sa",
                        site_role="site_administrator")
    hh = await _household(db_session, name="Doomed")
    headers = _bearer(admin.id)

    resp = await async_client.delete(f"{API}/site-admin/households/{hh.id}", headers=headers)
    assert resp.status_code == 204

    resp = await async_client.delete(f"{API}/site-admin/households/999999", headers=headers)
    assert resp.status_code == 404
