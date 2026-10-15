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


class ProjectDetail(BaseModel):
    """Full detail card for a DPWH project including WGS84 spatial coordinates."""
    id: str = Field(description="DPWH Project ID e.g. '24HH0043'")
    description: Optional[str] = Field(default=None, description="Detailed project title / scope of work")
    budget: Optional[str] = Field(default=None, description="Raw formatted budget string e.g. '₱ 49,000,000.00'")
    budget_num: Optional[float] = Field(default=None, description="Parsed numeric budget in Philippine Pesos")
    status: Optional[str] = Field(default=None, description="Project status (e.g. Completed, Ongoing)")
    timeline: Optional[str] = Field(default=None, description="Project timeline or contract duration")
    url: Optional[str] = Field(default=None, description="DPWH source document URL")
    contractor: Optional[str] = Field(default=None, description="Contractor firm name")
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
    contractor: Optional[str] = Field(default=None, description="Contractor firm name")
