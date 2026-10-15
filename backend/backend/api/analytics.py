"""
Analytics API Endpoints
=======================
Graph metrics, contractor leaderboards, and dataset statistics.
"""

from typing import List
from fastapi import APIRouter, Query

from backend.models.analytics import (
    DatasetSummary,
    ContractorLeaderboardItem,
    TopProjectItem,
    MunicipalityGeoSummary,
)
from backend.services.neo4j_service import neo4j_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/summary",
    response_model=DatasetSummary,
    summary="Knowledge Graph Dataset Statistics"
)
async def get_summary():
    """Sub-millisecond dataset aggregation: total projects, cumulative budget, unique contractors."""
    return neo4j_service.get_dataset_summary()


@router.get(
    "/top-contractors",
    response_model=List[ContractorLeaderboardItem],
    summary="Top Contractors by Total Awarded Budget"
)
async def get_top_contractors(
    limit: int = Query(default=10, ge=1, le=100, description="Number of top contractors to retrieve")
):
    """Rank contractors by cumulative infrastructure budget awarded across Cebu."""
    return neo4j_service.get_top_contractors(limit=limit)


@router.get(
    "/top-projects",
    response_model=List[TopProjectItem],
    summary="Highest Budget Infrastructure Projects"
)
async def get_top_projects(
    limit: int = Query(default=10, ge=1, le=100, description="Number of top projects to retrieve")
):
    """Rank DPWH projects in Cebu by total project cost."""
    return neo4j_service.get_top_projects(limit=limit)


@router.get(
    "/locations",
    response_model=List[MunicipalityGeoSummary],
    summary="Spatial Breakdown by Cebu Municipality"
)
async def get_location_breakdown():
    """Geographic breakdown of total projects, cumulative budget, and centroid coordinates by municipality."""
    return neo4j_service.get_location_breakdown()
