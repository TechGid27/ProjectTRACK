"""
Reputation Engine Tests (Pillar 3)
==================================
Covers the pure scoring math (deltas, clamping) and the async persistence path
with the report store mocked, plus the Pillar-4 consensus hook.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services import reputation
from backend.services.reputation import ReputationSignals


class TestScoreDelta(unittest.TestCase):
    def test_clean_onsite_report_raises_score(self):
        d = reputation.score_delta(ReputationSignals(geofence_pass=True, forensics_verdict="clean"))
        self.assertGreater(d, 0)

    def test_recycled_offsite_report_lowers_score(self):
        d = reputation.score_delta(ReputationSignals(geofence_pass=False, forensics_verdict="recycled"))
        self.assertLess(d, 0)

    def test_clean_outranks_suspicious(self):
        clean = reputation.score_delta(ReputationSignals(True, "clean"))
        suspicious = reputation.score_delta(ReputationSignals(True, "suspicious"))
        self.assertGreater(clean, suspicious)


class TestClamping(unittest.TestCase):
    def test_score_cannot_exceed_max(self):
        self.assertEqual(reputation.project_score(reputation.SCORE_MAX, +50), reputation.SCORE_MAX)

    def test_score_cannot_drop_below_min(self):
        self.assertEqual(reputation.project_score(reputation.SCORE_MIN, -50), reputation.SCORE_MIN)

    def test_missing_current_uses_starting_score(self):
        expected = reputation._clamp(reputation.STARTING_SCORE + 4)
        self.assertEqual(reputation.project_score(None, 4), expected)


class TestIsFlagged(unittest.TestCase):
    def test_clean_onsite_not_flagged(self):
        self.assertFalse(reputation.is_flagged(ReputationSignals(True, "clean")))

    def test_offsite_is_flagged(self):
        self.assertTrue(reputation.is_flagged(ReputationSignals(False, "clean")))

    def test_recycled_is_flagged(self):
        self.assertTrue(reputation.is_flagged(ReputationSignals(True, "recycled")))


class TestApplyReportOutcome(unittest.IsolatedAsyncioTestCase):
    async def test_new_user_clean_report(self):
        with patch.object(reputation.report_store, "get_reputation", new=AsyncMock(return_value=None)), \
             patch.object(reputation.report_store, "upsert_reputation", new=AsyncMock(side_effect=lambda rec: rec)) as upsert:
            result = await reputation.apply_report_outcome(
                "user-1", ReputationSignals(geofence_pass=True, forensics_verdict="clean")
            )
        self.assertEqual(result["user_id"], "user-1")
        self.assertEqual(result["reports_total"], 1)
        self.assertEqual(result["reports_flagged"], 0)
        # Starting 50 + activity(1) + geofence(5) + clean(3) = 59
        self.assertEqual(result["score"], 59)
        upsert.assert_awaited_once()

    async def test_existing_user_recycled_report_flagged(self):
        existing = {"user_id": "user-2", "score": 40, "reports_total": 3, "reports_flagged": 1}
        with patch.object(reputation.report_store, "get_reputation", new=AsyncMock(return_value=existing)), \
             patch.object(reputation.report_store, "upsert_reputation", new=AsyncMock(side_effect=lambda rec: rec)):
            result = await reputation.apply_report_outcome(
                "user-2", ReputationSignals(geofence_pass=False, forensics_verdict="recycled")
            )
        # 40 + activity(1) + geofence_fail(-5) + recycled(-10) = 26
        self.assertEqual(result["score"], 26)
        self.assertEqual(result["reports_total"], 4)
        self.assertEqual(result["reports_flagged"], 2)

    async def test_score_evolves_across_sequence(self):
        state = {}

        async def fake_get(uid):
            return state or None

        async def fake_upsert(rec):
            state.clear()
            state.update(rec)
            return rec

        with patch.object(reputation.report_store, "get_reputation", new=AsyncMock(side_effect=fake_get)), \
             patch.object(reputation.report_store, "upsert_reputation", new=AsyncMock(side_effect=fake_upsert)):
            await reputation.apply_report_outcome("u", ReputationSignals(True, "clean"))      # 50->59
            await reputation.apply_report_outcome("u", ReputationSignals(True, "suspicious"))  # 59->61 (1+5-4)
            await reputation.apply_report_outcome("u", ReputationSignals(False, "recycled"))   # 61->47 (1-5-10)
        self.assertEqual(state["score"], 47)
        self.assertEqual(state["reports_total"], 3)
        self.assertEqual(state["reports_flagged"], 2)


class TestConsensusHook(unittest.IsolatedAsyncioTestCase):
    async def test_confirm_raises_dispute_lowers(self):
        existing = {"user_id": "u", "score": 50, "reports_total": 2, "reports_flagged": 0}
        with patch.object(reputation.report_store, "get_reputation", new=AsyncMock(return_value=existing)), \
             patch.object(reputation.report_store, "upsert_reputation", new=AsyncMock(side_effect=lambda rec: rec)):
            confirmed = await reputation.register_consensus_outcome("u", confirmed=True)
            disputed = await reputation.register_consensus_outcome("u", confirmed=False)
        self.assertEqual(confirmed["score"], 58)   # 50 + 8
        self.assertEqual(disputed["score"], 42)    # 50 - 8
        self.assertEqual(disputed["reports_flagged"], 1)


if __name__ == "__main__":
    unittest.main()
