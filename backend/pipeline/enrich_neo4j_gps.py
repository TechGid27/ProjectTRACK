"""
Enrich Neo4j Knowledge Graph with Authentic DPWH GPS Coordinates
================================================================
Fetches real-world, high-precision GPS coordinates (down to 7 decimal places)
directly from the DPWH search index on BetterGov (https://search2.bettergov.ph)
and updates all Project nodes in Neo4j Aura.
"""

import os
import sys
import time
from typing import List, Dict, Any
from dotenv import load_dotenv
import httpx
from neo4j import GraphDatabase

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Load environment variables
for env_path in [".env", "backend/.env", "../.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

BETTERGOV_SEARCH_URL = "https://search2.bettergov.ph/indexes/dpwh/search"
BETTERGOV_TOKEN = "Bearer 307c9f43a066a443cc37d62b45fa47fde2b39f765139dd964ea151daed65f55c"


def fetch_all_bettergov_projects() -> List[Dict[str, Any]]:
    """Fetch all Cebu projects from BetterGov with pagination."""
    headers = {
        "Authorization": BETTERGOV_TOKEN,
        "Content-Type": "application/json"
    }
    all_hits = []
    offset = 0
    limit = 1000

    print("📡 Fetching authentic Cebu DPWH projects with GPS coordinates from BetterGov...")
    start = time.perf_counter()

    while True:
        payload = {
            "q": "Cebu",
            "filter": "infraYear IN ['2022', '2023', '2024', '2025', '2026']",
            "limit": limit,
            "offset": offset
        }
        r = httpx.post(BETTERGOV_SEARCH_URL, headers=headers, json=payload, timeout=30.0)
        r.raise_for_status()
        data = r.json()
        hits = data.get("hits", [])
        if not hits:
            break
        all_hits.extend(hits)
        print(f"  • Retrieved batch: {len(hits)} projects (Total accumulated: {len(all_hits)})")
        if len(hits) < limit:
            break
        offset += limit

    elapsed = time.perf_counter() - start
    print(f"✅ Fetched {len(all_hits)} projects from BetterGov in {elapsed:.2f}s.")
    return all_hits


def enrich_neo4j_with_gps():
    """Batch-update Neo4j Project nodes with authentic GPS coordinates."""
    if not NEO4J_URI or not NEO4J_PASSWORD:
        print("❌ Error: NEO4J_URI and NEO4J_PASSWORD must be configured.")
        sys.exit(1)

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

    # 1. Inspect current state in Neo4j
    with driver.session() as session:
        stat_before = session.run("""
            MATCH (p:Project)
            RETURN count(p) AS total_projects,
                   count(DISTINCT [p.latitude, p.longitude]) AS unique_coords
        """).single()
        print("\n📊 Current Neo4j Statistics Before Enrichment:")
        print(f"   • Total Projects: {stat_before['total_projects']}")
        print(f"   • Unique Coordinate Pairs: {stat_before['unique_coords']}")

    # 2. Fetch BetterGov Projects
    projects = fetch_all_bettergov_projects()

    # Extract items with valid GPS coordinates
    update_items = []
    for p in projects:
        cid = p.get("contractId")
        lat = p.get("latitude")
        lng = p.get("longitude")
        if cid and lat is not None and lng is not None:
            try:
                lat_f = float(lat)
                lng_f = float(lng)
                # Sanity check: Cebu bounding box approx lat: [9.0, 12.0], lng: [123.0, 125.0]
                if 9.0 <= lat_f <= 12.0 and 123.0 <= lng_f <= 125.0:
                    update_items.append({
                        "project_id": str(cid).strip(),
                        "latitude": lat_f,
                        "longitude": lng_f
                    })
            except (ValueError, TypeError):
                continue

    print(f"\n📦 Prepared {len(update_items)} valid high-precision GPS coordinate pairs.")

    # 3. Batch update Neo4j Project nodes
    cypher_update = """
    UNWIND $batch AS item
    MATCH (p:Project {project_id: item.project_id})
    SET p.latitude = item.latitude,
        p.longitude = item.longitude,
        p.gps_source = "dpwh_bettergov",
        p.gps_updated_at = datetime()
    RETURN count(p) AS updated
    """

    batch_size = 500
    total_updated = 0
    start_update = time.perf_counter()

    with driver.session() as session:
        for i in range(0, len(update_items), batch_size):
            chunk = update_items[i:i + batch_size]
            res = session.run(cypher_update, batch=chunk).single()
            count = res["updated"] if res else len(chunk)
            total_updated += count
            print(f"  • Updated {min(i + batch_size, len(update_items))}/{len(update_items)} projects in Neo4j...")

    elapsed_update = time.perf_counter() - start_update
    print(f"✅ Successfully updated {total_updated} Project nodes in {elapsed_update:.2f}s!")

    # 4. Check statistics after update
    with driver.session() as session:
        stat_after = session.run("""
            MATCH (p:Project)
            RETURN count(p) AS total_projects,
                   count(DISTINCT [p.latitude, p.longitude]) AS unique_coords
        """).single()

        cord_stats = session.run("""
            MATCH (p:Project)
            WHERE toLower(p.description) CONTAINS 'cordova' OR toLower(p.location) CONTAINS 'cordova'
            RETURN count(p) AS total_cord,
                   count(DISTINCT [p.latitude, p.longitude]) AS unique_cord
        """).single()

        print("\n" + "=" * 60)
        print("🎉 NEO4J GPS ENRICHMENT COMPLETE!")
        print("=" * 60)
        print(f"📊 Global Neo4j Stats:")
        print(f"   • Total Projects: {stat_after['total_projects']}")
        print(f"   • Unique Coordinates: {stat_before['unique_coords']} ➡️  {stat_after['unique_coords']}")
        print(f"\n📍 Cordova Focus Stats:")
        print(f"   • Cordova Projects: {cord_stats['total_cord']}")
        print(f"   • Cordova Unique Coordinates: {cord_stats['unique_cord']}")
        print("=" * 60 + "\n")

    driver.close()


if __name__ == "__main__":
    enrich_neo4j_with_gps()
