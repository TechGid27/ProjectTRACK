"""
Report Store Service Tests (mocked httpx)
=========================================
Validates the Supabase PostgREST + Storage client WITHOUT any network calls by
patching httpx.AsyncClient. Asserts correct endpoints, params, payloads, header
auth (service key), count parsing, and error mapping.
"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.report_store import ReportStore, ReportStoreError


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, headers=None, content=b"x"):
        self.status_code = status_code
        self._json = json_data if json_data is not None else []
        self.headers = headers or {}
        self.content = content

    def json(self):
        return self._json


class FakeAsyncClient:
    """Stand-in for httpx.AsyncClient that records the last request and replays a response."""

    last_call = {}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def _record(self, method, url, **kwargs):
        FakeAsyncClient.last_call = {"method": method, "url": url, **kwargs}
        return FakeAsyncClient.response

    async def post(self, url, **kwargs):
        return await self._record("POST", url, **kwargs)

    async def get(self, url, **kwargs):
        return await self._record("GET", url, **kwargs)


def configure(monkeypatched_store: ReportStore):
    """Point the store at a fake Supabase project so is_configured() is True."""
    from backend.config import settings
    settings.SUPABASE_URL = "https://proj.supabase.co"
    settings.SUPABASE_SERVICE_KEY = "service-role-key"
    settings.SUPABASE_REPORT_BUCKET = "report-photos"


class ReportStoreTestBase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = ReportStore()
        configure(self.store)
        FakeAsyncClient.last_call = {}

    def _patch(self, response):
        FakeAsyncClient.response = response
        return patch("backend.services.report_store.httpx.AsyncClient", FakeAsyncClient)


class TestInsertReport(ReportStoreTestBase):
    async def test_insert_posts_row_and_returns_record(self):
        saved = {"id": "r1", "project_id": "24HH0043", "status": "verified"}
        with self._patch(FakeResponse(201, [saved])):
            result = await self.store.insert_report({"project_id": "24HH0043"})
        self.assertEqual(result, saved)
        call = FakeAsyncClient.last_call
        self.assertEqual(call["method"], "POST")
        self.assertTrue(call["url"].endswith("/rest/v1/reports"))
        # Service-role auth headers present.
        self.assertEqual(call["headers"]["apikey"], "service-role-key")
        self.assertIn("return=representation", call["headers"]["Prefer"])

    async def test_insert_maps_error_status(self):
        with self._patch(FakeResponse(400, {"message": "bad insert"})):
            with self.assertRaises(ReportStoreError) as ctx:
                await self.store.insert_report({"project_id": "x"})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("bad insert", ctx.exception.message)


class TestListReports(ReportStoreTestBase):
    async def test_list_orders_newest_first(self):
        rows = [{"id": "r2"}, {"id": "r1"}]
        with self._patch(FakeResponse(200, rows)):
            result = await self.store.list_reports_by_project("24HH0043")
        self.assertEqual(result, rows)
        call = FakeAsyncClient.last_call
        self.assertEqual(call["params"]["project_id"], "eq.24HH0043")
        self.assertEqual(call["params"]["order"], "created_at.desc")


class TestRecentReportCount(ReportStoreTestBase):
    async def test_count_parsed_from_content_range(self):
        since = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with self._patch(FakeResponse(200, [], headers={"content-range": "0-0/3"})):
            count = await self.store.recent_report_count("user-1", since)
        self.assertEqual(count, 3)
        call = FakeAsyncClient.last_call
        self.assertEqual(call["params"]["reporter_id"], "eq.user-1")
        self.assertTrue(call["params"]["created_at"].startswith("gte."))
        self.assertIn("count=exact", call["headers"]["Prefer"])

    async def test_count_falls_back_to_row_length(self):
        since = datetime(2026, 1, 1, tzinfo=timezone.utc)
        with self._patch(FakeResponse(200, [{"id": "a"}, {"id": "b"}], headers={})):
            count = await self.store.recent_report_count("user-1", since)
        self.assertEqual(count, 2)


class TestAllPhashes(ReportStoreTestBase):
    async def test_returns_non_null_hashes(self):
        rows = [{"phash": "abc"}, {"phash": None}, {"phash": "def"}, {}]
        with self._patch(FakeResponse(200, rows)):
            hashes = await self.store.all_phashes()
        self.assertEqual(hashes, ["abc", "def"])
        call = FakeAsyncClient.last_call
        self.assertEqual(call["params"]["phash"], "not.is.null")


class TestUploadPhoto(ReportStoreTestBase):
    async def test_upload_returns_public_url(self):
        with self._patch(FakeResponse(200, {"Key": "report-photos/x.jpg"})):
            url = await self.store.upload_photo("24HH0043/x.jpg", b"\xff\xd8", "image/jpeg")
        self.assertEqual(
            url,
            "https://proj.supabase.co/storage/v1/object/public/report-photos/24HH0043/x.jpg",
        )
        call = FakeAsyncClient.last_call
        self.assertEqual(call["headers"]["Content-Type"], "image/jpeg")
        self.assertEqual(call["content"], b"\xff\xd8")


class TestReputation(ReportStoreTestBase):
    async def test_get_reputation_returns_row_or_none(self):
        with self._patch(FakeResponse(200, [{"user_id": "u1", "score": 5}])):
            rep = await self.store.get_reputation("u1")
        self.assertEqual(rep["score"], 5)

        with self._patch(FakeResponse(200, [])):
            rep = await self.store.get_reputation("u2")
        self.assertIsNone(rep)

    async def test_upsert_uses_merge_duplicates(self):
        rec = {"user_id": "u1", "score": 7}
        with self._patch(FakeResponse(200, [rec])):
            result = await self.store.upsert_reputation(rec)
        self.assertEqual(result, rec)
        call = FakeAsyncClient.last_call
        self.assertEqual(call["params"]["on_conflict"], "user_id")
        self.assertIn("merge-duplicates", call["headers"]["Prefer"])


class TestNotConfigured(unittest.IsolatedAsyncioTestCase):
    async def test_raises_503_when_unconfigured(self):
        from backend.config import settings
        saved_url, saved_key = settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
        settings.SUPABASE_URL = None
        settings.SUPABASE_SERVICE_KEY = None
        try:
            store = ReportStore()
            with self.assertRaises(ReportStoreError) as ctx:
                await store.insert_report({"project_id": "x"})
            self.assertEqual(ctx.exception.status_code, 503)
        finally:
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY = saved_url, saved_key


if __name__ == "__main__":
    unittest.main()
