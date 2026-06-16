"""Unit tests for setup_service .env file helpers.

These cover the sync helpers extracted so the async setup flow runs file I/O
off the event loop (via asyncio.to_thread) instead of calling open() directly
inside an async function.
"""
from src.services.setup_service import _read_env_file, _write_env_file


def test_read_env_file_missing_returns_empty(tmp_path):
    assert _read_env_file(str(tmp_path / "absent.env")) == {}


def test_write_then_read_roundtrip(tmp_path):
    path = str(tmp_path / ".env")
    _write_env_file(path, {"OAUTH_GOOGLE_CLIENT_ID": "abc", "OTHER": "x"})
    assert _read_env_file(path) == {"OAUTH_GOOGLE_CLIENT_ID": "abc", "OTHER": "x"}


def test_read_env_skips_comments_and_blanks_and_keeps_value_equals(tmp_path):
    path = tmp_path / ".env"
    path.write_text("# a comment\n\nKEY=value\nURL=postgres://h/db?a=b\n")
    assert _read_env_file(str(path)) == {
        "KEY": "value",
        "URL": "postgres://h/db?a=b",  # only split on the first '='
    }
