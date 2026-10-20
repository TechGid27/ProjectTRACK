"""
Neo4j Graph Database Service
============================
Handles connection pooling, Cypher execution, full-text search, and
graph aggregations with graceful degradation.
"""

import time
import logging
from typing import Optional, List, Dict, Any, Tuple
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import Neo4jError, ServiceUnavailable, AuthError

from backend.config import settings
from backend.services.guardrail_service import (
    clean_location,
    clean_description,
    sanitize_search_query,
    STOP_WORDS,
)

logger = logging.getLogger("neo4j_service")


def format_currency(amount: Optional[float]) -> str:
    """Format numeric budget values into readable Philippine Peso strings."""
    if amount is None or amount == 0:
        return "₱ 0.00"
    if amount >= 1_000_000_000:
        return f"₱ {amount / 1_000_000_000:.2f}B"
    if amount >= 1_000_000:
        return f"₱ {amount / 1_000_000:.2f}M"
    return f"₱ {amount:,.2f}"


def canonical_municipality(name: Optional[str]) -> str:
    """
    Reduce an LGU name to a canonical comparison token.

    Reconciles the two city-naming conventions present in the dataset and the
    frontend (``"City of Bogo"`` vs ``"Bogo City"``) and tolerates bare names
    (``"Bogo"``). The result is lowercased, trimmed, stripped of a leading
    ``"city of "`` and a trailing ``" city"``, and of any ``", cebu"`` province
    suffix so that equality comparison isolates a single municipality without
    the substring leakage that pulled in province-wide records.
    """
    if not name:
        return ""
    token = str(name).strip().lower()
    # Drop trailing province qualifier, e.g. "Cebu City, Cebu" -> "cebu city".
    if token.endswith(", cebu"):
        token = token[: -len(", cebu")].strip()
    if token.startswith("city of "):
        token = token[len("city of "):]
    elif token.endswith(" city"):
        token = token[: -len(" city")]
    return token.strip()


# Cypher expression mirroring :func:`canonical_municipality` so that the stored
# ``p.municipality`` is normalized the same way as the Python-normalized
# ``$muni_token`` parameter. Both sides are reduced to a bare token before an
# exact equality comparison, eliminating cross-LGU substring matches.
#
# Built in stages for readability:
#   base = lower(trim(municipality)) with any trailing ", cebu" removed
#   then strip a leading "city of " or a trailing " city".
_CYPHER_MUNI_BASE = "replace(toLower(trim(coalesce(p.municipality, ''))), ', cebu', '')"
_CYPHER_MUNI_CANON = (
    "CASE"
    f"  WHEN {_CYPHER_MUNI_BASE} STARTS WITH 'city of '"
    f"    THEN substring({_CYPHER_MUNI_BASE}, 8)"
    f"  WHEN {_CYPHER_MUNI_BASE} ENDS WITH ' city'"
    f"    THEN left({_CYPHER_MUNI_BASE}, size({_CYPHER_MUNI_BASE}) - 5)"
    f"  ELSE {_CYPHER_MUNI_BASE}"
    " END"
)


class Neo4jService:
    """Singleton Neo4j service for high-performance Cypher traversals."""

    def __init__(self):
        self._driver: Optional[Driver] = None
        self._connected: bool = False

    def get_driver(self) -> Optional[Driver]:
        """Lazily initialize and return the Neo4j driver."""
        if self._driver is None:
            if not settings.NEO4J_URI or not settings.NEO4J_PASSWORD:
                logger.warning("Neo4j credentials not configured in environment.")
                return None
            try:
                self._driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                    max_connection_lifetime=settings.NEO4J_MAX_CONNECTION_LIFETIME,
                    max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE,
                    connection_timeout=settings.NEO4J_CONNECTION_TIMEOUT,
                )
                self._connected = True
            except Exception as e:
                logger.error(f"Failed to create Neo4j driver: {e}")
                self._connected = False
                return None
        return self._driver

    def close(self):
        """Close driver connection pool on server shutdown."""
        if self._driver is not None:
            try:
                self._driver.close()
                logger.info("Neo4j driver connection pool closed.")
            except Exception as e:
                logger.warning(f"Error closing Neo4j driver: {e}")
            finally:
                self._driver = None
                self._connected = False

    def check_connection(self) -> Tuple[bool, float, Optional[str]]:
        """
        Verify database connectivity and measure ping latency in milliseconds.
        Returns: (reachable, latency_ms, error_message)
        """
        driver = self.get_driver()
        if not driver:
            return False, 0.0, "Driver uninitialized or credentials missing"

        start = time.perf_counter()
        try:
            with driver.session() as session:
                result = session.run("RETURN 1 AS ping").single()
                latency = (time.perf_counter() - start) * 1000
                if result and result["ping"] == 1:
                    return True, round(latency, 2), None
                return False, round(latency, 2), "Unexpected ping response"
        except (ServiceUnavailable, AuthError, Neo4jError, Exception) as e:
            latency = (time.perf_counter() - start) * 1000
            err_msg = str(e)
            if any(k in err_msg.lower() for k in ["getaddrinfo failed", "dns resolve", "11001", "name does not exist"]):
                err_msg = (
                    "Neo4j Aura database host is unreachable (likely PAUSED after 3 days of inactivity). "
                    "Visit https://console.neo4j.io to click 'Resume'."
                )
            logger.debug(f"Neo4j ping failed: {err_msg}")
            return False, round(latency, 2), err_msg

    def get_project_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Exact DPWH project lookup with connected contractor, location, office, and WGS84 geocoding."""
        driver = self.get_driver()
        if not driver:
            return None

        cypher = """
        MATCH (p:Project)
        WHERE toLower(p.project_id) = toLower($pid)
        OPTIONAL MATCH (p)-[:CONTRACTED_TO]->(c:Contractor)
        OPTIONAL MATCH (p)-[:LOCATED_IN]->(loc:Location)
        OPTIONAL MATCH (p)-[:SUPERVISED_BY]->(off:Office)
        OPTIONAL MATCH (p)-[:CATEGORIZED_AS]->(cat:Category)
        OPTIONAL MATCH (p)-[:FUNDED_BY]->(fund:FundingSource)
        OPTIONAL MATCH (c)-[:AWARDED]->(pr:Procurement)
        WITH p, c, loc, off, cat, fund,
             collect(DISTINCT CASE WHEN pr IS NULL THEN NULL ELSE {
                 reference_id: pr.reference_id,
                 award_title: pr.award_title,
                 notice_title: pr.notice_title,
                 organization: pr.organization_name,
                 business_category: pr.business_category,
                 contract_amount: pr.contract_amount,
                 award_date: pr.award_date,
                 award_status: pr.award_status,
                 match_confidence: pr.match_confidence
             } END) AS procurement_raw
        RETURN p.project_id AS id,
               p.description AS description,
               p.budget_raw AS budget,
               p.budget_numeric AS budget_num,
               p.amount_paid AS amount_paid,
               p.source_of_funds AS source_of_funds,
               p.program_name AS program_name,
               p.component_categories AS component_categories,
               p.region AS region,
               p.report_count AS report_count,
               p.has_satellite_image AS has_satellite_image,
               p.gps_source AS gps_source,
               p.status AS status,
               p.timeline AS timeline,
               p.url AS url,
               c.name AS contractor,
               c.code AS contractor_code,
               coalesce(loc.name, p.location) AS location,
               coalesce(p.latitude, loc.latitude) AS latitude,
               coalesce(p.longitude, loc.longitude) AS longitude,
               coalesce(p.municipality, loc.municipality) AS municipality,
               coalesce(p.barangay, loc.barangay) AS barangay,
               coalesce(p.formatted_address, loc.formatted_address) AS formatted_address,
               off.name AS office,
               cat.name AS category,
               coalesce(fund.name, p.source_of_funds) AS funding_source,
               [x IN procurement_raw WHERE x IS NOT NULL] AS procurements
        LIMIT 1
        """
        try:
            with driver.session() as s:
                records = s.run(cypher, pid=project_id.strip()).data()
                if records:
                    res = records[0]
                    res["location"] = clean_location(res.get("location"))
                    res["description"] = clean_description(res.get("description"))
                    lat = res.get("latitude")
                    lng = res.get("longitude")
                    if lat is not None and lng is not None:
                        res["geocoding"] = {
                            "latitude": lat,
                            "longitude": lng,
                            "municipality": res.get("municipality"),
                            "barangay": res.get("barangay"),
                            "province": "Cebu",
                            "formatted_address": res.get("formatted_address"),
                            "confidence": "barangay" if res.get("barangay") else "municipality"
                        }
                    return res
        except Exception as e:
            logger.error(f"Error fetching project {project_id}: {e}")
        return None

    def search_projects_by_location(
        self, location_name: str, limit: int = 15
    ) -> Tuple[List[Dict[str, Any]], int, float]:
        """Retrieve all projects matching a municipality, city, or barangay location with coordinates."""
        driver = self.get_driver()
        if not driver:
            return [], 0, 0.0

        clean_loc = sanitize_search_query(location_name).strip()
        if not clean_loc or len(clean_loc) < 3:
            return [], 0, 0.0

        # Canonicalize the RAW location name, not the FTS-sanitized form.
        # sanitize_search_query collapses e.g. "Lapu-Lapu City" -> "Lapu City",
        # which would then canonicalize to "lapu" and never match the stored
        # "Lapu-Lapu City" (canonical "lapu-lapu").
        loc_token = canonical_municipality(location_name)
        if not loc_token:
            return [], 0, 0.0

        cypher_count = """
        MATCH (p:Project)
        WHERE """ + _CYPHER_MUNI_CANON + """ = $loc_token
        RETURN count(DISTINCT p) AS cnt, sum(p.budget_numeric) AS total_budget
        """
        cypher_samples = """
        MATCH (p:Project)
        WHERE """ + _CYPHER_MUNI_CANON + """ = $loc_token
        WITH DISTINCT p
        ORDER BY p.budget_numeric DESC
        LIMIT $limit
        OPTIONAL MATCH (p)-[:CONTRACTED_TO]->(c:Contractor)
        OPTIONAL MATCH (p)-[:LOCATED_IN]->(loc:Location)
        RETURN p.project_id AS entity,
               ['Project'] AS labels,
               p.description AS description,
               p.budget_raw AS budget,
               p.budget_numeric AS budget_num,
               p.status AS status,
               p.url AS url,
               p.latitude AS latitude,
               p.longitude AS longitude,
               p.municipality AS municipality,
               p.barangay AS barangay,
               coalesce(p.formatted_address, loc.formatted_address) AS formatted_address,
               1.0 AS score,
               [
                   {rel: 'LOCATED_IN', target: coalesce(loc.name, p.municipality), desc: coalesce(loc.name, p.municipality)},
                   {rel: 'CONTRACTED_TO', target: coalesce(c.name, 'N/A'), desc: coalesce(c.name, 'N/A')}
               ] AS relations
        """
        try:
            with driver.session() as s:
                cnt_row = s.run(cypher_count, loc_token=loc_token).single()
                if not cnt_row or cnt_row["cnt"] == 0:
                    return [], 0, 0.0
                total_cnt = cnt_row["cnt"]
                total_b = float(cnt_row["total_budget"] or 0.0)

                samples = s.run(cypher_samples, loc_token=loc_token, limit=limit).data()
                for sample in samples:
                    sample["description"] = clean_description(sample.get("description"))
                return samples, total_cnt, total_b
        except Exception as e:
            logger.error(f"Error querying location '{location_name}': {e}")
            return [], 0, 0.0

    def search_fts(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Full-text search across projects, contractors, and locations with spatial data."""
        driver = self.get_driver()
        if not driver:
            return []

        clean = sanitize_search_query(query)
        if not clean:
            return []

        words = clean.split()
        search_term = " AND ".join([f"{w}*" for w in words if len(w) > 1]) or clean

        cypher_fts = """
        CALL db.index.fulltext.queryNodes('entity_fts', $search_term) YIELD node, score
        WITH node, score
        ORDER BY score DESC
        LIMIT $limit
        OPTIONAL MATCH (node)-[r]-(neighbor)
        RETURN node.entity_id AS entity,
               labels(node) AS labels,
               node.description AS description,
               node.budget_raw AS budget,
               node.budget_numeric AS budget_num,
               node.amount_paid AS amount_paid,
               node.source_of_funds AS source_of_funds,
               node.status AS status,
               node.url AS url,
               node.latitude AS latitude,
               node.longitude AS longitude,
               node.municipality AS municipality,
               node.barangay AS barangay,
               node.formatted_address AS formatted_address,
               score,
               collect(DISTINCT {
                   rel: type(r),
                   target: neighbor.entity_id,
                   desc: r.description
               })[0..6] AS relations
        """
        try:
            with driver.session() as s:
                records = s.run(cypher_fts, search_term=search_term, limit=limit).data()
                if records:
                    return records
        except Exception:
            pass  # Fallback to case-insensitive CONTAINS

        cypher_fallback = """
        MATCH (node)
        WHERE ALL(w IN $words WHERE
            toLower(node.entity_id) CONTAINS toLower(w)
            OR toLower(coalesce(node.description, '')) CONTAINS toLower(w)
            OR toLower(coalesce(node.location, '')) CONTAINS toLower(w)
            OR toLower(coalesce(node.contractor, '')) CONTAINS toLower(w)
        )
        WITH node
        LIMIT $limit
        OPTIONAL MATCH (node)-[r]-(neighbor)
        RETURN node.entity_id AS entity,
               labels(node) AS labels,
               node.description AS description,
               node.budget_raw AS budget,
               node.budget_numeric AS budget_num,
               node.amount_paid AS amount_paid,
               node.source_of_funds AS source_of_funds,
               node.status AS status,
               node.url AS url,
               node.latitude AS latitude,
               node.longitude AS longitude,
               node.municipality AS municipality,
               node.barangay AS barangay,
               node.formatted_address AS formatted_address,
               1.0 AS score,
               collect(DISTINCT {
                   rel: type(r),
                   target: neighbor.entity_id,
                   desc: r.description
               })[0..6] AS relations
        """
        try:
            with driver.session() as s:
                return s.run(cypher_fallback, words=words, limit=limit).data()
        except Exception as e:
            logger.error(f"FTS search fallback failed for query '{query}': {e}")
            return []

    def get_map_projects(self, municipality: Optional[str] = None, limit: int = 500) -> List[Dict[str, Any]]:
        """Fetch geocoded project points for GIS mapping and spatial visualization."""
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (p:Project)
        WHERE p.latitude IS NOT NULL
          AND (
            $muni_token IS NULL
            OR """ + _CYPHER_MUNI_CANON + """ = $muni_token
          )
        OPTIONAL MATCH (p)-[:CONTRACTED_TO]->(c:Contractor)
        RETURN p.project_id AS id,
               p.latitude AS latitude,
               p.longitude AS longitude,
               p.municipality AS municipality,
               p.barangay AS barangay,
               p.formatted_address AS formatted_address,
               p.description AS description,
               p.category AS category,
               p.status AS status,
               p.budget_raw AS budget,
               p.budget_numeric AS budget_num,
               p.amount_paid AS amount_paid,
               p.source_of_funds AS source_of_funds,
               c.name AS contractor
        ORDER BY p.budget_numeric DESC
        LIMIT $limit
        """
        muni_token = canonical_municipality(municipality) if municipality else None
        if municipality and not muni_token:
            return []
        try:
            with driver.session() as s:
                return s.run(cypher, muni_token=muni_token, limit=limit).data()
        except Exception as e:
            logger.error(f"Error fetching map projects: {e}")
            return []

    def get_location_breakdown(self) -> List[Dict[str, Any]]:
        """Return project count, cumulative budget, and coordinates for each municipality in Cebu."""
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (p:Project)
        WHERE p.municipality IS NOT NULL AND p.latitude IS NOT NULL
        RETURN p.municipality AS municipality,
               avg(p.latitude) AS latitude,
               avg(p.longitude) AS longitude,
               count(p) AS total_projects,
               sum(p.budget_numeric) AS total_budget
        ORDER BY total_projects DESC
        """
        try:
            with driver.session() as s:
                rows = s.run(cypher).data()
                for r in rows:
                    r["total_budget_formatted"] = format_currency(r.get("total_budget"))
                    r["latitude"] = round(r["latitude"], 4) if r.get("latitude") else None
                    r["longitude"] = round(r["longitude"], 4) if r.get("longitude") else None
                return rows
        except Exception as e:
            logger.error(f"Error fetching location breakdown: {e}")
            return []

    def get_appropriations_by_office(self, limit: int = 50) -> List[Dict[str, Any]]:
        """GAA appropriations aggregated per DPWH Cebu district engineering office."""
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (o:Office)-[:APPROPRIATED_UNDER]->(a:Appropriation)
        RETURN o.name AS office,
               count(a) AS line_count,
               sum(a.amount) AS total_amount,
               [y IN collect(DISTINCT a.year) WHERE y IS NOT NULL] AS years
        ORDER BY total_amount DESC
        LIMIT $limit
        """
        try:
            with driver.session() as s:
                rows = s.run(cypher, limit=limit).data()
                for r in rows:
                    r["total_amount"] = float(r.get("total_amount") or 0.0)
                    r["total_amount_formatted"] = format_currency(r["total_amount"])
                    r["years"] = sorted([int(y) for y in (r.get("years") or [])])
                return rows
        except Exception as e:
            logger.error(f"Error fetching appropriations: {e}")
            return []

    def get_procurement_awards(
        self, contractor: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List PhilGEPS procurement awards linked to DPWH Cebu contractors.

        Optionally filter by (partial, case-insensitive) contractor name.
        """
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (c:Contractor)-[:AWARDED]->(pr:Procurement)
        WHERE $contractor IS NULL OR toLower(c.name) CONTAINS toLower($contractor)
        OPTIONAL MATCH (pr)-[:PROCURED_BY]->(org:Organization)
        RETURN c.name AS contractor,
               pr.reference_id AS reference_id,
               pr.award_title AS award_title,
               pr.notice_title AS notice_title,
               coalesce(org.name, pr.organization_name) AS organization,
               pr.business_category AS business_category,
               pr.contract_amount AS contract_amount,
               pr.award_date AS award_date,
               pr.award_status AS award_status,
               pr.match_confidence AS match_confidence
        ORDER BY pr.contract_amount DESC
        LIMIT $limit
        """
        try:
            with driver.session() as s:
                rows = s.run(cypher, contractor=contractor, limit=limit).data()
                for r in rows:
                    r["contract_amount"] = float(r.get("contract_amount") or 0.0)
                    r["contract_amount_formatted"] = format_currency(r["contract_amount"])
                return rows
        except Exception as e:
            logger.error(f"Error fetching procurement awards: {e}")
            return []

    def get_top_contractors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Analytics: Top contractors by total awarded budget."""
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (p:Project)-[:CONTRACTED_TO]->(c:Contractor)
        WHERE p.budget_numeric > 0
        RETURN c.name AS contractor,
               c.code AS code,
               count(p) AS project_count,
               sum(p.budget_numeric) AS total_budget
        ORDER BY total_budget DESC
        LIMIT $limit
        """
        try:
            with driver.session() as s:
                records = s.run(cypher, limit=limit).data()
                for r in records:
                    r["total_budget"] = float(r.get("total_budget") or 0.0)
                    r["total_budget_formatted"] = format_currency(r["total_budget"])
                return records
        except Exception as e:
            logger.error(f"Error fetching top contractors: {e}")
            return []

    def get_top_projects(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Analytics: Most expensive projects."""
        driver = self.get_driver()
        if not driver:
            return []

        cypher = """
        MATCH (p:Project)
        WHERE p.budget_numeric > 0
        OPTIONAL MATCH (p)-[:CONTRACTED_TO]->(c:Contractor)
        OPTIONAL MATCH (p)-[:LOCATED_IN]->(loc:Location)
        RETURN p.project_id AS id,
               p.budget_raw AS budget,
               p.budget_numeric AS budget_num,
               p.description AS description,
               c.name AS contractor,
               loc.name AS location
        ORDER BY p.budget_numeric DESC
        LIMIT $limit
        """
        try:
            with driver.session() as s:
                records = s.run(cypher, limit=limit).data()
                for r in records:
                    r["location"] = clean_location(r.get("location"))
                    r["description"] = clean_description(r.get("description"))
                return records
        except Exception as e:
            logger.error(f"Error fetching top projects: {e}")
            return []

    def get_dataset_summary(self) -> Dict[str, Any]:
        """Overall dataset statistics."""
        driver = self.get_driver()
        if not driver:
            return {
                "total_projects": 0,
                "total_budget": 0.0,
                "total_budget_formatted": "₱ 0.00",
                "total_contractors": 0,
                "average_project_cost": 0.0,
            }

        cypher = """
        MATCH (p:Project)
        OPTIONAL MATCH (c:Contractor)
        RETURN count(DISTINCT p) AS total_projects,
               sum(p.budget_numeric) AS total_budget,
               count(DISTINCT c) AS total_contractors
        """
        try:
            with driver.session() as s:
                row = s.run(cypher).single()
                if row:
                    cnt = row["total_projects"] or 0
                    b_sum = float(row["total_budget"] or 0.0)
                    c_cnt = row["total_contractors"] or 0
                    avg = round(b_sum / cnt, 2) if cnt > 0 else 0.0
                    return {
                        "total_projects": cnt,
                        "total_budget": b_sum,
                        "total_budget_formatted": format_currency(b_sum),
                        "total_contractors": c_cnt,
                        "average_project_cost": avg,
                    }
        except Exception as e:
            logger.error(f"Error fetching dataset summary: {e}")

        return {
            "total_projects": 0,
            "total_budget": 0.0,
            "total_budget_formatted": "₱ 0.00",
            "total_contractors": 0,
            "average_project_cost": 0.0,
        }


# Global singleton instance
neo4j_service = Neo4jService()
