"""Tests for the APScheduler wiring in src/core/scheduler.py.

APScheduler itself is replaced with a fake module for the duration of each
test: the point here is the module's own decisions (inert in tests, disabled by
configuration, idempotent start, defensive failure handling), not third-party
cron maths, and no real background scheduler should outlive a test.
"""
import sys
import types
from typing import Generator
from unittest.mock import AsyncMock, patch

import pytest

import src.core.scheduler as scheduler_mod
from src.config import Settings
from src.core.scheduler import (
    NOTIFICATION_JOB_ID,
    get_scheduler,
    run_notification_job,
    shutdown_scheduler,
    start_scheduler,
)
from src.services.notification_service import NotificationService


@pytest.fixture(autouse=True)
def _reset_scheduler_singleton() -> Generator[None, None, None]:
    """Keep the module-level scheduler out of other tests."""
    scheduler_mod._scheduler = None
    yield
    scheduler_mod._scheduler = None


class FakeScheduler:
    """Stand-in for AsyncIOScheduler."""

    def __init__(self, timezone=None):
        self.timezone = timezone
        self.jobs = []
        self.started = False
        self.shutdown_calls = []

    def add_job(self, func, trigger=None, **kwargs):
        self.jobs.append({"func": func, "trigger": trigger, **kwargs})

    def start(self):
        self.started = True

    def shutdown(self, wait=True):
        self.shutdown_calls.append(wait)


class FakeCronTrigger:
    """Stand-in for CronTrigger; just records what it was built with."""

    def __init__(self, **kwargs):
        self.kwargs = kwargs


def _install_fake_apscheduler(monkeypatch, *, scheduler_cls=FakeScheduler):
    """Put a fake apscheduler package into sys.modules."""
    package = types.ModuleType("apscheduler")
    schedulers = types.ModuleType("apscheduler.schedulers")
    asyncio_mod = types.ModuleType("apscheduler.schedulers.asyncio")
    triggers = types.ModuleType("apscheduler.triggers")
    cron_mod = types.ModuleType("apscheduler.triggers.cron")

    asyncio_mod.AsyncIOScheduler = scheduler_cls
    cron_mod.CronTrigger = FakeCronTrigger
    schedulers.asyncio = asyncio_mod
    triggers.cron = cron_mod
    package.schedulers = schedulers
    package.triggers = triggers

    for name, module in (
        ("apscheduler", package),
        ("apscheduler.schedulers", schedulers),
        ("apscheduler.schedulers.asyncio", asyncio_mod),
        ("apscheduler.triggers", triggers),
        ("apscheduler.triggers.cron", cron_mod),
    ):
        monkeypatch.setitem(sys.modules, name, module)


def _settings(**overrides) -> Settings:
    defaults = {
        "ENVIRONMENT": "development",
        "NOTIFICATIONS_SCHEDULER_ENABLED": True,
        "NOTIFICATIONS_SCHEDULE_HOUR": 6,
        "NOTIFICATIONS_SCHEDULE_MINUTE": 30,
        "NOTIFICATIONS_TIMEZONE": "UTC",
    }
    defaults.update(overrides)
    return Settings(**defaults)


# --------------------------------------------------------------------------- #
# start_scheduler
# --------------------------------------------------------------------------- #
def test_start_scheduler_is_inert_in_tests(monkeypatch):
    _install_fake_apscheduler(monkeypatch)

    assert start_scheduler(_settings(ENVIRONMENT="test")) is None
    assert get_scheduler() is None


def test_start_scheduler_respects_disable_flag(monkeypatch):
    _install_fake_apscheduler(monkeypatch)

    assert start_scheduler(_settings(NOTIFICATIONS_SCHEDULER_ENABLED=False)) is None
    assert get_scheduler() is None


def test_start_scheduler_registers_daily_job(monkeypatch):
    _install_fake_apscheduler(monkeypatch)

    scheduler = start_scheduler(_settings())

    assert scheduler is not None
    assert scheduler.started is True
    assert scheduler.timezone == "UTC"
    assert get_scheduler() is scheduler

    job = scheduler.jobs[0]
    assert job["id"] == NOTIFICATION_JOB_ID
    assert job["func"] is run_notification_job
    assert job["replace_existing"] is True
    assert job["coalesce"] is True
    assert job["max_instances"] == 1
    assert job["trigger"].kwargs == {"hour": 6, "minute": 30, "timezone": "UTC"}


def test_start_scheduler_uses_cached_settings_when_none_given(monkeypatch):
    _install_fake_apscheduler(monkeypatch)
    monkeypatch.setattr(scheduler_mod, "get_settings", lambda: _settings())

    assert start_scheduler() is not None


def test_start_scheduler_is_idempotent(monkeypatch):
    _install_fake_apscheduler(monkeypatch)

    first = start_scheduler(_settings())
    second = start_scheduler(_settings())

    assert first is second
    assert len(first.jobs) == 1


def test_start_scheduler_survives_missing_apscheduler(monkeypatch):
    # A None entry in sys.modules makes the import raise ImportError.
    monkeypatch.setitem(sys.modules, "apscheduler.schedulers.asyncio", None)

    with patch.object(scheduler_mod.logger, "error") as error_log:
        assert start_scheduler(_settings()) is None

    assert get_scheduler() is None
    assert error_log.call_count == 1


def test_start_scheduler_survives_a_failing_start(monkeypatch):
    class ExplodingScheduler(FakeScheduler):
        def start(self):
            raise RuntimeError("no event loop")

    _install_fake_apscheduler(monkeypatch, scheduler_cls=ExplodingScheduler)

    with patch.object(scheduler_mod.logger, "error") as error_log:
        assert start_scheduler(_settings()) is None

    assert get_scheduler() is None
    assert error_log.call_count == 1


# --------------------------------------------------------------------------- #
# shutdown_scheduler
# --------------------------------------------------------------------------- #
def test_shutdown_scheduler_without_a_scheduler_is_a_noop():
    shutdown_scheduler()
    assert get_scheduler() is None


def test_shutdown_scheduler_stops_and_clears(monkeypatch):
    _install_fake_apscheduler(monkeypatch)
    scheduler = start_scheduler(_settings())

    shutdown_scheduler()

    assert scheduler.shutdown_calls == [False]
    assert get_scheduler() is None


def test_shutdown_scheduler_swallows_errors(monkeypatch):
    class StubbornScheduler(FakeScheduler):
        def shutdown(self, wait=True):
            raise RuntimeError("stuck")

    _install_fake_apscheduler(monkeypatch, scheduler_cls=StubbornScheduler)
    start_scheduler(_settings())

    with patch.object(scheduler_mod.logger, "warning") as warning_log:
        shutdown_scheduler()

    assert warning_log.call_count == 1
    assert get_scheduler() is None


# --------------------------------------------------------------------------- #
# run_notification_job
# --------------------------------------------------------------------------- #
class _FakeSessionFactory:
    """Async context manager yielding a session double."""

    def __init__(self, session):
        self._session = session

    def __call__(self):
        return self

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        return False


async def test_run_notification_job_commits_and_logs(monkeypatch):
    session = AsyncMock()
    monkeypatch.setattr(
        "src.db.session.AsyncSessionLocal", _FakeSessionFactory(session)
    )
    run = AsyncMock(return_value={"households_processed": 2})
    monkeypatch.setattr(NotificationService, "run_daily_notifications", run)

    with patch.object(scheduler_mod.logger, "info") as info_log:
        await run_notification_job()

    run.assert_awaited_once_with(session)
    session.commit.assert_awaited_once()
    assert info_log.call_args.kwargs == {"households_processed": 2}


async def test_run_notification_job_swallows_failures(monkeypatch):
    session = AsyncMock()
    monkeypatch.setattr(
        "src.db.session.AsyncSessionLocal", _FakeSessionFactory(session)
    )
    monkeypatch.setattr(
        NotificationService,
        "run_daily_notifications",
        AsyncMock(side_effect=RuntimeError("db down")),
    )

    with patch.object(scheduler_mod.logger, "error") as error_log:
        await run_notification_job()  # must not raise

    assert error_log.call_count == 1
    session.commit.assert_not_awaited()


# --------------------------------------------------------------------------- #
# Lifespan wiring
# --------------------------------------------------------------------------- #
async def test_lifespan_starts_and_stops_the_scheduler(monkeypatch):
    import src.main as main_mod

    class _Session:
        async def execute(self, *a, **k):
            raise RuntimeError("no db in this test")

    async def _stub_get_db():
        yield _Session()

    monkeypatch.setattr(main_mod, "get_db", _stub_get_db)
    started: list = []
    stopped: list = []
    monkeypatch.setattr(main_mod, "start_scheduler", lambda cfg=None: started.append(cfg))
    monkeypatch.setattr(main_mod, "shutdown_scheduler", lambda: stopped.append(True))

    async with main_mod.lifespan(main_mod.app):
        assert started == [main_mod.settings]
        assert stopped == []

    assert stopped == [True]
