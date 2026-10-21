"""
Neo4j Service Report-Ranking Tests (mocked driver)
==================================================
Validates get_top_reported_projects() Cypher parameterization and row mapping
WITHOUT a live Neo4j connection by patching get_driver(). Covers the province-
wide branch (muni_token=None), the LGU-scoped branch, the status-aware count
expression, and the unknown-municipality short-circuit.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.neo4j_service import Neo4jService


class FakeSession:
    """Context-manager session whose .run(...) records params and replays rows."""

    last_cypher = None
    last_params = {}
    rows = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def run(self, cypher, **params):
        FakeSession.last_cypher = cypher
        FakeSession.last_params = params
        result = MagicMock()
        result.data.return_value = FakeSession.rows
        return result


class FakeDriver:
    def session(self):
        return FakeSession()


class TopReportedTestBase(unittest.TestCase):
    def setUp(self):
        self.svc = Neo4jService()
        FakeSession.last_cypher = None
        FakeSession.last_params = {}
        FakeSession.rows = []

    def _patch_driver(self):
        return patch.object(self.svc, "get_driver", return_value=FakeDriver())


class TestGetTopReportedProjects(TopReportedTestBase):
    def test_province_wide_passes_null_muni_token(self):
        FakeSession.rows = [
            {"id": "24HH0001", "report_count": 7, "description": "road", "latitude": 10.3, "longitude": 123.9},
        ]
        with self._patch_driver():
            rows = self.svc.get_top_reported_projects(municipality=None, limit=5)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["report_count"], 7)
        self.assertIsNone(FakeSession.last_params["muni_token"])
        self.assertEqual(FakeSession.last_params["limit"], 5)
        # Fast path uses the denormalized counter, not a :Report scan.
        self.assertIn("coalesce(p.report_count, 0)", FakeSession.last_cypher)

    def test_scoped_passes_canonical_token(self):
        FakeSession.rows = [{"id": "24HH0002", "report_count": 3, "description": "bridge"}]
        with self._patch_driver():
            rows = self.svc.get_top_reported_projects(municipality="Cebu City", limit=3)
        self.assertEqual(rows[0]["report_count"], 3)
        # "Cebu City" canonicalizes to "cebu" (trailing " city" stripped).
        self.assertEqual(FakeSession.last_params["muni_token"], "cebu")

    def test_status_aware_counts_report_nodes(self):
        FakeSession.rows = [{"id": "24HH0003", "report_count": 2, "description": "drainage"}]
        with self._patch_driver():
            self.svc.get_top_reported_projects(status="flagged")
        self.assertEqual(FakeSession.last_params["status"], "flagged")
        # Status-aware path counts linked :Report nodes with the verdict.
        self.assertIn("REPORTS_ON", FakeSession.last_cypher)
        self.assertIn("r.status", FakeSession.last_cypher)

    def test_unknown_municipality_short_circuits(self):
        with self._patch_driver():
            rows = self.svc.get_top_reported_projects(municipality="!!!")
        self.assertEqual(rows, [])

    def test_no_driver_returns_empty(self):
        with patch.object(self.svc, "get_driver", return_value=None):
            rows = self.svc.get_top_reported_projects()
        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
