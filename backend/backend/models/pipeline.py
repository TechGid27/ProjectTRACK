"""
Pipeline & Background Task Models
=================================
Schemas for batch synchronization, web scraping jobs, and execution status.
"""

from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class SyncRequest(BaseModel):
    """Parameters for syncing Supabase records to Neo4j Aura."""
    batch_size: int = Field(default=500, ge=50, le=2000, description="Records processed per batch")
    limit: Optional[int] = Field(default=None, ge=1, description="Max total projects to sync (None = all)")


class ScrapeRequest(BaseModel):
    """Parameters for running Apify scraper on DPWH portal."""
    max_items: int = Field(default=100, ge=1, le=5000, description="Max civil work projects to scrape")


class JobStatus(BaseModel):
    """Status tracking for background jobs."""
    job_id: str = Field(description="Unique UUID for task")
    job_type: Literal["sync", "scrape"] = Field(description="Pipeline operation")
    status: Literal["queued", "running", "completed", "failed"] = Field(default="queued")
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    message: str = "Job is queued for processing"
    progress: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
