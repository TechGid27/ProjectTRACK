"""
Graph Synthesizer Report-Count Tests
=====================================
Verifies the deterministic single-project synthesis surfaces citizen field
report counts when present (from the project card or the "Field Reports: N"
context line) and omits the sentence when there are none.
"""

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.graph_synthesizer import synthesize_graph_response


class TestReportCountSynthesis(unittest.TestCase):
    def _card(self, report_count=None):
        return {
            "id": "24HH0043",
            "description": "flood control",
            "location": "Toledo City",
            "budget": "P5M",
            "contractor": "ACME",
            "status": "Ongoing",
            "report_count": report_count,
        }

    def test_card_report_count_included(self):
        out = synthesize_graph_response(
            graph_context="", project_card=self._card(5), include_setup_tip=False
        )
        self.assertIn("5 citizen field reports on record", out)

    def test_singular_phrasing(self):
        out = synthesize_graph_response(
            graph_context="", project_card=self._card(1), include_setup_tip=False
        )
        self.assertIn("1 citizen field report on record", out)

    def test_context_line_fallback(self):
        ctx = (
            "Focused Project: DPWH Project 24HH0043\n"
            "Location: Toledo City\n"
            "Scope Description: flood control\n"
            "Budget: P5M\n"
            "Status: Ongoing\n"
            "Field Reports: 8"
        )
        out = synthesize_graph_response(
            graph_context=ctx, is_single_project=True, include_setup_tip=False
        )
        self.assertIn("8 citizen field reports on record", out)

    def test_zero_reports_omitted(self):
        out = synthesize_graph_response(
            graph_context="", project_card=self._card(0), include_setup_tip=False
        )
        self.assertNotIn("field report", out)


if __name__ == "__main__":
    unittest.main()
