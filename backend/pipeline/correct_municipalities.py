"""
Correct Mislabeled Project Municipalities in Neo4j
==================================================
Many Project nodes were stamped ``municipality = "Cebu City"`` by the geocoding
fallback because their scraped address was a vague province-level string
("Cebu, CEBU, Cebu"). Their authentic DPWH/BetterGov ``latitude/longitude`` are
correct, however, so this script reverse-geocodes each project's coordinates
against the official Cebu LGU boundary polygons and rewrites ``municipality``
to the LGU that actually contains the point.

Projects whose coordinates fall outside every Cebu LGU (e.g. Bohol, Negros,
open sea) are NOT Cebu projects: their ``municipality`` is cleared and they are
flagged ``outside_cebu = true`` so they never render under a Cebu LGU.

Usage:
    python -m pipeline.correct_municipalities            # dry-run (no writes)
    python -m pipeline.correct_municipalities --apply    # write to Neo4j
"""

import os
import sys
from collections import Counter
from typing import Dict, List, Optional

from dotenv import load_dotenv
from neo4j import GraphDatabase

# Allow running both as a module and as a script.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from pipeline.lgu_boundaries import resolve_lgu, all_lgu_names  # noqa: E402

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

for env_path in [".env", "backend/.env", "../.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


def _canon_token(name: Optional[str]) -> str:
    """Local copy of the municipality canonicalization token (no backend import)."""
    if not name:
        return ""
    t = str(name).strip().lower()
    if t.endswith(", cebu"):
        t = t[: -len(", cebu")].strip()
    if t.startswith("city of "):
        t = t[len("city of "):]
    elif t.endswith(" city"):
        t = t[: -len(" city")]
    return t.strip()


def build_db_spelling_map(session) -> Dict[str, str]:
    """
    Map a canonical token -> the municipality spelling already used in Neo4j,
    so corrections reuse existing DB spellings (e.g. resolver 'City of Bogo'
    maps to DB 'Bogo City') and avoid needless churn.
    """
    rows = session.run(
        "MATCH (p:Project) WHERE p.municipality IS NOT NULL "
        "RETURN DISTINCT p.municipality AS m"
    ).data()
    spelling: Dict[str, str] = {}
    for r in rows:
        m = r["m"]
        tok = _canon_token(m)
        if tok and tok not in spelling:
            spelling[tok] = m
    return spelling


def preferred_spelling(resolved_name: str, db_spelling: Dict[str, str]) -> str:
    """Prefer the existing DB spelling for the resolved LGU; else the GeoJSON name."""
    return db_spelling.get(_canon_token(resolved_name), resolved_name)


def correct_municipalities(apply: bool = False) -> None:
    if not NEO4J_URI or not NEO4J_PASSWORD:
        print("ERROR: NEO4J_URI and NEO4J_PASSWORD must be configured.")
        sys.exit(1)

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
    mode = "APPLY (writing to Neo4j)" if apply else "DRY-RUN (no writes)"
    print(f"=== Municipality Correction — {mode} ===\n")

    with driver.session() as session:
        db_spelling = build_db_spelling_map(session)

        rows = session.run(
            """
            MATCH (p:Project)
            RETURN p.project_id AS id,
                   p.latitude AS lat,
                   p.longitude AS lng,
                   p.municipality AS municipality,
                   p.gps_source AS gps_source
            """
        ).data()

    total = len(rows)
    no_coords = 0
    unchanged = 0
    skipped_untrusted = 0  # non-authentic coords (centroid fallback) left as-is
    reassigned_within_cebu: List[Dict] = []
    moved_outside_cebu: List[Dict] = []
    from_counter = Counter()   # previous municipality of corrected rows
    to_counter = Counter()     # new municipality of corrected rows

    updates_in: List[Dict] = []   # inside Cebu -> set municipality
    updates_out: List[Dict] = []  # outside Cebu -> clear + flag

    for r in rows:
        lat, lng = r["lat"], r["lng"]
        current = r["municipality"]
        if lat is None or lng is None:
            no_coords += 1
            continue

        # Only authentic DPWH/BetterGov GPS is trustworthy enough to override the
        # stored municipality. Municipality-centroid fallbacks (gps_source != the
        # BetterGov tag) were derived FROM the municipality name itself, so a
        # polygon edge miss must not clear or move them.
        if r.get("gps_source") != "dpwh_bettergov":
            skipped_untrusted += 1
            continue

        resolved = resolve_lgu(lat, lng)

        if resolved is None:
            # Point is outside all Cebu LGUs -> not a Cebu project.
            if current is not None:
                moved_outside_cebu.append(r)
                from_counter[current] += 1
                to_counter["<outside Cebu / cleared>"] += 1
                updates_out.append({"id": r["id"]})
            else:
                unchanged += 1
            continue

        target = preferred_spelling(resolved, db_spelling)
        if _canon_token(target) == _canon_token(current):
            unchanged += 1
            continue

        reassigned_within_cebu.append({**r, "new": target})
        from_counter[current] += 1
        to_counter[target] += 1
        updates_in.append({"id": r["id"], "municipality": target})

    # ---- Report ----
    print(f"Total projects:               {total}")
    print(f"  no coordinates (skipped):   {no_coords}")
    print(f"  untrusted coords (skipped): {skipped_untrusted}")
    print(f"  already correct (unchanged):{unchanged}")
    print(f"  reassigned within Cebu:     {len(reassigned_within_cebu)}")
    print(f"  moved out of Cebu (cleared):{len(moved_outside_cebu)}")

    print("\n--- Corrections FROM (old municipality) ---")
    for name, cnt in from_counter.most_common():
        print(f"  {cnt:>5}  {name!r}")

    print("\n--- Corrections TO (new municipality) ---")
    for name, cnt in to_counter.most_common():
        print(f"  {cnt:>5}  {name!r}")

    print("\n--- Sample reassignments within Cebu (up to 15) ---")
    for r in reassigned_within_cebu[:15]:
        print(f"  {r['id']}: {r['municipality']!r} -> {r['new']!r}  @({r['lat']},{r['lng']})")

    print("\n--- Sample moved out of Cebu (up to 15) ---")
    for r in moved_outside_cebu[:15]:
        print(f"  {r['id']}: {r['municipality']!r} -> cleared  @({r['lat']},{r['lng']})")

    if not apply:
        print("\nDRY-RUN complete. Re-run with --apply to write these changes.")
        driver.close()
        return

    # ---- Apply ----
    print("\nApplying changes to Neo4j...")
    with driver.session() as session:
        batch = 500
        for i in range(0, len(updates_in), batch):
            session.run(
                """
                UNWIND $batch AS item
                MATCH (p:Project {project_id: item.id})
                SET p.municipality = item.municipality,
                    p.municipality_source = 'lgu_polygon',
                    p.outside_cebu = false
                """,
                batch=updates_in[i:i + batch],
            )
        for i in range(0, len(updates_out), batch):
            session.run(
                """
                UNWIND $batch AS item
                MATCH (p:Project {project_id: item.id})
                SET p.municipality = null,
                    p.municipality_source = 'lgu_polygon',
                    p.outside_cebu = true
                """,
                batch=updates_out[i:i + batch],
            )
    print(f"Applied {len(updates_in)} within-Cebu reassignments "
          f"and {len(updates_out)} out-of-Cebu clears.")
    driver.close()


if __name__ == "__main__":
    correct_municipalities(apply="--apply" in sys.argv)
