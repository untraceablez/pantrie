"""Integration tests for app-level wiring in main.py.

Exercises the proxy-headers middleware branches, the request logger, the
validation + Pantrie exception handlers, the lifespan, and the health/root
endpoints. The ``client`` fixture runs the app lifespan (startup/shutdown)
under TestClient.
"""
from unittest.mock import patch

from src import main as main_mod
from src.models.system_settings import SystemSettings


def test_health_check(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_root(client):
    r = client.get("/")
    assert r.json()["message"] == "Pantrie API"


def test_proxy_cf_connecting_ip_header(client):
    # CF-Connecting-IP branch of ProxyHeadersMiddleware.
    r = client.get("/api/health", headers={"CF-Connecting-IP": "1.2.3.4"})
    assert r.status_code == 200


def test_proxy_forwarded_headers(client):
    # X-Forwarded-For/Proto/Host branches (no CF header -> the elif path).
    r = client.get(
        "/api/health",
        headers={
            "X-Forwarded-For": "5.6.7.8, 9.9.9.9",
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Host": "example.com",
        },
    )
    assert r.status_code == 200


def test_validation_exception_handler(client):
    # Empty body fails LoginRequest validation -> RequestValidationError handler.
    r = client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    assert r.json()["error"] == "Validation error"


def test_pantrie_exception_handler(client):
    # An auth-gated endpoint without a token raises AuthenticationError
    # (a PantrieException) -> the custom handler shapes the response.
    r = client.get("/api/v1/households")
    assert r.status_code == 401
    assert "error" in r.json()


def _stub_get_db(session):
    async def _gen():
        yield session

    return _gen


async def test_lifespan_adds_custom_domain_to_cors(monkeypatch):
    # A SystemSettings row with a custom domain drives the CORS-origin branch.
    settings_row = SystemSettings(custom_domain="cors.example.com", use_https=True)

    class _Result:
        def scalar_one_or_none(self):
            return settings_row

    class _Session:
        async def execute(self, *a, **k):
            return _Result()

    monkeypatch.setattr(main_mod, "get_db", _stub_get_db(_Session()))
    with patch.object(main_mod.logger, "info") as info:
        async with main_mod.lifespan(main_mod.app):
            pass

    logged = " ".join(str(c) for c in info.call_args_list)
    assert "cors.example.com" in logged


async def test_lifespan_swallows_db_errors(monkeypatch):
    class _Session:
        async def execute(self, *a, **k):
            raise RuntimeError("db down")

    monkeypatch.setattr(main_mod, "get_db", _stub_get_db(_Session()))
    with patch.object(main_mod.logger, "warning") as warn:
        async with main_mod.lifespan(main_mod.app):
            pass

    warn.assert_called()
