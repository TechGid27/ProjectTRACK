"""
Analytics Data Models
=====================
Schemas for graph aggregations, contractor rankings, and dataset metrics.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ContractorLeaderboardItem(BaseModel):
    """Ranked contractor entry."""
    contractor: str = Field(description="Contractor business name")
    code: Optional[str] = Field(default=None, description="DPWH contractor code")
    project_count: int = Field(description="Number of civil works projects awarded")
    total_budget: float = Field(description="Total cumulative awarded budget (PHP)")
    total_budget_formatted: str = Field(description="Formatted budget e.g. '₱ 1.45B'")


class TopProjectItem(BaseModel):
    """Ranked highest budget infrastructure project."""
    id: str = Field(description="Project ID")
    budget: Optional[str] = Field(default=None, description="Formatted budget string")
    budget_num: float = Field(description="Numeric budget value (PHP)")
    description: Optional[str] = Field(default=None, description="Scope of civil work")
    contractor: Optional[str] = Field(default=None, description="Awarded contractor")
    location: Optional[str] = Field(default=None, description="Municipality / City")


class DatasetSummary(BaseModel):
    """Overall dataset metrics across the knowledge graph."""
    total_projects: int = Field(description="Total registered DPWH projects in graph")
    total_budget: float = Field(description="Cumulative sum of budgets (PHP)")
    total_budget_formatted: str = Field(description="Human-readable formatted total budget")
    total_contractors: int = Field(description="Total unique civil contractors")
    average_project_cost: Optional[float] = Field(default=None, description="Average cost per project")


class LocationInsightBreakdown(BaseModel):
    """Instant statistical overview of projects for a filtered subset."""
    total_projects: int
    total_budget: float
    total_budget_formatted: str
    top_contractor: Optional[str] = None
    top_contractor_share_pct: Optional[float] = None


class MunicipalityGeoSummary(BaseModel):
    """Aggregated project metrics and geographic centroid for a Cebu municipality."""
    municipality: str = Field(description="Municipality or City name")
    latitude: Optional[float] = Field(default=None, description="Centroid Latitude")
    longitude: Optional[float] = Field(default=None, description="Centroid Longitude")
    total_projects: int = Field(description="Total DPWH projects in municipality")
    total_budget: float = Field(description="Cumulative allocated budget in PHP")
    total_budget_formatted: str = Field(description="Formatted budget string")
