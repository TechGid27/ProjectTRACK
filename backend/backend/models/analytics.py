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


class AppropriationSummary(BaseModel):
    """GAA (General Appropriations Act) totals for a DPWH Cebu district office."""
    office: str = Field(description="DPWH district engineering office (operating unit)")
    line_count: int = Field(description="Number of GAA appropriation line items")
    total_amount: float = Field(description="Cumulative appropriated amount in PHP")
    total_amount_formatted: str = Field(description="Formatted total in PHP")
    years: List[int] = Field(default_factory=list, description="Distinct appropriation years covered")


class ProcurementAwardItem(BaseModel):
    """PhilGEPS procurement/bidding award linked to a DPWH Cebu contractor."""
    contractor: str = Field(description="Awardee / contractor name")
    reference_id: Optional[str] = Field(default=None, description="PhilGEPS reference ID")
    award_title: Optional[str] = Field(default=None, description="Award title")
    notice_title: Optional[str] = Field(default=None, description="Bid notice / invitation title")
    organization: Optional[str] = Field(default=None, description="Procuring organization")
    business_category: Optional[str] = Field(default=None, description="PhilGEPS business category")
    contract_amount: float = Field(default=0.0, description="Awarded contract amount in PHP")
    contract_amount_formatted: Optional[str] = Field(default=None, description="Formatted contract amount")
    award_date: Optional[str] = Field(default=None, description="Award date")
    award_status: Optional[str] = Field(default=None, description="Award status (e.g. active)")
    match_confidence: Optional[str] = Field(default=None, description="DPWH linkage confidence (e.g. 'exact_name_cebu')")
