"""Endpoint tests for the auth, users, barcode, setup, and email-confirmation
routers. Services are unit-tested elsewhere; these cover the HTTP layer.

setup/* tests deliberately do NOT use ``admin_household`` (which would make the
DB non-empty and setup "complete"); they rely on the autouse table truncation.
"""
from datetime import datetime, timezone
from typing import Any

import pytest
from httpx import AsyncClient

import src.services.barcode_service as barcode_mod
from src.models.user import User

API = "/api/v1"


# =========================================================================== #
# auth router
# =========================================================================== #
async def test_auth_register_login_refresh_logout_me(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    # register a fresh account (no SMTP settings -> confirmation email skipped)
    resp = await async_client.post(
        f"{API}/auth/register",
        json={"email": "rega@example.com", "username": "rega", "password": "Password1"},
    )
    assert resp.status_code == 201, resp.text

    # login
    resp = await async_client.post(
        f"{API}/auth/login", json={"email": "rega@example.com", "password": "Password1"}
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()
    refresh = tokens["refresh_token"]

    # refresh
    resp = await async_client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200 and resp.json()["access_token"]

    # logout (revoke)
    resp = await async_client.post(f"{API}/auth/logout", json={"refresh_token": refresh})
    assert resp.status_code == 204

    # /me with the admin's token
    resp = await async_client.get(f"{API}/auth/me", headers=admin_household["auth_headers"])
    assert resp.status_code == 200 and resp.json()["email"] == "admin@example.com"


async def test_auth_login_bad_credentials_returns_401(async_client: AsyncClient):
    resp = await async_client.post(
        f"{API}/auth/login", json={"email": "nobody@example.com", "password": "Password1"}
    )
    assert resp.status_code == 401


# =========================================================================== #
# users router
# =========================================================================== #
async def test_users_me_get_update_password(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]

    resp = await async_client.get(f"{API}/users/me", headers=headers)
    assert resp.status_code == 200 and resp.json()["username"] == "admin"

    resp = await async_client.put(
        f"{API}/users/me", json={"first_name": "Ada"}, headers=headers
    )
    assert resp.status_code == 200 and resp.json()["first_name"] == "Ada"

    # admin_household fixture sets password "password123"
    resp = await async_client.post(
        f"{API}/users/me/password",
        json={"current_password": "password123", "new_password": "NewPass123"},
        headers=headers,
    )
    assert resp.status_code == 204


async def test_users_avatar_upload_and_validation(
    async_client: AsyncClient, admin_household: dict[str, Any]
):
    headers = admin_household["auth_headers"]

    # valid png
    resp = await async_client.post(
        f"{API}/users/me/avatar",
        files={"file": ("a.png", b"\x89PNG\r\n", "image/png")}, headers=headers,
    )
    assert resp.status_code == 200 and resp.json()["avatar_url"].startswith("data:image/png")

    # invalid type
    resp = await async_client.post(
        f"{API}/users/me/avatar",
        files={"file": ("a.txt", b"hello", "text/plain")}, headers=headers,
    )
    assert resp.status_code == 400

    # oversized (>10MB)
    big = b"x" * (10 * 1024 * 1024 + 1)
    resp = await async_client.post(
        f"{API}/users/me/avatar",
        files={"file": ("big.png", big, "image/png")}, headers=headers,
    )
    assert resp.status_code == 413


# =========================================================================== #
# barcode router
# =========================================================================== #
def _patch_barcode(monkeypatch, handler):
    import httpx
    real = httpx.AsyncClient
    monkeypatch.setattr(
        barcode_mod.httpx, "AsyncClient",
        lambda *a, **k: real(transport=httpx.MockTransport(handler)),
    )


async def test_barcode_lookup_found(async_client: AsyncClient, monkeypatch):
    import httpx
    payload = {"status": 1, "product": {"product_name": "Beans", "code": "555"}}
    _patch_barcode(monkeypatch, lambda r: httpx.Response(200, json=payload))
    resp = await async_client.get(f"{API}/barcode/555")
    assert resp.status_code == 200 and resp.json()["name"] == "Beans"


async def test_barcode_lookup_not_found(async_client: AsyncClient, monkeypatch):
    import httpx
    _patch_barcode(monkeypatch, lambda r: httpx.Response(200, json={"status": 0}))
    resp = await async_client.get(f"{API}/barcode/000")
    assert resp.status_code == 404


async def test_barcode_search_returns_suggestions(async_client: AsyncClient, monkeypatch):
    import httpx
    payload = {"products": [{"code": "555", "product_name": "Beans", "brands": "Acme"}]}
    _patch_barcode(monkeypatch, lambda r: httpx.Response(200, json=payload))
    resp = await async_client.get(f"{API}/barcode/search", params={"q": "beans"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["results"][0]["barcode"] == "555"
    assert body["search_url"]


async def test_barcode_search_requires_a_query(async_client: AsyncClient):
    # Too-short query fails validation (min_length=2).
    resp = await async_client.get(f"{API}/barcode/search", params={"q": "a"})
    assert resp.status_code == 422


# =========================================================================== #
# setup router (empty DB -> setup not complete)
# =========================================================================== #
async def test_setup_status_then_initialize_then_complete(async_client: AsyncClient):
    resp = await async_client.get(f"{API}/setup/status")
    assert resp.status_code == 200 and resp.json()["setup_complete"] is False

    resp = await async_client.post(
        f"{API}/setup/initialize",
        json={"admin_email": "admin@example.com", "admin_username": "admin",
              "admin_password": "Password1", "household_name": "Home"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["household"]["name"] == "Home"

    resp = await async_client.get(f"{API}/setup/status")
    assert resp.json()["setup_complete"] is True

    # second attempt rejected (ValidationError -> 422)
    resp = await async_client.post(
        f"{API}/setup/initialize",
        json={"admin_email": "x@example.com", "admin_username": "xx",
              "admin_password": "Password1", "household_name": "Other"},
    )
    assert resp.status_code == 422


# =========================================================================== #
# email-confirmation router
# =========================================================================== #
async def _user_with_token(db, token) -> User:
    user = User(email="ec@example.com", username="ec", hashed_password="x",
                email_confirmation_token=token,
                email_confirmation_sent_at=datetime.now(timezone.utc))
    db.add(user)
    await db.commit()
    return user


async def test_email_confirm_success_and_invalid(
    async_client: AsyncClient, db_session: Any
):
    await _user_with_token(db_session, "valid-tok")

    resp = await async_client.post(f"{API}/email/confirm", json={"token": "valid-tok"})
    assert resp.status_code == 200 and resp.json()["success"] is True

    resp = await async_client.post(f"{API}/email/confirm", json={"token": "bad"})
    assert resp.status_code == 400


async def test_email_verify_token_valid_and_invalid(
    async_client: AsyncClient, db_session: Any
):
    await _user_with_token(db_session, "vtok")

    resp = await async_client.get(f"{API}/email/verify-token/vtok")
    assert resp.status_code == 200 and resp.json()["valid"] is True

    resp = await async_client.get(f"{API}/email/verify-token/nope")
    assert resp.status_code == 200 and resp.json()["valid"] is False
