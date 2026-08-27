"""In-process job scheduler for recurring background work.

A single :class:`~apscheduler.schedulers.asyncio.AsyncIOScheduler` runs on the
FastAPI event loop and owns one job today: the daily expiring-items /
low-stock digest (see :meth:`NotificationService.run_daily_notifications`).

**Single-instance assumption.** The scheduler has no shared job store, so every
process that starts it runs the job. When scaling to several replicas, set
``NOTIFICATIONS_SCHEDULER_ENABLED=false`` on all but one. The per-day dispatch
records in ``notification_dispatches`` still stop duplicate digests if two
processes race.

Everything here is defensive: a scheduler that cannot start must never take the
API down with it, so failures are logged and swallowed.
"""
from typing import Any, Optional

from src.config import Settings, get_settings
from src.core.logging import setup_logging
from src.services.notification_service import NotificationService

logger = setup_logging()

# Job identifier, stable so restarts replace rather than duplicate the job.
NOTIFICATION_JOB_ID = "daily_notifications"

# Module-level singleton; None whenever no scheduler is running.
_scheduler: Optional[Any] = None


def get_scheduler() -> Optional[Any]:
    """Return the running scheduler, or None when none is active."""
    return _scheduler


async def run_notification_job() -> None:
    """
    Run the daily notification digest in its own database session.

    Invoked by APScheduler, which has nowhere to report an exception to, so
    every failure is caught and logged here.
    """
    from src.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            summary = await NotificationService.run_daily_notifications(session)
            await session.commit()
        logger.info("Scheduled notification job finished", **summary)
    except Exception as exc:
        logger.error("Scheduled notification job failed", error=str(exc))


def start_scheduler(app_settings: Optional[Settings] = None) -> Optional[Any]:
    """
    Start the background scheduler if the environment allows it.

    Inert during tests and whenever ``NOTIFICATIONS_SCHEDULER_ENABLED`` is
    false. Never raises: a scheduler that fails to start is logged and the
    application continues without background jobs.

    Args:
        app_settings: Application settings (defaults to the cached ones)

    Returns:
        The running scheduler, or None if it was not started
    """
    global _scheduler

    config = app_settings or get_settings()

    if config.ENVIRONMENT == "test":
        logger.info("Scheduler not started: test environment")
        return None

    if not config.NOTIFICATIONS_SCHEDULER_ENABLED:
        logger.info("Scheduler not started: disabled by configuration")
        return None

    if _scheduler is not None:
        logger.info("Scheduler already running")
        return _scheduler

    try:
        # Imported lazily so a missing optional dependency degrades to "no
        # background jobs" instead of breaking application startup.
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler(timezone=config.NOTIFICATIONS_TIMEZONE)
        scheduler.add_job(
            run_notification_job,
            trigger=CronTrigger(
                hour=config.NOTIFICATIONS_SCHEDULE_HOUR,
                minute=config.NOTIFICATIONS_SCHEDULE_MINUTE,
                timezone=config.NOTIFICATIONS_TIMEZONE,
            ),
            id=NOTIFICATION_JOB_ID,
            name="Daily expiring-items and low-stock notifications",
            replace_existing=True,
            coalesce=True,  # one run after a downtime gap, not a burst
            max_instances=1,
            misfire_grace_time=3600,
        )
        scheduler.start()
    except Exception as exc:
        logger.error("Failed to start scheduler", error=str(exc))
        return None

    _scheduler = scheduler
    logger.info(
        "Scheduler started",
        job_id=NOTIFICATION_JOB_ID,
        hour=config.NOTIFICATIONS_SCHEDULE_HOUR,
        minute=config.NOTIFICATIONS_SCHEDULE_MINUTE,
        timezone=config.NOTIFICATIONS_TIMEZONE,
    )
    return scheduler


def shutdown_scheduler() -> None:
    """Stop the scheduler if one is running. Never raises."""
    global _scheduler

    if _scheduler is None:
        return

    try:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
    except Exception as exc:
        logger.warning("Failed to stop scheduler cleanly", error=str(exc))
    finally:
        _scheduler = None
