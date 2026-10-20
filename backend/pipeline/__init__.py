"""
DPWH Cebu Infrastructure Pipeline Package
==========================================
Includes:
- scrape_cebu_dpwh: Scraper for BetterGov / DPWH infrastructure projects in Cebu (2022-present)
- sync_to_neo4j: Batch ingestion into Neo4j Aura knowledge graph
- query_graph: Sub-second graph querying, instant insights, and grounded streaming LLM QA
"""

from .sync_to_neo4j import sync_projects_to_neo4j
from .scrape_cebu_dpwh import main as run_scraper
from .query_graph import (
    run_console,
    ask_llm_stream,
    search_project_by_id,
    search_graph_fts,
    get_top_contractors,
    get_top_projects,
    get_dataset_summary,
    print_project_card,
    print_matched_projects_list,
    print_instant_insights,
    print_fts_results,
    ensure_ollama_running,
    search_projects_by_location,
    format_neo4j_error,
    check_neo4j_connectivity,
)
from .geocoding import geocode_location, geocode_neo4j_graph
from .fetch_philgeps import fetch_philgeps_cebu, sync_procurement_to_neo4j
from .fetch_gaa import fetch_gaa_dpwh_cebu, sync_appropriations_to_neo4j

__all__ = [
    "run_scraper",
    "sync_projects_to_neo4j",
    "fetch_philgeps_cebu",
    "sync_procurement_to_neo4j",
    "fetch_gaa_dpwh_cebu",
    "sync_appropriations_to_neo4j",
    "run_console",
    "ensure_ollama_running",
    "ask_llm_stream",
    "search_project_by_id",
    "search_projects_by_location",
    "search_graph_fts",
    "get_top_contractors",
    "get_top_projects",
    "get_dataset_summary",
    "print_project_card",
    "print_matched_projects_list",
    "print_instant_insights",
    "print_fts_results",
    "format_neo4j_error",
    "check_neo4j_connectivity",
    "geocode_location",
    "geocode_neo4j_graph",
]
