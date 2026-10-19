"""
PhilGEPS Procurement Fetcher & Neo4j Ingestion
===============================================
Fetches Philippine Government Electronic Procurement System (PhilGEPS) award
records for Cebu from the BetterGov search backend and ingests them into the
Neo4j knowledge graph using CONSERVATIVE matching:

    * link an award to a Contractor only when the awardee name matches an
      existing :Contractor node (exact, normalized, code-suffix stripped), AND
    * the award's area_of_delivery resolves to a Cebu LGU.

Every linked Procurement node carries a ``match_confidence`` flag and never
overwrites authoritative DPWH Project/Contractor facts.

The BetterGov search key is search-scoped: only POST /indexes/{name}/search
works (no document fetch, no index listing).
"""

import os
import re
import sys
import time
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
import httpx

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

BETTERGOV_SEARCH_BASE = "https://search2.bettergov.ph/indexes"
BETTERGOV_TOKEN = os.getenv(
    "BETTERGOV_SEARCH_TOKEN",
    "307c9f43a066a443cc37d62b45fa47fde2b39f765139dd964ea151daed65f55c",
)
PHILGEPS_INDEX = "philgeps"

# Canonical set of Cebu LGU tokens used to gate area_of_delivery. Mirrors the
# municipalities recognized by the guardrail/domain layer.
CEBU_LGU_TOKENS = {
    "cebu", "mandaue", "lapu-lapu", "lapu lapu", "talisay", "toledo", "bogo",
    "naga", "carcar", "danao", "minglanilla", "consolacion", "cordova",
    "compostela", "liloan", "san fernando", "balamban", "asturias", "tuburan",
    "pinamungajan", "aloguinsan", "barili", "dumanjug", "ronda", "alcantara",
    "moalboal", "badian", "alegria", "malabuyoc", "ginatilan", "samboan",
    "santander", "oslob", "boljoon", "alcoy", "dalaguete", "argao", "sibonga",
    "san remigio", "medellin", "daanbantayan", "madridejos", "bantayan",
    "santa fe", "tabogon", "tabuelan", "borbon", "sogod", "catmon", "carmen",
    "camotes", "pilar", "poro", "san francisco", "tudela",
}


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {BETTERGOV_TOKEN}",
        "Content-Type": "application/json",
    }


def normalize_contractor_name(name: Optional[str]) -> str:
    """Normalize an awardee/contractor name for exact comparison.

    Strips a trailing DPWH code suffix ``(12345)``, collapses whitespace,
    uppercases, and removes trailing punctuation.
    """
    if not name:
        return ""
    n = re.sub(r"\((?:code:\s*)?\d+\)\s*$", "", str(name), flags=re.IGNORECASE)
    n = re.sub(r"\s+", " ", n).strip().upper()
    n = n.rstrip(".,; ")
    return n


def is_cebu_area(area: Optional[str]) -> bool:
    """Return True when area_of_delivery resolves to a Cebu LGU."""
    if not area:
        return False
    a = str(area).strip().lower()
    if a == "cebu" or "cebu" in a:
        return True
    return any(tok in a for tok in CEBU_LGU_TOKENS)


def normalize_record(hit: Dict[str, Any]) -> Dict[str, Any]:
    """Map a raw philgeps hit to a stable, typed procurement dict."""
    def _amount(v):
        try:
            return float(str(v).replace(",", "")) if v not in (None, "") else 0.0
        except (TypeError, ValueError):
            return 0.0

    ref = (hit.get("reference_id") or "").strip()
    contract_no = (hit.get("contract_no") or "").strip()
    award_title = (hit.get("award_title") or "").strip()
    # Stable entity id: prefer reference_id, then contract_no, then award title.
    entity_id = ref or contract_no or award_title or hit.get("id", "")

    return {
        "entity_id": str(entity_id),
        "reference_id": ref,
        "contract_no": contract_no,
        "award_title": award_title,
        "notice_title": (hit.get("notice_title") or "").strip(),
        "awardee_name": (hit.get("awardee_name") or "").strip(),
        "awardee_norm": normalize_contractor_name(hit.get("awardee_name")),
        "organization_name": (hit.get("organization_name") or "").strip(),
        "area_of_delivery": (hit.get("area_of_delivery") or "").strip(),
        "business_category": (hit.get("business_category") or "").strip(),
        "contract_amount": _amount(hit.get("contract_amount")),
        "award_date": (hit.get("award_date") or "").strip(),
        "award_status": (hit.get("award_status") or "").strip(),
    }


def fetch_philgeps_cebu(
    max_records: Optional[int] = None,
    query: str = "Cebu",
    client: Optional[httpx.Client] = None,
) -> List[Dict[str, Any]]:
    """Paginate the philgeps index and return Cebu-area normalized records.

    Pagination stops when a page returns fewer than the page limit, when no
    hits are returned, or when ``max_records`` is reached. Only records whose
    area_of_delivery resolves to a Cebu LGU are kept.
    """
    owns_client = client is None
    client = client or httpx.Client(timeout=30.0)
    url = f"{BETTERGOV_SEARCH_BASE}/{PHILGEPS_INDEX}/search"
    results: List[Dict[str, Any]] = []
    offset = 0
    page_limit = 1000

    print(f"📡 Fetching PhilGEPS procurement records (q='{query}')...")
    try:
        while True:
            payload = {"q": query, "limit": page_limit, "offset": offset}
            r = client.post(url, headers=_headers(), json=payload)
            r.raise_for_status()
            hits = r.json().get("hits", [])
            if not hits:
                break

            for h in hits:
                rec = normalize_record(h)
                if is_cebu_area(rec["area_of_delivery"]):
                    results.append(rec)
                    if max_records and len(results) >= max_records:
                        return results[:max_records]

            print(f"  • page offset={offset}: {len(hits)} hits "
                  f"(Cebu-matched accumulated: {len(results)})")

            if len(hits) < page_limit:
                break
            offset += page_limit
    finally:
        if owns_client:
            client.close()

    print(f"✅ PhilGEPS: {len(results)} Cebu-area procurement records.")
    return results


# ---------------------------------------------------------------------------
# Neo4j ingestion (conservative matching)
# ---------------------------------------------------------------------------

PROCUREMENT_CYPHER = """
UNWIND $batch AS rec

// Only attach when the awardee matches an existing DPWH Contractor node.
MATCH (c:Contractor:base)
WHERE toUpper(coalesce(c.name, c.entity_id)) = rec.awardee_norm

MERGE (pr:Procurement:base {entity_id: rec.entity_id})
SET pr.name = CASE WHEN rec.award_title <> "" THEN rec.award_title ELSE rec.entity_id END,
    pr.entity_type = "procurement",
    pr.reference_id = rec.reference_id,
    pr.contract_no = rec.contract_no,
    pr.award_title = rec.award_title,
    pr.notice_title = rec.notice_title,
    pr.awardee_name = rec.awardee_name,
    pr.organization_name = rec.organization_name,
    pr.area_of_delivery = rec.area_of_delivery,
    pr.business_category = rec.business_category,
    pr.contract_amount = rec.contract_amount,
    pr.award_date = rec.award_date,
    pr.award_status = rec.award_status,
    pr.match_confidence = "exact_name_cebu",
    pr.weight = 1.0,
    pr.description = "PhilGEPS award: " + coalesce(rec.notice_title, rec.award_title) +
                    " awarded to " + rec.awardee_name,
    pr.keywords = "procurement, bidding, award, philgeps, " + rec.awardee_name

MERGE (c)-[r:AWARDED]->(pr)
SET r.description = rec.awardee_name + " was awarded procurement " + pr.entity_id,
    r.weight = 1.0,
    r.keywords = "procurement, award, bidding"

FOREACH (_ IN CASE WHEN rec.organization_name <> "" THEN [1] ELSE [] END |
    MERGE (org:Organization:base {entity_id: rec.organization_name})
    SET org.name = rec.organization_name,
        org.entity_type = "organization",
        org.description = "Procuring organization: " + rec.organization_name
    MERGE (pr)-[ro:PROCURED_BY]->(org)
    SET ro.description = pr.entity_id + " procured by " + rec.organization_name,
        ro.weight = 1.0,
        ro.keywords = "organization, procuring entity"
)
"""


def sync_procurement_to_neo4j(
    records: Optional[List[Dict[str, Any]]] = None,
    max_records: Optional[int] = None,
    driver=None,
) -> Dict[str, int]:
    """Ingest Cebu PhilGEPS procurement records into Neo4j (conservative).

    Returns a stats dict with the number of procurement nodes created/linked.
    Accepts an injected ``driver`` (for tests) or lazily builds one.
    """
    if records is None:
        records = fetch_philgeps_cebu(max_records=max_records)

    if not records:
        print("⚠️ No Cebu procurement records to ingest.")
        return {"procurements_linked": 0}

    owns_driver = driver is None
    if driver is None:
        try:
            from pipeline.sync_to_neo4j import get_clients
        except ImportError:
            from sync_to_neo4j import get_clients
        _, driver = get_clients()
        if driver is None:
            return {"procurements_linked": 0}

    linked = 0
    try:
        with driver.session() as session:
            # Ensure uniqueness for Procurement nodes.
            try:
                session.run(
                    "CREATE CONSTRAINT procurement_id_unique IF NOT EXISTS "
                    "FOR (pr:Procurement) REQUIRE pr.entity_id IS UNIQUE"
                )
            except Exception:
                pass

            batch_size = 200
            for i in range(0, len(records), batch_size):
                chunk = records[i:i + batch_size]
                session.run(PROCUREMENT_CYPHER, batch=chunk)
                print(f"  • Processed {min(i + batch_size, len(records))}/{len(records)} procurement records...")

            linked = session.run(
                "MATCH (:Contractor)-[:AWARDED]->(pr:Procurement) "
                "RETURN count(DISTINCT pr) AS c"
            ).single()["c"]
    finally:
        if owns_driver and driver is not None:
            driver.close()

    print(f"🎉 PhilGEPS ingestion complete. Linked procurement nodes: {linked}")
    return {"procurements_linked": linked}


if __name__ == "__main__":
    limit = None
    if "--limit" in sys.argv:
        try:
            limit = int(sys.argv[sys.argv.index("--limit") + 1])
        except (ValueError, IndexError):
            limit = None
    recs = fetch_philgeps_cebu(max_records=limit)
    for rec in recs[:3]:
        print(rec)
    if "--sync" in sys.argv:
        sync_procurement_to_neo4j(records=recs)
