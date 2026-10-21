"""
Chat Reports-Intent Tests
=========================
Covers the "most reported" / "most flagged" single-project focus added on top
of the existing superlative machinery: intent detection, project selection
(graph count vs. status-aware Supabase count), province-wide focus, LGU-scoped
focus, and seamless intent switching across a location continuation.

Neo4j and Supabase are mocked, so no live services are required.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.api import chat as chat_mod


class TestIntentDetection(unittest.TestCase):
    def test_reports_cues(self):
        f = chat_mod._detect_single_project_intent
        self.assertEqual(f("which is the most reported project"), "most_reported")
        self.assertEqual(f("show the most complained about project"), "most_reported")
        self.assertEqual(f("project with the highest number of reports"), "most_reported")
        self.assertEqual(f("the most flagged project"), "most_flagged")
        self.assertEqual(f("most suspicious reports"), "most_flagged")

    def test_other_intents_unaffected(self):
        f = chat_mod._detect_single_project_intent
        self.assertEqual(f("the most expensive one"), "max_budget")
        self.assertEqual(f("cheapest project"), "min_budget")
        self.assertIsNone(f("projects in Cordova"))

    def test_plural_overview_is_not_single_project(self):
        f = chat_mod._detect_single_project_intent
        # Plural/list phrasing is an overview, even with a ranking word.
        self.assertIsNone(f("Show top infrastructure projects in Mandaue City"))
        self.assertIsNone(f("What are the projects in Cordova?"))
        self.assertIsNone(f("list all projects in Toledo"))
        self.assertIsNone(f("how many projects are in Bogo"))

    def test_singular_top_is_single_project(self):
        f = chat_mod._detect_single_project_intent
        # Singular "top project" / "top one" still focuses a single project.
        self.assertEqual(f("show the top project in Mandaue"), "max_budget")
        self.assertEqual(f("what is the top one?"), "max_budget")


class TestSelectProjectForIntent(unittest.TestCase):
    def _rows(self):
        return [
            {"id": "24HH0001", "latitude": 10.3, "longitude": 123.9, "report_count": 2, "budget_num": 5e6},
            {"id": "24HH0002", "latitude": 10.4, "longitude": 123.8, "report_count": 9, "budget_num": 1e6},
        ]

    def test_most_reported_uses_graph_count(self):
        chosen = chat_mod._select_project_for_intent("most_reported", self._rows(), None)
        self.assertEqual(chosen["id"], "24HH0002")  # highest report_count

    def test_most_flagged_uses_override_counts(self):
        counts = {"24HH0001": 7, "24HH0002": 1}  # flips the ranking
        chosen = chat_mod._select_project_for_intent(
            "most_flagged", self._rows(), None, report_counts=counts
        )
        self.assertEqual(chosen["id"], "24HH0001")

    def test_returns_none_when_no_reports(self):
        rows = [{"id": "x", "latitude": 1, "longitude": 1, "report_count": 0}]
        self.assertIsNone(chat_mod._select_project_for_intent("most_reported", rows, None))


class TestProvinceWideResolution(unittest.IsolatedAsyncioTestCase):
    async def test_province_wide_most_reported_focus(self):
        top_row = {
            "id": "24HH0099", "entity": "24HH0099", "latitude": 10.5, "longitude": 123.7,
            "municipality": "Toledo City", "description": "flood control",
            "status": "Ongoing", "budget": "P5M", "budget_num": 5e6, "report_count": 12,
        }
        with patch.object(chat_mod.neo4j_service, "get_top_reported_projects", return_value=[top_row]), \
             patch.object(chat_mod.neo4j_service, "get_project_by_id", return_value={"id": "24HH0099"}):
            _, matched, graph_context, spatial = await chat_mod.resolve_project_context(
                "which project is the most reported in Cebu?", history=[]
            )
        self.assertIn("Field Reports: 12", graph_context)
        self.assertIsNotNone(spatial)
        self.assertEqual(spatial.total_count, 1)
        self.assertEqual(spatial.zoom, 16)
        self.assertEqual(spatial.projects[0].report_count, 12)
        self.assertEqual(spatial.projects[0].id, "24HH0099")


class TestScopedResolution(unittest.IsolatedAsyncioTestCase):
    async def test_scoped_most_reported_in_lgu(self):
        loc_rows = [
            {"entity": "24HH0001", "latitude": 10.3, "longitude": 123.9, "report_count": 2,
             "budget_num": 5e6, "description": "road", "status": "Ongoing", "municipality": "Toledo City"},
            {"entity": "24HH0002", "latitude": 10.4, "longitude": 123.8, "report_count": 9,
             "budget_num": 1e6, "description": "bridge", "status": "Completed", "municipality": "Toledo City"},
        ]
        with patch.object(chat_mod.neo4j_service, "search_projects_by_location",
                          return_value=(loc_rows, 2, 6e6)), \
             patch.object(chat_mod.neo4j_service, "get_map_projects", return_value=loc_rows), \
             patch.object(chat_mod.neo4j_service, "get_project_by_id", return_value={"id": "24HH0002"}):
            _, _, graph_context, spatial = await chat_mod.resolve_project_context(
                "most reported project in Toledo", history=[]
            )
        self.assertEqual(spatial.projects[0].id, "24HH0002")  # 9 reports wins
        self.assertIn("Field Reports: 9", graph_context)
        self.assertEqual(spatial.zoom, 16)


class TestOverviewFollowup(unittest.IsolatedAsyncioTestCase):
    async def test_overview_does_not_inherit_prior_superlative(self):
        # Prior turn was a single-project superlative; a fresh explicit overview
        # request for a new LGU must return the overview, not inherit the focus.
        loc_rows = [
            {"entity": "24CO0001", "latitude": 10.25, "longitude": 123.95, "report_count": 0,
             "budget_num": 9e6, "description": "road A", "status": "Ongoing", "municipality": "Cordova"},
            {"entity": "24CO0002", "latitude": 10.26, "longitude": 123.96, "report_count": 0,
             "budget_num": 2e6, "description": "road B", "status": "Completed", "municipality": "Cordova"},
        ]
        hist = [
            {"role": "user", "content": "show the top project in Mandaue"},
            {"role": "assistant", "content": "The top Mandaue project is ..."},
        ]
        with patch.object(chat_mod.neo4j_service, "search_projects_by_location",
                          return_value=(loc_rows, 80, 11e6)), \
             patch.object(chat_mod.neo4j_service, "get_map_projects", return_value=loc_rows):
            targeted, matched, _, spatial = await chat_mod.resolve_project_context(
                "What are the projects in Cordova?", history=hist
            )
        self.assertIsNone(targeted)                 # not a single-project focus
        self.assertGreater(spatial.total_count, 1)  # overview (full count)
        self.assertEqual(spatial.zoom, 13)          # municipality zoom, not 16
        self.assertEqual(spatial.target_location, "Cordova")



class TestZeroReports(unittest.IsolatedAsyncioTestCase):
    async def test_province_wide_no_reports_is_honest(self):
        # No project has reports -> graph query returns empty.
        with patch.object(chat_mod.neo4j_service, "get_top_reported_projects", return_value=[]):
            targeted, matched, graph_context, spatial = await chat_mod.resolve_project_context(
                "what is the most reported project?", history=[]
            )
        self.assertIsNone(targeted)
        self.assertEqual(matched, [])
        self.assertIsNone(spatial)  # map is NOT moved to an unrelated project
        self.assertIn("no", graph_context.lower())
        self.assertIn("field report", graph_context.lower())

    async def test_scoped_no_reports_is_honest(self):
        # An LGU with projects but none having reports (report_count 0).
        loc_rows = [
            {"entity": "24LL0001", "latitude": 10.3, "longitude": 123.9, "report_count": 0,
             "budget_num": 5e6, "description": "road safety devices", "status": "Completed",
             "municipality": "Lapu-Lapu City"},
        ]
        with patch.object(chat_mod.neo4j_service, "get_top_reported_projects", return_value=[]), \
             patch.object(chat_mod.neo4j_service, "search_projects_by_location",
                          return_value=(loc_rows, 1, 5e6)), \
             patch.object(chat_mod.neo4j_service, "get_map_projects", return_value=loc_rows), \
             patch.object(chat_mod.neo4j_service, "get_project_by_id", return_value=None):
            targeted, matched, graph_context, spatial = await chat_mod.resolve_project_context(
                "most reported project in Lapu-Lapu City", history=[]
            )
        self.assertIsNone(targeted)
        self.assertIsNone(spatial)
        self.assertIn("no", graph_context.lower())
        self.assertIn("field report", graph_context.lower())


if __name__ == "__main__":
    unittest.main()
