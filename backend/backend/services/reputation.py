"""
Reputation Engine (Pillar 3 — Identity & Sybil Resistance)
==========================================================
Each authenticated reporter accrues a reputation score driven by the
verification signals available in THIS scope:

  * geofence pass        -> trust up   (they were physically on site)
  * forensics "clean"    -> trust up   (photo shows no tampering)
  * forensics "suspicious" -> trust down
  * forensics "recycled" -> trust down hard (reused a prior photo)
  * account activity      -> small, capped participation credit

Pillar 4 (Crowdsourced Peer Consensus) is intentionally out of scope, so there
are no confirm/dispute outcomes yet. ``register_consensus_outcome`` is a
documented hook so that, when consensus is added later, confirm/dispute events
feed the SAME score through the same persistence path — no schema change.

The scoring math is pure (``score_delta``) so it is trivially unit-testable; the
async ``apply_report_outcome`` persists the result via the report store.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from backend.services.report_store import report_store

logger = logging.getLogger("reputation")

# --- Score tuning -----------------------------------------------------------
SCORE_MIN = 0
SCORE_MAX = 100
STARTING_SCORE = 50  # new reporters start neutral-positive

DELTA_GEOFENCE_PASS = 5
DELTA_GEOFENCE_FAIL = -5
DELTA_FORENSICS_CLEAN = 3
DELTA_FORENSICS_SUSPICIOUS = -4
DELTA_FORENSICS_RECYCLED = -10
DELTA_ACTIVITY = 1  # small participation credit per accepted submission

# Future Pillar 4 (consensus) deltas — wired but unused until consensus ships.
DELTA_CONSENSUS_CONFIRM = 8
DELTA_CONSENSUS_DISPUTE = -8


@dataclass
class ReputationSignals:
    """Signals extracted from a single report's verification result."""
    geofence_pass: bool
    forensics_verdict: str  # clean | suspicious | recycled


def _clamp(value: int) -> int:
    return max(SCORE_MIN, min(SCORE_MAX, value))


def score_delta(signals: ReputationSignals) -> int:
    """Pure function: the reputation change produced by one report's signals."""
    delta = DELTA_ACTIVITY
    delta += DELTA_GEOFENCE_PASS if signals.geofence_pass else DELTA_GEOFENCE_FAIL
    if signals.forensics_verdict == "clean":
        delta += DELTA_FORENSICS_CLEAN
    elif signals.forensics_verdict == "suspicious":
        delta += DELTA_FORENSICS_SUSPICIOUS
    elif signals.forensics_verdict == "recycled":
        delta += DELTA_FORENSICS_RECYCLED
    return delta


def is_flagged(signals: ReputationSignals) -> bool:
    """A report counts as 'flagged' for reputation accounting when it fails a check."""
    return (not signals.geofence_pass) or signals.forensics_verdict in ("suspicious", "recycled")


def project_score(current: Optional[int], delta: int) -> int:
    """Apply a delta to a (possibly missing) current score, clamped to bounds."""
    base = STARTING_SCORE if current is None else current
    return _clamp(base + delta)


async def apply_report_outcome(user_id: str, signals: ReputationSignals) -> dict:
    """
    Update and persist a reporter's reputation from one report's verification
    signals. Returns the stored reputation record. Safe to call inside the
    submission pipeline; persistence errors are surfaced to the caller.
    """
    existing = await report_store.get_reputation(user_id)
    current_score = existing.get("score") if existing else None
    reports_total = (existing.get("reports_total") if existing else 0) or 0
    reports_flagged = (existing.get("reports_flagged") if existing else 0) or 0

    delta = score_delta(signals)
    new_score = project_score(current_score, delta)
    record = {
        "user_id": user_id,
        "score": new_score,
        "reports_total": reports_total + 1,
        "reports_flagged": reports_flagged + (1 if is_flagged(signals) else 0),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return await report_store.upsert_reputation(record)


async def get_score(user_id: str) -> int:
    """Return a reporter's current score, or the starting score if they have none."""
    existing = await report_store.get_reputation(user_id)
    if existing and existing.get("score") is not None:
        return int(existing["score"])
    return STARTING_SCORE


async def register_consensus_outcome(user_id: str, confirmed: bool) -> dict:
    """
    HOOK for Pillar 4 (Crowdsourced Peer Consensus), not yet active.

    When peer consensus is implemented, call this with ``confirmed=True`` once a
    report is community-verified or ``confirmed=False`` when disputed. It feeds
    the same ``user_reputation`` store so reputation stays a single source of
    truth. Kept intentionally minimal until the consensus pillar ships.
    """
    existing = await report_store.get_reputation(user_id)
    current_score = existing.get("score") if existing else None
    reports_total = (existing.get("reports_total") if existing else 0) or 0
    reports_flagged = (existing.get("reports_flagged") if existing else 0) or 0

    delta = DELTA_CONSENSUS_CONFIRM if confirmed else DELTA_CONSENSUS_DISPUTE
    record = {
        "user_id": user_id,
        "score": project_score(current_score, delta),
        "reports_total": reports_total,
        "reports_flagged": reports_flagged + (0 if confirmed else 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return await report_store.upsert_reputation(record)
