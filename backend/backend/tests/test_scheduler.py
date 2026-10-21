"""
Passive Scheduler Tests (mocked pipeline + schedule store)
==========================================================
Exercises the durable-guard due calculation, no-overlap protection, the
scrape+sync cycle (with and without sync), failure resilience, and the status
snapshot — all without APScheduler, Supabase, Apify, or Neo4j.
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.services import scheduler as sched_mod


class SchedulerTestBase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sched = sched_mod.PassiveScrapeScheduler()
        self._saved = {
            "enabled": settings.PASSIVE_SCRAPE_ENABLED,
            "interval": settings.PASSIVE_SCRAPE_INTERVAL_DAYS,
            "sync": settings.PASSIVE_SCRAPE_SYNC_AFTER,
        }
        settings.PASSIVE_SCRAPE_INTERVAL_DAYS = 90
        settings.PASSIVE_SCRAPE_SYNC_AFTER = True

    def tearDown(self):
        settings.PASSIVE_SCRAPE_ENABLED = self._saved["enabled"]
        settings.PASSIVE_SCRAPE_INTERVAL_DAYS = self._saved["interval"]
        settings.PASSIVE_SCRAPE_SYNC_AFTER = self._saved["sync"]


class TestDueCalculation(SchedulerTestBase):
    async def test_due_when_no_last_run(self):
        with patch.object(sched_mod.schedule_store, "get_last_run", AsyncMock(return_value=None)):
            self.assertTrue(await self.sched.is_due())

    async def test_not_due_within_interval(self):
        recent = datetime.now(timezone.utc) - timedelta(days=10)
        with patch.object(sched_mod.schedule_store, "get_last_run", AsyncMock(return_value=recent)):
            self.assertFalse(await self.sched.is_due())

    async def test_due_after_interval(self):
        old = datetime.now(timezone.utc) - timedelta(days=120)
        with patch.object(sched_mod.schedule_store, "get_last_run", AsyncMock(return_value=old)):
            self.assertTrue(await self.sched.is_due())


class TestRunCycle(SchedulerTestBase):
    async def test_skips_when_not_due(self):
        with patch.object(self.sched, "is_due", AsyncMock(return_value=False)), \
             patch.object(sched_mod.pipeline_manager, "create_job") as create:
            ran = await self.sched.run_cycle()
        self.assertFalse(ran)
        create.assert_not_called()

    async def test_runs_scrape_then_sync_and_stamps(self):
        job = MagicMock(job_id="job-1")
        with patch.object(self.sched, "is_due", AsyncMock(return_value=True)), \
             patch.object(sched_mod.pipeline_manager, "create_job", return_value=job), \
             patch.object(sched_mod.pipeline_manager, "run_scrape_job", AsyncMock()) as scrape, \
             patch.object(sched_mod.pipeline_manager, "run_sync_job", AsyncMock()) as sync, \
             patch.object(sched_mod.schedule_store, "stamp_run", AsyncMock(return_value=True)) as stamp:
            ran = await self.sched.run_cycle()
        self.assertTrue(ran)
        scrape.assert_awaited_once()
        sync.assert_awaited_once()
        # Final stamp marks completion.
        self.assertEqual(stamp.await_args_list[-1].args[1], "completed")

    async def test_skips_sync_when_disabled(self):
        settings.PASSIVE_SCRAPE_SYNC_AFTER = False
        job = MagicMock(job_id="job-2")
        with patch.object(self.sched, "is_due", AsyncMock(return_value=True)), \
             patch.object(sched_mod.pipeline_manager, "create_job", return_value=job), \
             patch.object(sched_mod.pipeline_manager, "run_scrape_job", AsyncMock()), \
             patch.object(sched_mod.pipeline_manager, "run_sync_job", AsyncMock()) as sync, \
             patch.object(sched_mod.schedule_store, "stamp_run", AsyncMock(return_value=True)):
            await self.sched.run_cycle()
        sync.assert_not_called()

    async def test_force_bypasses_due_guard(self):
        job = MagicMock(job_id="job-3")
        with patch.object(self.sched, "is_due", AsyncMock(return_value=False)) as due, \
             patch.object(sched_mod.pipeline_manager, "create_job", return_value=job), \
             patch.object(sched_mod.pipeline_manager, "run_scrape_job", AsyncMock()), \
             patch.object(sched_mod.pipeline_manager, "run_sync_job", AsyncMock()), \
             patch.object(sched_mod.schedule_store, "stamp_run", AsyncMock(return_value=True)):
            ran = await self.sched.run_cycle(force=True)
        self.assertTrue(ran)
        due.assert_not_called()

    async def test_failure_is_stamped_not_raised(self):
        job = MagicMock(job_id="job-4")
        with patch.object(self.sched, "is_due", AsyncMock(return_value=True)), \
             patch.object(sched_mod.pipeline_manager, "create_job", return_value=job), \
             patch.object(sched_mod.pipeline_manager, "run_scrape_job", AsyncMock(side_effect=RuntimeError("boom"))), \
             patch.object(sched_mod.schedule_store, "stamp_run", AsyncMock(return_value=True)) as stamp:
            ran = await self.sched.run_cycle()
        self.assertFalse(ran)
        self.assertEqual(stamp.await_args_list[-1].args[1], "failed")


class TestStatus(SchedulerTestBase):
    async def test_status_projects_next_run(self):
        last = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with patch.object(sched_mod.schedule_store, "get_last_run", AsyncMock(return_value=last)):
            status = await self.sched.status()
        self.assertEqual(status["interval_days"], 90)
        self.assertEqual(status["last_run_at"], last.isoformat())
        self.assertEqual(status["next_run_at"], (last + timedelta(days=90)).isoformat())


if __name__ == "__main__":
    unittest.main()
