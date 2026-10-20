"""
Supabase Schema Contract Tests
==============================
Validates the report-verification migration files WITHOUT a live database.
These guard the hybrid-persistence contract the backend services rely on:
required columns, indexes, RLS, and the storage bucket config.
"""

import re
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

MIGRATIONS = PROJECT_ROOT / "supabase" / "migrations"
SCHEMA_SQL = (MIGRATIONS / "0001_reports_verification.sql").read_text(encoding="utf-8").lower()
STORAGE_SQL = (MIGRATIONS / "0002_storage_report_photos.sql").read_text(encoding="utf-8").lower()


class TestReportsTableContract(unittest.TestCase):
    REQUIRED_COLUMNS = [
        "project_id", "reporter_id", "description", "category",
        "photo_url", "latitude", "longitude", "distance_meters",
        "geofence_pass", "ela_score", "phash", "phash_recycled",
        "forensics_verdict", "status", "reporter_reputation", "created_at",
    ]

    def test_reports_table_defined(self):
        self.assertIn("create table if not exists public.reports", SCHEMA_SQL)

    def test_reports_has_all_required_columns(self):
        for col in self.REQUIRED_COLUMNS:
            with self.subTest(column=col):
                self.assertRegex(SCHEMA_SQL, rf"\b{re.escape(col)}\b")

    def test_status_and_verdict_constraints(self):
        for token in ("verified", "pending", "flagged", "rejected"):
            self.assertIn(token, SCHEMA_SQL)
        for token in ("clean", "suspicious", "recycled"):
            self.assertIn(token, SCHEMA_SQL)

    def test_required_indexes_present(self):
        self.assertIn("reports_project_id_created_at_idx", SCHEMA_SQL)
        self.assertIn("reports_reporter_id_created_at_idx", SCHEMA_SQL)
        self.assertIn("reports_phash_idx", SCHEMA_SQL)


class TestReputationTableContract(unittest.TestCase):
    def test_reputation_table_defined(self):
        self.assertIn("create table if not exists public.user_reputation", SCHEMA_SQL)

    def test_reputation_columns(self):
        for col in ("user_id", "score", "reports_total", "reports_flagged", "updated_at"):
            with self.subTest(column=col):
                self.assertRegex(SCHEMA_SQL, rf"\b{re.escape(col)}\b")


class TestRowLevelSecurity(unittest.TestCase):
    def test_rls_enabled(self):
        self.assertIn("alter table public.reports enable row level security", SCHEMA_SQL)
        self.assertIn("alter table public.user_reputation enable row level security", SCHEMA_SQL)

    def test_public_read_and_scoped_insert(self):
        self.assertIn("reports_public_read", SCHEMA_SQL)
        self.assertIn("reports_insert_own", SCHEMA_SQL)
        # Insert must be scoped to the authenticated user's own id.
        self.assertIn("auth.uid() = reporter_id", SCHEMA_SQL)


class TestStorageBucketContract(unittest.TestCase):
    def test_bucket_created(self):
        self.assertIn("storage.buckets", STORAGE_SQL)
        self.assertIn("report-photos", STORAGE_SQL)

    def test_bucket_is_public_with_limits(self):
        self.assertIn("10485760", STORAGE_SQL)  # 10 MB limit
        self.assertIn("image/jpeg", STORAGE_SQL)

    def test_public_read_policy(self):
        self.assertIn("report photos public read", STORAGE_SQL)
        self.assertIn("bucket_id = 'report-photos'", STORAGE_SQL)


if __name__ == "__main__":
    unittest.main()
