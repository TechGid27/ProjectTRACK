"""
Passive Scrape Scheduler (APScheduler)
======================================
Keeps the deployed knowledge graph fresh by re-scraping DPWH/PhilGEPS on a
recurring interval (default ~90 days) and syncing new records into Neo4j — with
no manual trigger. Built on APScheduler's AsyncIOScheduler so it shares the
FastAPI event loop and starts/stops cleanly in the app lifespan.

Safety properties:
  * ``max_instances=1`` + ``coalesce=True``        — never overlap or stampede.
  * ``misfire_grace_time``                          — a run that came due while
    the server was down still fires after restart.
  * Durable last-run guard (``schedule_store``)     — a cycle only proceeds when
    the Supabase-recorded ``last_run_at`` is older than the interval, so
    restarts/redeploys don't reset the clock and multiple replicas won't double
    up. Falls back to an in-memory start time if Supabase is unconfigured.
  * Exceptions are caught and logged                — the loop never crashes the
    app; the next tick simply tries again.

NOTE (multi-replica): the durable guard reduces, but with simultaneous ticks
cannot fully guarantee, single execution across many replicas. For a single
backend instance (the common deployment) it is exact.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.config import settings
from backend.services.pipeline_service import pipeline_manager
from backend.services.schedule_store import schedule_store

logger = logging.getLogger("passive_scheduler")


class PassiveScrapeScheduler:
    """Orchestrates recurring scrape+sync cycles with a durable last-run guard."""

    def __init__(self) -> None:
        self._scheduler = None  # APScheduler AsyncIOScheduler (lazy)
        self._started_at = datetime.now(timezone.utc)
        self._fallback_last_run: Optional[datetime] = None
        self._running = False

    # -- scheduling lifecycle -------------------------------------------------
    def start(self) -> bool:
        """
        Start the background scheduler if enabled. Returns True when started.
        Safe to call once from the FastAPI lifespan; no-op when disabled.
        """
        if not settings.PASSIVE_SCRAPE_ENABLED:
            logger.info("Passive scraper disabled (PASSIVE_SCRAPE_ENABLED=false).")
            return False
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from apscheduler.triggers.interval import IntervalTrigger
        except ImportError:
            logger.warning("APScheduler not installed; passive scraper unavailable.")
            return False

        interval_days = max(1, int(settings.PASSIVE_SCRAPE_INTERVAL_DAYS))
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        # First fire: shortly after boot if configured to catch up, else after a
        # full interval. The durable guard still decides whether work runs.
        first_delay = timedelta(minutes=1) if settings.PASSIVE_SCRAPE_RUN_ON_STARTUP else timedelta(days=interval_days)
        self._scheduler.add_job(
            self.run_cycle,
            trigger=IntervalTrigger(days=interval_days),
            next_run_time=datetime.now(timezone.utc) + first_delay,
            id=settings.PASSIVE_SCRAPE_JOB_NAME,
            name="Passive DPWH scrape + Neo4j sync",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,  # 1h grace for missed fires after downtime
            replace_existing=True,
        )
        self._scheduler.start()
        logger.info(
            "Passive scraper started: every %d day(s), first run %s.",
            interval_days,
            "in ~1 minute" if settings.PASSIVE_SCRAPE_RUN_ON_STARTUP else f"in {interval_days} day(s)",
        )
        return True

    def shutdown(self) -> None:
        """Stop the scheduler without waiting on in-flight jobs (lifespan teardown)."""
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown(wait=False)
            except Exception as e:  # pragma: no cover - defensive
                logger.warning("Scheduler shutdown error: %s", e)
            self._scheduler = None

    # -- due calculation ------------------------------------------------------
    async def _last_run(self) -> Optional[datetime]:
        """Durable last-run from Supabase, falling back to the in-memory value."""
        stamped = await schedule_store.get_last_run(settings.PASSIVE_SCRAPE_JOB_NAME)
        if stamped is not None:
            return stamped
        return self._fallback_last_run

    async def is_due(self, now: Optional[datetime] = None) -> bool:
        """True when no run has happened within the configured interval."""
        now = now or datetime.now(timezone.utc)
        last = await self._last_run()
        if last is None:
            return True
        interval = timedelta(days=max(1, int(settings.PASSIVE_SCRAPE_INTERVAL_DAYS)))
        # Normalize naive timestamps to UTC for a safe comparison.
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        return (now - last) >= interval

    # -- the cycle ------------------------------------------------------------
    async def run_cycle(self, force: bool = False) -> bool:
        """
        Run one scrape (+optional sync) cycle if due (or forced). Returns True if
        a cycle executed, False if skipped/guarded. Never raises — failures are
        logged and stamped so the next tick can retry.
        """
        if self._running:
            logger.info("Passive cycle already running; skipping this tick.")
            return False
        if not force and not await self.is_due():
            logger.info("Passive scrape not due yet; skipping.")
            return False

        self._running = True
        started = datetime.now(timezone.utc)
        job_id = None
        try:
            # Scrape stage (Apify -> Supabase).
            scrape_job = pipeline_manager.create_job(job_type="scrape")
            job_id = scrape_job.job_id
            await schedule_store.stamp_run(
                settings.PASSIVE_SCRAPE_JOB_NAME, "running", job_id, started
            )
            await pipeline_manager.run_scrape_job(
                scrape_job.job_id, max_items=settings.PASSIVE_SCRAPE_MAX_ITEMS
            )

            # Sync stage (Supabase -> Neo4j), optional.
            if settings.PASSIVE_SCRAPE_SYNC_AFTER:
                sync_job = pipeline_manager.create_job(job_type="sync")
                await pipeline_manager.run_sync_job(sync_job.job_id)

            self._fallback_last_run = started
            await schedule_store.stamp_run(
                settings.PASSIVE_SCRAPE_JOB_NAME, "completed", job_id, started
            )
            logger.info("Passive scrape+sync cycle completed.")
            return True
        except Exception as e:  # pragma: no cover - defensive; workers already guard
            logger.error("Passive scrape cycle failed: %s", e)
            self._fallback_last_run = started
            await schedule_store.stamp_run(
                settings.PASSIVE_SCRAPE_JOB_NAME, "failed", job_id, started
            )
            return False
        finally:
            self._running = False

    # -- introspection --------------------------------------------------------
    async def status(self) -> dict:
        """Snapshot for the GET /pipeline/schedule endpoint."""
        last = await self._last_run()
        interval_days = max(1, int(settings.PASSIVE_SCRAPE_INTERVAL_DAYS))
        next_run = None
        if last is not None:
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            next_run = last + timedelta(days=interval_days)
        return {
            "enabled": settings.PASSIVE_SCRAPE_ENABLED,
            "interval_days": interval_days,
            "last_run_at": last.isoformat() if last else None,
            "next_run_at": next_run.isoformat() if next_run else None,
            "sync_after": settings.PASSIVE_SCRAPE_SYNC_AFTER,
            "running": self._running,
            "job_name": settings.PASSIVE_SCRAPE_JOB_NAME,
        }


# Module-level singleton used by the app lifespan and the pipeline API.
passive_scheduler = PassiveScrapeScheduler()
