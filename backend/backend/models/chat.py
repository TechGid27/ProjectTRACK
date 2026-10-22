"""
Chat & GraphRAG Data Models
===========================
Schemas for conversational QA, grounded generation, and guardrail validation.
"""

import re
from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, Field, field_validator


def sanitize_chat_text(v: str, max_len: int = 2000) -> str:
    """Strips script blocks, HTML tags, dangerous attributes, and non-printable control characters."""
    if not v:
        return ""
    v = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', v, flags=re.IGNORECASE)
    v = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', v, flags=re.IGNORECASE)
    v = re.sub(r'<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>', '', v, flags=re.IGNORECASE)
    v = re.sub(r'\bon\w+\s*=\s*(?:\'[^\']*\'|"[^"]*"|[^\s>]+)', '', v, flags=re.IGNORECASE)
    v = re.sub(r'(?:javascript|vbscript|data):[^\s"\']*', '', v, flags=re.IGNORECASE)
    v = re.sub(r'<[^>]*>', '', v)
    v = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', v)
    return v.strip()[:max_len]


class ChatMessage(BaseModel):
    """Single conversational turn."""
    role: Literal["user", "assistant", "system"] = Field(description="Role of message author")
    content: str = Field(description="Message body text")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        return sanitize_chat_text(v, max_len=2000)


class ChatRequest(BaseModel):
    """User prompt request for GraphRAG question answering."""
    message: str = Field(..., min_length=1, max_length=2000, description="Natural language question or project ID")
    history: List[ChatMessage] = Field(default_factory=list, description="Prior conversation turns for context memory")
    mode: Literal["ai", "instant"] = Field(default="ai", description="'ai' for grounded LLM summary, 'instant' for fast Cypher lookup")
    stream: bool = Field(default=False, description="Whether to stream response tokens")

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        clean = sanitize_chat_text(v, max_len=2000)
        if not clean:
            raise ValueError("message cannot be blank after sanitization")
        return clean


class GuardrailStatus(BaseModel):
    """Domain intent check result."""
    is_off_topic: bool = Field(description="True if query violates DPWH domain lock")
    reason: Optional[str] = Field(default=None, description="Explanation if rejected by guardrail")
    matched_rule: Optional[str] = Field(default=None, description="Name of triggered guardrail layer")


class SpatialProjectPoint(BaseModel):
    """Geocoded project pin representation for interactive map dot rendering."""
    id: str = Field(description="DPWH Project ID")
    description: Optional[str] = Field(default=None, description="Scope or title of project")
    budget: Optional[str] = Field(default=None, description="Formatted budget string")
    budget_numeric: Optional[float] = Field(default=None, description="Numeric budget in PHP")
    status: Optional[str] = Field(default=None, description="Current project status e.g. Ongoing, Completed")
    contractor: Optional[str] = Field(default=None, description="Assigned contractor")
    category: Optional[str] = Field(default=None, description="Infrastructure classification")
    latitude: float = Field(description="WGS84 Latitude")
    longitude: float = Field(description="WGS84 Longitude")
    municipality: Optional[str] = Field(default=None, description="Municipality or city name")
    barangay: Optional[str] = Field(default=None, description="Barangay name")
    formatted_address: Optional[str] = Field(default=None, description="Address or location name")
    report_count: Optional[int] = Field(default=None, description="Number of citizen field reports filed against this project")


class SpatialContext(BaseModel):
    """Spatial camera positioning and project dots payload for synchronized Leaflet map flight."""
    target_location: Optional[str] = Field(default=None, description="Matched municipality, city, or district name")
    center: Optional[List[float]] = Field(default=None, description="Centroid [lat, lng] for map camera flyTo")
    zoom: Optional[int] = Field(default=13, description="Recommended map camera zoom level")
    total_count: int = Field(default=0, description="Total project count within targeted municipality")
    projects: List[SpatialProjectPoint] = Field(default_factory=list, description="Top geocoded project dots to render")


class ChatResponse(BaseModel):
    """Completed GraphRAG response payload."""
    answer: str = Field(description="Grounded AI response or instant Cypher card summary")
    graph_context: str = Field(default="", description="Facts retrieved directly from Neo4j knowledge graph")
    project_card: Optional[Dict[str, Any]] = Field(default=None, description="Direct project facts if a single project was targeted")
    matched_projects_count: int = Field(default=0, description="Number of related projects found")
    guardrail: GuardrailStatus = Field(description="Pre-retrieval guardrail status")
    spatial: Optional[SpatialContext] = Field(default=None, description="Spatial coordinates and map dots for synchronized map actions")
    mode: str = Field(default="ai")
    duration_ms: float = Field(default=0.0, description="Total execution time in milliseconds")
    model: Optional[str] = Field(default=None, description="LLM model used for generation")
