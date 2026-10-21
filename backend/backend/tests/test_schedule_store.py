"""
Schedule Store Tests (mocked httpx)
===================================
Validates pipeline_schedule_state reads/writes and graceful degradation when
Supabase is unconfigured or returns an error.
"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.schedule_store import ScheduleStore


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, content=b"x"):
        self.status_code = status_code
        self._json = json_data if json_data is not None else []
        self.content = content

    def json(self):
        return self._json


class FakeAsyncClient:
    last_call = {}
    response = FakeResponse()

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, **kwargs):
        FakeAsyncClient.last_call = {"method": "GET", "url": url, **kwargs}
        return FakeAsyncClient.response

    async def post(self, url, **kwargs):
        FakeAsyncClient.last_call = {"method": "POST", "url": url, **kwargs}
        return FakeAsyncClient.response


class ScheduleStoreTestBase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from backend.config import settings
        self._saved = (settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        settings.SUPABASE_URL = "https://proj.supabase.co"
        settings.SUPABASE_SERVICE_KEY = "svc"
        self.store = ScheduleStore()
        FakeAsyncClient.last_call = {}

    def tearDown(self):
        from backend.config import settings
        settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY = self._saved

    def _patch(self, response):
        FakeAsyncClient.response = response
        return patch("backend.services.schedule_store.httpx.AsyncClient", FakeAsyncClient)


class TestGetLastRun(ScheduleStoreTestBase):
    async def test_parses_timestamp(self):
        rows = [{"job_name": "passive_scrape", "last_run_at": "2026-01-01T00:00:00+00:00"}]
        with self._patch(FakeResponse(200, rows)):
            dt = await self.store.get_last_run("passive_scrape")
        self.assertEqual(dt, datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.assertEqual(FakeAsyncClient.last_call["params"]["job_name"], "eq.passive_scrape")

    async def test_missing_row_returns_none(self):
        with self._patch(FakeResponse(200, [])):
            self.assertIsNone(await self.store.get_last_run("passive_scrape"))

    async def test_error_returns_none(self):
        with self._patch(FakeResponse(500, {})):
            self.assertIsNone(await self.store.get_last_run("passive_scrape"))


class TestStampRun(ScheduleStoreTestBase):
    async def test_upsert_merges_on_job_name(self):
        with self._patch(FakeResponse(201, [])):
            ok = await self.store.stamp_run("passive_scrape", "completed", "job-1")
        self.assertTrue(ok)
        call = FakeAsyncClient.last_call
        self.assertEqual(call["params"]["on_conflict"], "job_name")
        self.assertIn("merge-duplicates", call["headers"]["Prefer"])
        self.assertEqual(call["json"]["last_status"], "completed")

    async def test_failure_returns_false(self):
        with self._patch(FakeResponse(400, {})):
            self.assertFalse(await self.store.stamp_run("passive_scrape", "failed"))


class TestUnconfigured(unittest.IsolatedAsyncioTestCase):
    async def test_degrades_gracefully(self):
        from backend.config import settings
        saved = settings.SUPABASE_URL
        settings.SUPABASE_URL = None
        try:
            store = ScheduleStore()
            self.assertIsNone(await store.get_last_run("x"))
            self.assertFalse(await store.stamp_run("x", "completed"))
        finally:
            settings.SUPABASE_URL = saved


if __name__ == "__main__":
    unittest.main()
