"""
Project Data Models
===================
Pydantic schemas for DPWH civil works projects, full-text search, and location queries.
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class GeocodingInfo(BaseModel):
    """WGS84 Spatial Geocoding Attributes."""
    latitude: Optional[float] = Field(default=None, description="WGS84 Latitude (e.g. 10.3157)")
    longitude: Optional[float] = Field(default=None, description="WGS84 Longitude (e.g. 123.8854)")
    municipality: Optional[str] = Field(default=None, description="City or Municipality in Cebu")
    barangay: Optional[str] = Field(default=None, description="Barangay or District")
    province: str = Field(default="Cebu", description="Province name")
    formatted_address: Optional[str] = Field(default=None, description="Formatted geocoded address string")
    confidence: Optional[str] = Field(default=None, description="Geocoding accuracy level ('barangay' | 'municipality' | 'district' | 'province')")


class ProcurementAward(BaseModel):
    """PhilGEPS procurement/bidding award linked to a project's contractor."""
    reference_id: Optional[str] = Field(default=None, description="PhilGEPS reference ID")
    award_title: Optional[str] = Field(default=None, description="Award title")
    notice_title: Optional[str] = Field(default=None, description="Bid notice / invitation title")
    organization: Optional[str] = Field(default=None, description="Procuring organization name")
    business_category: Optional[str] = Field(default=None, description="PhilGEPS business category")
    contract_amount: Optional[float] = Field(default=None, description="Awarded contract amount in PHP")
    award_date: Optional[str] = Field(default=None, description="Award date")
    award_status: Optional[str] = Field(default=None, description="Award status (e.g. active)")
    match_confidence: Optional[str] = Field(default=None, description="Confidence of the DPWH linkage (e.g. 'exact_name_cebu')")


class ProjectDetail(BaseModel):
    """Full detail card for a DPWH project including WGS84 spatial coordinates."""
    id: str = Field(description="DPWH Project ID e.g. '24HH0043'")
    description: Optional[str] = Field(default=None, description="Detailed project title / scope of work")
    budget: Optional[str] = Field(default=None, description="Raw formatted budget string e.g. '₱ 49,000,000.00'")
    budget_num: Optional[float] = Field(default=None, description="Parsed numeric budget in Philippine Pesos")
    amount_paid: Optional[float] = Field(default=None, description="Amount disbursed / paid to date in PHP")
    source_of_funds: Optional[str] = Field(default=None, description="Funding source / appropriation line (e.g. 'Regular Infra - GAA 2024 CP')")
    funding_source: Optional[str] = Field(default=None, description="Linked FundingSource node name")
    program_name: Optional[str] = Field(default=None, description="DPWH program name (e.g. 'Regular Infra')")
    component_categories: Optional[str] = Field(default=None, description="Detailed component categories")
    region: Optional[str] = Field(default=None, description="DPWH region (e.g. 'Region VII')")

    has_satellite_image: Optional[bool] = Field(default=None, description="Whether a satellite image is available")
    gps_source: Optional[str] = Field(default=None, description="Provenance of coordinates ('dpwh_bettergov' | 'geocoded')")
    status: Optional[str] = Field(default=None, description="Project status (e.g. Completed, Ongoing)")
    timeline: Optional[str] = Field(default=None, description="Project timeline or contract duration")
    url: Optional[str] = Field(default=None, description="DPWH source document URL")
    contractor: Optional[str] = Field(default=None, description="Contractor firm name")
    report_count: Optional[int] = Field(default=0, description="Number of citizen reports filed")
    contractor_code: Optional[str] = Field(default=None, description="DPWH contractor registration code")
    location: Optional[str] = Field(default=None, description="Cleaned municipality, city, or barangay")
    office: Optional[str] = Field(default=None, description="Supervising DPWH District Engineering Office")
    category: Optional[str] = Field(default=None, description="Infrastructure classification")
    latitude: Optional[float] = Field(default=None, description="WGS84 Latitude")
    longitude: Optional[float] = Field(default=None, description="WGS84 Longitude")
    municipality: Optional[str] = Field(default=None, description="Geocoded City or Municipality")
    barangay: Optional[str] = Field(default=None, description="Geocoded Barangay")
    formatted_address: Optional[str] = Field(default=None, description="Formatted display address")
    geocoding: Optional[GeocodingInfo] = Field(default=None, description="Structured spatial coordinates and metadata")
    procurements: Optional[List[ProcurementAward]] = Field(default_factory=list, description="Linked PhilGEPS procurement awards (conservative name+area match)")


class ProjectRelation(BaseModel):
    """Graph relationship connection."""
    rel: str = Field(description="Relationship type, e.g. 'CONTRACTED_TO', 'LOCATED_IN'")
    target: str = Field(description="Connected entity name or ID")
    desc: Optional[str] = Field(default=None, description="Relationship description or label")


class ProjectSearchResult(BaseModel):
    """Result item from full-text search or location aggregation with spatial coordinates."""
    entity: str = Field(description="Entity identifier or project ID")
    labels: List[str] = Field(default_factory=list, description="Neo4j node labels")
    description: Optional[str] = None
    budget: Optional[str] = None
    budget_num: Optional[float] = None
    amount_paid: Optional[float] = Field(default=None, description="Amount disbursed / paid to date in PHP")
    source_of_funds: Optional[str] = Field(default=None, description="Funding source / appropriation line")
    status: Optional[str] = None
    url: Optional[str] = None
    score: Optional[float] = Field(default=1.0, description="Search relevance score")
    latitude: Optional[float] = Field(default=None, description="WGS84 Latitude")
    longitude: Optional[float] = Field(default=None, description="WGS84 Longitude")
    municipality: Optional[str] = Field(default=None, description="Geocoded Municipality")
    barangay: Optional[str] = Field(default=None, description="Geocoded Barangay")
    formatted_address: Optional[str] = Field(default=None, description="Formatted display address")
    relations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class LocationSearchResponse(BaseModel):
    """Aggregated project lookup by Cebu municipality or barangay with location coordinates."""
    location: str = Field(description="Target location query")
    latitude: Optional[float] = Field(default=None, description="Location centroid WGS84 Latitude")
    longitude: Optional[float] = Field(default=None, description="Location centroid WGS84 Longitude")
    municipality: Optional[str] = Field(default=None, description="Matched Municipality or City")
    formatted_address: Optional[str] = Field(default=None, description="Formatted location name")
    total_count: int = Field(description="Total matching projects in knowledge graph")
    total_budget: float = Field(description="Sum of numeric budgets across all matching projects")
    total_budget_formatted: str = Field(description="Formatted total budget in PHP")
    showing_count: int = Field(description="Number of sampled projects returned in this page")
    projects: List[ProjectSearchResult] = Field(default_factory=list)


class ProjectMapPoint(BaseModel):
    """Lightweight GIS point representation for map pins and spatial layers."""
    id: str = Field(description="DPWH Project ID")
    latitude: float = Field(description="WGS84 Latitude")
    longitude: float = Field(description="WGS84 Longitude")
    municipality: Optional[str] = Field(default=None, description="City / Municipality")
    barangay: Optional[str] = Field(default=None, description="Barangay")
    formatted_address: Optional[str] = Field(default=None, description="Address")
    category: Optional[str] = Field(default=None, description="Category (Roads, Flood Control, Buildings, etc.)")
    status: Optional[str] = Field(default=None, description="Project Status")
    budget: Optional[str] = Field(default=None, description="Formatted budget")
    budget_num: Optional[float] = Field(default=None, description="Numeric budget in PHP")
    amount_paid: Optional[float] = Field(default=None, description="Amount disbursed / paid to date in PHP")
    source_of_funds: Optional[str] = Field(default=None, description="Funding source / appropriation line")
    contractor: Optional[str] = Field(default=None, description="Contractor firm name")
    report_count: Optional[int] = Field(default=0, description="Number of citizen reports filed")
