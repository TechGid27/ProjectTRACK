"""
Field Report Data Models
========================
Pydantic schemas for the citizen report verification subsystem.

Verdict schema (shared contract with the web & mobile clients — Pillar 5):
    status            : verified | pending | flagged | rejected
    distance_meters   : server-recomputed Haversine distance to DPWH coords
    geofence_pass     : bool (Pillar 1)
    ela_score         : float, higher = more likely edited (Pillar 2)
    phash_recycled    : bool, photo matches a prior report (Pillar 2)
    forensics_verdict : clean | suspicious | recycled (Pillar 2)
    reporter_reputation : int (Pillar 3)
    created_at        : ISO-8601 timestamp
"""

import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# Allowed enums kept here so router + store + tests share one source of truth.
REPORT_CATEGORIES = ("ghost_project", "delay", "substandard_materials", "safety_hazard", "other")
REPORT_STATUSES = ("verified", "pending", "flagged", "rejected")
FORENSICS_VERDICTS = ("clean", "suspicious", "recycled")


def sanitize_input_text(v: str, max_len: int = 2000) -> str:
    """Strips HTML tags, script/style/iframe blocks, dangerous attributes and control codes."""
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


class ReportCreate(BaseModel):
    """Validated submission payload (after multipart parsing in the router)."""
    project_id: str = Field(..., min_length=2, description="DPWH Project ID the report concerns")
    description: str = Field(..., min_length=10, max_length=2000, description="What the reporter observed on site")
    category: str = Field(default="other", description="Report category")
    latitude: Optional[float] = Field(default=None, ge=-90, le=90, description="Reporter device latitude (WGS84)")
    longitude: Optional[float] = Field(default=None, ge=-180, le=180, description="Reporter device longitude (WGS84)")

    @field_validator("project_id")
    @classmethod
    def validate_project_id(cls, v: str) -> str:
        clean = sanitize_input_text(v, max_len=50)
        if not clean:
            raise ValueError("project_id cannot be blank")
        return clean

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        clean = sanitize_input_text(v, max_len=2000)
        if len(clean) < 10:
            raise ValueError("description must be at least 10 characters after sanitization")
        return clean

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in REPORT_CATEGORIES:
            return "other"
        return clean


class ReportVerification(BaseModel):
    """The verification verdict returned to clients and used for badging."""
    id: str = Field(..., description="Report UUID")
    project_id: str
    status: str = Field(..., description="verified | pending | flagged | rejected")
    distance_meters: Optional[int] = Field(default=None, description="Server-recomputed distance to project centroid")
    geofence_pass: bool = Field(default=False, description="Within the ≤150m geofence (server-authoritative)")
    ela_score: Optional[float] = Field(default=None, description="Error Level Analysis score (higher = more edited)")
    phash_recycled: bool = Field(default=False, description="Photo matches a previously submitted report")
    forensics_verdict: str = Field(default="clean", description="clean | suspicious | recycled")
    reporter_reputation: int = Field(default=0, description="Reporter's current reputation score")
    created_at: datetime = Field(..., description="Submission timestamp (ISO-8601)")


class ReportRecord(ReportVerification):
    """Full stored report, extending the verdict with content fields (Pillar 5 badging list)."""
    description: str
    category: str = "other"
    photo_url: Optional[str] = Field(default=None, description="Public URL of the field photo")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ReportListResponse(BaseModel):
    """Retrieval payload for GET /api/reports/{project_id}."""
    project_id: str
    count: int = Field(..., description="Number of reports returned")
    reports: List[ReportRecord] = Field(default_factory=list)


class ProjectReportSummary(BaseModel):
    """Aggregated verification counts for one project (map legend filters)."""
    project_id: str
    on_site: int = Field(0, description="Reports with status=verified (On-Site Verified)")
    flagged: int = Field(0, description="Reports with status pending|flagged|rejected (Photo Flagged)")
    unverified: int = Field(0, description="Reports with any other/missing status (Unverified)")
    total: int = Field(0, description="Total reports for the project")


class ReportSummariesResponse(BaseModel):
    """Retrieval payload for GET /api/reports/summaries (map-wide, redacted)."""
    count: int = Field(..., description="Number of projects with at least one report")
    summaries: List[ProjectReportSummary] = Field(default_factory=list)


class ReputationRecord(BaseModel):
    """A reporter's accumulated reputation (Pillar 3)."""
    user_id: str
    score: int = 0
    reports_total: int = 0
    reports_flagged: int = 0
    updated_at: Optional[datetime] = None
