"""
Reports Router Tests (Pillars 1,2,3,5)
======================================
Exercises the submission pipeline and retrieval endpoint with all external
services mocked: report_store (Supabase), neo4j_service (graph), forensics, and
the authenticated user dependency.
"""

import io
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from backend.app import app
from backend.api.auth import get_current_user
from backend.models.auth import AuthUser
from backend.api import reports as reports_module

FAKE_USER = AuthUser(id="user-uuid-1", email="watchdog@example.com", role="authenticated")
PROJECT = {"id": "24HH0043", "latitude": 11.0505, "longitude": 124.0055}


def _photo_bytes() -> bytes:
    arr = np.tile(np.linspace(40, 200, 128, dtype=np.uint8).reshape(128, 1), (1, 128))
    img = Image.fromarray(np.stack([arr] * 3, axis=-1).astype("uint8"), "RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


class ReportsTestBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Default: authenticated. Individual tests can clear this override.
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

    def tearDown(self):
        app.dependency_overrides.clear()


class TestSubmitAuth(ReportsTestBase):
    def test_unauthenticated_returns_401(self):
        app.dependency_overrides.clear()  # restore the real cookie-based dependency
        resp = self.client.post(
            "/api/reports",
            data={"project_id": "24HH0043", "description": "No workers on site at all here."},
        )
        self.assertEqual(resp.status_code, 401)


class TestSubmitRateLimit(ReportsTestBase):
    def test_fourth_report_returns_429(self):
        with patch.object(reports_module.report_store, "recent_report_count", new=AsyncMock(return_value=3)):
            resp = self.client.post(
                "/api/reports",
                data={"project_id": "24HH0043", "description": "This is the fourth report today."},
            )
        self.assertEqual(resp.status_code, 429)
        self.assertIn("limit", resp.json()["detail"].lower())


class TestSubmitMissingProject(ReportsTestBase):
    def test_unknown_project_returns_404(self):
        with patch.object(reports_module.report_store, "recent_report_count", new=AsyncMock(return_value=0)), \
             patch.object(reports_module.neo4j_service, "get_project_by_id", return_value=None):
            resp = self.client.post(
                "/api/reports",
                data={"project_id": "NOPE", "description": "Project does not exist in the graph."},
            )
        self.assertEqual(resp.status_code, 404)


class TestSubmitVerified(ReportsTestBase):
    def test_onsite_clean_photo_is_verified(self):
        inserted = {"id": "r1", "created_at": "2026-10-20T12:00:00+00:00"}
        with patch.object(reports_module.report_store, "recent_report_count", new=AsyncMock(return_value=0)), \
             patch.object(reports_module.neo4j_service, "get_project_by_id", return_value=PROJECT), \
             patch.object(reports_module.report_store, "all_phashes", new=AsyncMock(return_value=[])), \
             patch.object(reports_module.report_store, "upload_photo", new=AsyncMock(return_value="https://x/photo.jpg")), \
             patch.object(reports_module.report_store, "insert_report", new=AsyncMock(return_value=inserted)), \
             patch.object(reports_module.reputation_service, "get_score", new=AsyncMock(return_value=50)), \
             patch.object(reports_module.reputation_service, "apply_report_outcome", new=AsyncMock(return_value={"score": 59})), \
             patch.object(reports_module.neo4j_service, "add_report_link", return_value=1):
            resp = self.client.post(
                "/api/reports",
                data={
                    "project_id": "24HH0043",
                    "description": "Concrete works match the posted scope and schedule.",
                    "latitude": "11.0509",
                    "longitude": "124.0055",
                },
                files={"picture": ("photo.jpg", _photo_bytes(), "image/jpeg")},
            )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["status"], "verified")
        self.assertTrue(body["geofence_pass"])
        self.assertEqual(body["forensics_verdict"], "clean")
        self.assertEqual(body["reporter_reputation"], 59)


class TestSubmitOffsiteFlagged(ReportsTestBase):
    def test_offsite_is_flagged(self):
        with patch.object(reports_module.report_store, "recent_report_count", new=AsyncMock(return_value=0)), \
             patch.object(reports_module.neo4j_service, "get_project_by_id", return_value=PROJECT), \
             patch.object(reports_module.report_store, "all_phashes", new=AsyncMock(return_value=[])), \
             patch.object(reports_module.report_store, "upload_photo", new=AsyncMock(return_value="https://x/p.jpg")), \
             patch.object(reports_module.report_store, "insert_report", new=AsyncMock(return_value={"id": "r2"})), \
             patch.object(reports_module.reputation_service, "get_score", new=AsyncMock(return_value=50)), \
             patch.object(reports_module.reputation_service, "apply_report_outcome", new=AsyncMock(return_value={"score": 46})), \
             patch.object(reports_module.neo4j_service, "add_report_link", return_value=1):
            resp = self.client.post(
                "/api/reports",
                data={
                    "project_id": "24HH0043",
                    "description": "Reporting from very far away from the actual site.",
                    "latitude": "11.0800",   # ~3km north -> outside geofence
                    "longitude": "124.0055",
                },
                files={"picture": ("photo.jpg", _photo_bytes(), "image/jpeg")},
            )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertFalse(body["geofence_pass"])
        self.assertEqual(body["status"], "flagged")


class TestSubmitRecycledFlagged(ReportsTestBase):
    def test_recycled_photo_is_flagged(self):
        photo = _photo_bytes()
        from backend.services import forensics as fsvc
        prior_hash = fsvc.perceptual_hash(photo)  # same photo already on record
        with patch.object(reports_module.report_store, "recent_report_count", new=AsyncMock(return_value=0)), \
             patch.object(reports_module.neo4j_service, "get_project_by_id", return_value=PROJECT), \
             patch.object(reports_module.report_store, "all_phashes", new=AsyncMock(return_value=[prior_hash])), \
             patch.object(reports_module.report_store, "upload_photo", new=AsyncMock(return_value="https://x/p.jpg")), \
             patch.object(reports_module.report_store, "insert_report", new=AsyncMock(return_value={"id": "r3"})), \
             patch.object(reports_module.reputation_service, "get_score", new=AsyncMock(return_value=50)), \
             patch.object(reports_module.reputation_service, "apply_report_outcome", new=AsyncMock(return_value={"score": 43})), \
             patch.object(reports_module.neo4j_service, "add_report_link", return_value=1):
            resp = self.client.post(
                "/api/reports",
                data={
                    "project_id": "24HH0043",
                    "description": "Submitting a photo that was already used before now.",
                    "latitude": "11.0509",
                    "longitude": "124.0055",
                },
                files={"picture": ("photo.jpg", photo, "image/jpeg")},
            )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertTrue(body["phash_recycled"])
        self.assertEqual(body["forensics_verdict"], "recycled")
        self.assertEqual(body["status"], "flagged")


class TestListReports(ReportsTestBase):
    def test_retrieval_returns_badged_reports(self):
        rows = [
            {
                "id": "r2", "project_id": "24HH0043", "status": "verified",
                "distance_meters": 45, "geofence_pass": True, "ela_score": 0.5,
                "phash_recycled": False, "forensics_verdict": "clean",
                "reporter_reputation": 59, "created_at": "2026-10-20T13:00:00+00:00",
                "description": "Newer report", "category": "delay",
                "photo_url": "https://x/p2.jpg", "latitude": 11.05, "longitude": 124.0,
            },
            {
                "id": "r1", "project_id": "24HH0043", "status": "flagged",
                "distance_meters": 3000, "geofence_pass": False, "ela_score": 0.4,
                "phash_recycled": False, "forensics_verdict": "clean",
                "reporter_reputation": 46, "created_at": "2026-10-20T12:00:00+00:00",
                "description": "Older report", "category": "other",
                "photo_url": None, "latitude": None, "longitude": None,
            },
        ]
        with patch.object(reports_module.report_store, "list_reports_by_project", new=AsyncMock(return_value=rows)):
            resp = self.client.get("/api/reports/24HH0043")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["count"], 2)
        self.assertEqual(body["reports"][0]["status"], "verified")
        self.assertEqual(body["reports"][0]["distance_meters"], 45)
        self.assertEqual(body["reports"][1]["status"], "flagged")


if __name__ == "__main__":
    unittest.main()
