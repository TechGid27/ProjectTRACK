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


class ScheduleStatus(BaseModel):
    """Passive periodic scraper schedule state (GET /pipeline/schedule)."""
    enabled: bool = Field(description="Whether the passive scraper is active")
    interval_days: int = Field(description="Days between passive scrape+sync runs")
    last_run_at: Optional[str] = Field(default=None, description="ISO-8601 timestamp of the last run, if any")
    next_run_at: Optional[str] = Field(default=None, description="ISO-8601 timestamp of the projected next run")
    sync_after: bool = Field(description="Whether a Neo4j sync runs after each scrape")
    running: bool = Field(description="Whether a passive cycle is currently executing")
    job_name: str = Field(description="Durable schedule-state key")
