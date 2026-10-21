"""
Projects API Endpoints
======================
Fast project lookup, full-text search, and municipality aggregation.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Path

from backend.models.project import (
    ProjectDetail,
    ProjectSearchResult,
    LocationSearchResponse,
    ProjectMapPoint,
)
from backend.services.neo4j_service import neo4j_service, format_currency
from pipeline.geocoding import geocode_location

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get(
    "/search",
    response_model=List[ProjectSearchResult],
    summary="Full-Text Search Across Knowledge Graph"
)
async def search_projects(
    q: str = Query(..., min_length=2, description="Search term (e.g. 'flood control', 'asphalt', 'bogo', 'qm builders')"),
    limit: int = Query(default=20, ge=1, le=100, description="Max results to return")
):
    """Sub-50ms full-text search across projects, contractors, and locations with coordinates."""
    results = neo4j_service.search_fts(query=q, limit=limit)
    return results


@router.get(
    "/map",
    response_model=List[ProjectMapPoint],
    summary="Get Geocoded Projects for Map Visualization"
)
async def get_map_projects(
    municipality: Optional[str] = Query(default=None, description="Filter by municipality (e.g. 'Mandaue', 'Cebu City')"),
    limit: int = Query(default=500, ge=1, le=5000, description="Max pins to return")
):
    """Retrieve geocoded points with WGS84 latitude/longitude for Mapbox, Leaflet, or Google Maps."""
    return neo4j_service.get_map_projects(municipality=municipality, limit=limit)


@router.get(
    "/by-location",
    response_model=LocationSearchResponse,
    summary="Search Projects by Cebu Municipality / City"
)
async def search_by_location(
    location: str = Query(..., min_length=2, description="Cebu municipality, city, or barangay (e.g. 'Bogo', 'Mandaue', 'Toledo')"),
    limit: int = Query(default=15, ge=1, le=500, description="Sample projects limit")
):
    """Aggregate total projects and budget for a specific Cebu location with geocoding."""
    samples, total_cnt, total_b = neo4j_service.search_projects_by_location(location_name=location, limit=limit)
    geo = geocode_location(location)
    return LocationSearchResponse(
        location=location,
        latitude=geo.get("latitude"),
        longitude=geo.get("longitude"),
        municipality=geo.get("municipality"),
        formatted_address=geo.get("formatted_address"),
        total_count=total_cnt,
        total_budget=total_b,
        total_budget_formatted=format_currency(total_b),
        showing_count=len(samples),
        projects=samples
    )


@router.get(
    "/{project_id}",
    response_model=ProjectDetail,
    summary="Exact DPWH Project Lookup"
)
async def get_project_by_id(
    project_id: str = Path(..., description="DPWH Project ID (e.g. '24HH0043', '25H00064')")
):
    """Fetch complete project detail card with all linked graph relationships and geocoding."""
    clean_id = project_id.strip().upper()
    project = neo4j_service.get_project_by_id(clean_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{clean_id}' was not found in the DPWH Cebu Knowledge Graph."
        )
    return project
