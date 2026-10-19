"""
GAA (General Appropriations Act) Fetcher & Neo4j Ingestion
==========================================================
Fetches DPWH appropriation line items for Cebu district engineering offices
from the BetterGov ``gaa`` search index and ingests them into Neo4j as
:Appropriation context nodes linked to the matching :Office via
APPROPRIATED_UNDER. These are contextual budget records and never overwrite
authoritative DPWH project budgets.

The BetterGov search key is search-scoped: only POST /indexes/{name}/search
works.
"""

import os
import re
import sys
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
GAA_INDEX = "gaa"


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {BETTERGOV_TOKEN}",
        "Content-Type": "application/json",
    }


def is_dpwh_cebu(hit: Dict[str, Any]) -> bool:
    """Keep only DPWH department rows whose operating unit is a Cebu office."""
    dept = (hit.get("uacs_dpt_dsc") or "").lower()
    oper = (hit.get("uacs_oper_dsc") or "").lower()
    is_dpwh = "public works" in dept or "dpwh" in dept
    is_cebu = "cebu" in oper
    return is_dpwh and is_cebu


def normalize_gaa(hit: Dict[str, Any]) -> Dict[str, Any]:
    """Map a raw gaa hit to a stable, typed appropriation dict."""
    def _amount(v):
        try:
            return float(str(v).replace(",", "")) if v not in (None, "") else 0.0
        except (TypeError, ValueError):
            return 0.0

    def _year(v):
        try:
            return int(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            return None

    rid = hit.get("id")
    return {
        "entity_id": f"GAA-{rid}",
        "gaa_id": str(rid),
        "office": (hit.get("uacs_oper_dsc") or "").strip(),
        "description": (hit.get("dsc") or "").strip(),
        "amount": _amount(hit.get("amt")),
        "year": _year(hit.get("year")),
        "sub_object": (hit.get("uacs_sobj_dsc") or "").strip(),
        "fund_subcat": (hit.get("uacs_fundsubcat_dsc") or "").strip(),
        "fund_code": (hit.get("fundcd") or "").strip(),
        "expense_class": (hit.get("uacs_exp_dsc") or "").strip(),
    }


def fetch_gaa_dpwh_cebu(
    max_records: Optional[int] = None,
    query: str = "Cebu",
    client: Optional[httpx.Client] = None,
) -> List[Dict[str, Any]]:
    """Paginate the gaa index, keep DPWH+Cebu rows, return normalized dicts."""
    owns_client = client is None
    client = client or httpx.Client(timeout=30.0)
    url = f"{BETTERGOV_SEARCH_BASE}/{GAA_INDEX}/search"
    results: List[Dict[str, Any]] = []
    offset = 0
    page_limit = 1000

    print(f"📡 Fetching GAA appropriations (DPWH Cebu, q='{query}')...")
    try:
        while True:
            payload = {"q": query, "limit": page_limit, "offset": offset}
            r = client.post(url, headers=_headers(), json=payload)
            r.raise_for_status()
            hits = r.json().get("hits", [])
            if not hits:
                break

            for h in hits:
                if is_dpwh_cebu(h):
                    results.append(normalize_gaa(h))
                    if max_records and len(results) >= max_records:
                        return results[:max_records]

            print(f"  • page offset={offset}: {len(hits)} hits "
                  f"(DPWH-Cebu accumulated: {len(results)})")

            if len(hits) < page_limit:
                break
            offset += page_limit
    finally:
        if owns_client:
            client.close()

    print(f"✅ GAA: {len(results)} DPWH Cebu appropriation line items.")
    return results


APPROPRIATION_CYPHER = """
UNWIND $batch AS rec

MERGE (a:Appropriation:base {entity_id: rec.entity_id})
SET a.name = rec.description,
    a.entity_type = "appropriation",
    a.gaa_id = rec.gaa_id,
    a.office = rec.office,
    a.amount = rec.amount,
    a.year = rec.year,
    a.sub_object = rec.sub_object,
    a.fund_subcat = rec.fund_subcat,
    a.fund_code = rec.fund_code,
    a.expense_class = rec.expense_class,
    a.weight = 1.0,
    a.description = "GAA appropriation (" + toString(rec.year) + "): " + rec.description,
    a.keywords = "gaa, appropriation, budget, funding, " + rec.sub_object

// Link to the Office node whose name contains the GAA operating unit.
FOREACH (_ IN CASE WHEN rec.office <> "" THEN [1] ELSE [] END |
    MERGE (off:Office:base {entity_id: rec.office})
    ON CREATE SET off.name = rec.office,
        off.entity_type = "organization",
        off.description = "Implementing Office: " + rec.office
    MERGE (off)-[r:APPROPRIATED_UNDER]->(a)
    SET r.description = rec.office + " has GAA appropriation " + rec.entity_id,
        r.weight = 1.0,
        r.keywords = "appropriation, budget, gaa"
)
"""


def sync_appropriations_to_neo4j(
    records: Optional[List[Dict[str, Any]]] = None,
    max_records: Optional[int] = None,
    driver=None,
) -> Dict[str, int]:
    """Ingest DPWH Cebu GAA appropriations into Neo4j as context nodes."""
    if records is None:
        records = fetch_gaa_dpwh_cebu(max_records=max_records)

    if not records:
        print("⚠️ No GAA appropriation records to ingest.")
        return {"appropriations": 0}

    owns_driver = driver is None
    if driver is None:
        try:
            from pipeline.sync_to_neo4j import get_clients
        except ImportError:
            from sync_to_neo4j import get_clients
        _, driver = get_clients()
        if driver is None:
            return {"appropriations": 0}

    count = 0
    try:
        with driver.session() as session:
            try:
                session.run(
                    "CREATE CONSTRAINT appropriation_id_unique IF NOT EXISTS "
                    "FOR (a:Appropriation) REQUIRE a.entity_id IS UNIQUE"
                )
            except Exception:
                pass

            batch_size = 200
            for i in range(0, len(records), batch_size):
                chunk = records[i:i + batch_size]
                session.run(APPROPRIATION_CYPHER, batch=chunk)
                print(f"  • Processed {min(i + batch_size, len(records))}/{len(records)} appropriations...")

            count = session.run(
                "MATCH (a:Appropriation) RETURN count(a) AS c"
            ).single()["c"]
    finally:
        if owns_driver and driver is not None:
            driver.close()

    print(f"🎉 GAA ingestion complete. Appropriation nodes: {count}")
    return {"appropriations": count}


if __name__ == "__main__":
    limit = None
    if "--limit" in sys.argv:
        try:
            limit = int(sys.argv[sys.argv.index("--limit") + 1])
        except (ValueError, IndexError):
            limit = None
    recs = fetch_gaa_dpwh_cebu(max_records=limit)
    for rec in recs[:3]:
        print(rec)
    if "--sync" in sys.argv:
        sync_appropriations_to_neo4j(records=recs)
