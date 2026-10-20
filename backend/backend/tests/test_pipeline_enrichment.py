"""
Pipeline Enrichment Unit Tests
==============================
Covers DPWH metadata capture, metadata-first Neo4j build, PhilGEPS procurement
fetch/match, and GAA appropriation fetch/filter. External HTTP and Neo4j are
mocked — no live credentials required.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

# Add project root (backend/) to sys.path so `pipeline` imports resolve.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.scrape_cebu_dpwh import build_project_metadata
from pipeline.sync_to_neo4j import (
    build_project_from_metadata,
    _within_cebu_bbox,
    _coerce_float,
)
from pipeline.fetch_philgeps import (
    normalize_contractor_name,
    is_cebu_area,
    normalize_record,
    fetch_philgeps_cebu,
)
from pipeline.fetch_gaa import is_dpwh_cebu, normalize_gaa, fetch_gaa_dpwh_cebu


SAMPLE_DPWH_HIT = {
    "contractId": "24HO0039",
    "description": "CONSTRUCTION OF ROAD, BADIAN, CEBU",
    "category": "Roads",
    "componentCategories": "Roads",
    "status": "On-Going",
    "budget": 14697861.08,
    "amountPaid": 1000000.0,
    "progress": 98.15,
    "location": {"province": "Cebu 7th DEO", "region": "Region VII"},
    "contractor": "DT&C CONSTRUCTION (36176)",
    "startDate": "2024-02-16",
    "completionDate": None,
    "infraYear": "2024",
    "programName": "Regular Infra",
    "sourceOfFunds": "Regular Infra - GAA 2024 CP",
    "latitude": 9.896479,
    "longitude": 123.456368,
    "reportCount": 0,
    "hasSatelliteImage": True,
}


class TestDpwhMetadata(unittest.TestCase):
    def test_build_project_metadata_has_all_keys(self):
        md = build_project_metadata(SAMPLE_DPWH_HIT)
        for key in [
            "contractId", "infraYear", "category", "componentCategories",
            "status", "progress", "budget", "amountPaid", "deo", "region",
            "contractor", "startDate", "completionDate", "programName",
            "sourceOfFunds", "latitude", "longitude", "reportCount",
            "hasSatelliteImage", "source",
        ]:
            self.assertIn(key, md)
        self.assertEqual(md["contractId"], "24HO0039")
        self.assertEqual(md["amountPaid"], 1000000.0)
        self.assertEqual(md["sourceOfFunds"], "Regular Infra - GAA 2024 CP")
        self.assertEqual(md["region"], "Region VII")
        self.assertIsInstance(md["hasSatelliteImage"], bool)
        self.assertAlmostEqual(md["latitude"], 9.896479)


class TestMetadataFirstBuild(unittest.TestCase):
    def test_metadata_overrides_and_authentic_gps(self):
        md = build_project_metadata(SAMPLE_DPWH_HIT)
        markdown = "### DPWH Project 24HO0039\n- **Exact Location:** Badian, Cebu\n"
        rec = build_project_from_metadata(md, markdown, "http://x/24HO0039")
        self.assertEqual(rec["project_id"], "24HO0039")
        self.assertEqual(rec["amount_paid"], 1000000.0)
        self.assertEqual(rec["source_of_funds"], "Regular Infra - GAA 2024 CP")
        self.assertEqual(rec["program_name"], "Regular Infra")
        self.assertEqual(rec["region"], "Region VII")
        self.assertEqual(rec["contractor_name"], "DT&C CONSTRUCTION")
        self.assertEqual(rec["contractor_code"], "36176")
        # Authentic GPS within Cebu bbox should be used.
        self.assertEqual(rec["gps_source"], "dpwh_bettergov")
        self.assertAlmostEqual(rec["latitude"], 9.896479)

    def test_out_of_bbox_falls_back_to_geocode(self):
        md = build_project_metadata({**SAMPLE_DPWH_HIT, "latitude": 1.0, "longitude": 1.0})
        rec = build_project_from_metadata(md, "### DPWH Project 24HO0039\n", "u")
        self.assertEqual(rec["gps_source"], "geocoded")

    def test_bbox_guard(self):
        self.assertTrue(_within_cebu_bbox(10.3, 123.9))
        self.assertFalse(_within_cebu_bbox(1.0, 1.0))
        self.assertFalse(_within_cebu_bbox(None, None))

    def test_legacy_row_without_metadata_uses_markdown(self):
        markdown = (
            "### DPWH Project 20HN0111\n"
            "- **Exact Location:** Cordova, Cebu\n"
            "- **Contractor:** ACME BUILDERS (12345)\n"
            "- **Budget:** \u20b11,000,000 (Year: 2023)\n"
            "- **Status:** Completed (100.0% complete)\n"
            "- **Description:** Road repair\n"
        )
        rec = build_project_from_metadata({}, markdown, "u")
        self.assertIsNotNone(rec)
        self.assertEqual(rec["project_id"], "20HN0111")
        # New keys must exist with safe defaults for Cypher compatibility.
        self.assertIn("amount_paid", rec)
        self.assertIn("source_of_funds", rec)
        self.assertIn("gps_source", rec)


class TestPhilgeps(unittest.TestCase):
    def test_normalize_contractor_name(self):
        self.assertEqual(normalize_contractor_name("DT&C CONSTRUCTION (36176)"), "DT&C CONSTRUCTION")
        self.assertEqual(normalize_contractor_name("  acme builders.  "), "ACME BUILDERS")

    def test_is_cebu_area(self):
        self.assertTrue(is_cebu_area("Cebu"))
        self.assertTrue(is_cebu_area("Mandaue City"))
        self.assertFalse(is_cebu_area("Capiz"))
        self.assertFalse(is_cebu_area(""))

    def test_fetch_filters_non_cebu(self):
        page = {
            "hits": [
                {"awardee_name": "A", "area_of_delivery": "Cebu", "contract_amount": "100"},
                {"awardee_name": "B", "area_of_delivery": "Capiz", "contract_amount": "200"},
            ]
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = page
        mock_resp.raise_for_status.return_value = None
        mock_client = MagicMock()
        mock_client.post.return_value = mock_resp

        recs = fetch_philgeps_cebu(client=mock_client)
        self.assertEqual(len(recs), 1)
        self.assertEqual(recs[0]["awardee_name"], "A")
        self.assertEqual(recs[0]["contract_amount"], 100.0)

    def test_procurement_cypher_import(self):
        from pipeline.fetch_philgeps import PROCUREMENT_CYPHER
        self.assertIn("MATCH (c:Contractor", PROCUREMENT_CYPHER)
        self.assertIn("exact_name_cebu", PROCUREMENT_CYPHER)


class TestGaa(unittest.TestCase):
    def test_is_dpwh_cebu(self):
        self.assertTrue(is_dpwh_cebu({
            "uacs_dpt_dsc": "Department of Public Works and Highways (DPWH)",
            "uacs_oper_dsc": "Cebu 2nd District Engineering Office",
        }))
        self.assertFalse(is_dpwh_cebu({
            "uacs_dpt_dsc": "Department of Health",
            "uacs_oper_dsc": "Cebu",
        }))
        self.assertFalse(is_dpwh_cebu({
            "uacs_dpt_dsc": "Department of Public Works and Highways (DPWH)",
            "uacs_oper_dsc": "Manila 1st District Engineering Office",
        }))

    def test_normalize_gaa(self):
        rec = normalize_gaa({
            "id": 2271035,
            "uacs_oper_dsc": "Cebu 2nd District Engineering Office",
            "dsc": "N. Bacalso Ave",
            "amt": 20000.0,
            "year": 2023,
            "uacs_sobj_dsc": "Road Networks",
        })
        self.assertEqual(rec["entity_id"], "GAA-2271035")
        self.assertEqual(rec["amount"], 20000.0)
        self.assertEqual(rec["year"], 2023)
        self.assertEqual(rec["sub_object"], "Road Networks")

    def test_fetch_filters_non_dpwh(self):
        page = {
            "hits": [
                {"uacs_dpt_dsc": "Department of Public Works and Highways (DPWH)",
                 "uacs_oper_dsc": "Cebu 3rd District Engineering Office",
                 "id": 1, "amt": 5, "year": 2024},
                {"uacs_dpt_dsc": "Department of Education",
                 "uacs_oper_dsc": "Cebu", "id": 2, "amt": 9, "year": 2024},
            ]
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = page
        mock_resp.raise_for_status.return_value = None
        mock_client = MagicMock()
        mock_client.post.return_value = mock_resp

        recs = fetch_gaa_dpwh_cebu(client=mock_client)
        self.assertEqual(len(recs), 1)
        self.assertEqual(recs[0]["entity_id"], "GAA-1")


class TestProcurementIngestionMocked(unittest.TestCase):
    def test_sync_procurement_with_mock_driver(self):
        from pipeline.fetch_philgeps import sync_procurement_to_neo4j

        session = MagicMock()
        # count query result
        count_result = MagicMock()
        count_result.single.return_value = {"c": 1}
        session.run.return_value = count_result
        session.__enter__.return_value = session
        session.__exit__.return_value = False

        driver = MagicMock()
        driver.session.return_value = session

        recs = [normalize_record({
            "reference_id": "R-1", "award_title": "Road",
            "awardee_name": "DT&C CONSTRUCTION", "area_of_delivery": "Cebu",
            "contract_amount": "500", "organization_name": "LGU Cebu",
        })]
        stats = sync_procurement_to_neo4j(records=recs, driver=driver)
        self.assertEqual(stats["procurements_linked"], 1)
        self.assertTrue(session.run.called)


if __name__ == "__main__":
    unittest.main()
