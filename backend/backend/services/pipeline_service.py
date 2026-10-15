"""
Pipeline Background Job Manager
===============================
Tracks and manages asynchronous synchronization and scraping jobs.
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, List

from backend.models.pipeline import JobStatus

logger = logging.getLogger("pipeline_service")


class PipelineJobManager:
    """In-memory tracker for long-running pipeline tasks."""

    def __init__(self):
        self._jobs: Dict[str, JobStatus] = {}

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Fetch job details by ID."""
        return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 50) -> List[JobStatus]:
        """List all tracked pipeline jobs ordered by most recent."""
        sorted_jobs = sorted(self._jobs.values(), key=lambda j: j.started_at, reverse=True)
        return sorted_jobs[:limit]

    def create_job(self, job_type: str) -> JobStatus:
        """Create and register a new queued job."""
        job_id = str(uuid.uuid4())
        job = JobStatus(
            job_id=job_id,
            job_type=job_type,
            status="queued",
            started_at=datetime.now(timezone.utc),
            message=f"{job_type.capitalize()} job created and queued."
        )
        self._jobs[job_id] = job
        return job

    async def run_sync_job(self, job_id: str, batch_size: int = 500, limit: Optional[int] = None):
        """Execute Neo4j sync in background thread."""
        job = self._jobs.get(job_id)
        if not job:
            return

        job.status = "running"
        job.message = "Syncing DPWH records from Supabase to Neo4j Aura..."

        def _sync_worker():
            from pipeline.sync_to_neo4j import sync_projects_to_neo4j
            sync_projects_to_neo4j(batch_size=batch_size, limit=limit)

        try:
            await asyncio.to_thread(_sync_worker)
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            job.message = "Successfully synced projects to Neo4j Knowledge Graph."
            logger.info(f"Sync job {job_id} completed successfully.")
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc)
            job.error = str(e)
            job.message = f"Sync failed: {e}"
            logger.error(f"Sync job {job_id} encountered an error: {e}")

    async def run_scrape_job(self, job_id: str, max_items: int = 100):
        """Execute web scraper in background thread."""
        job = self._jobs.get(job_id)
        if not job:
            return

        job.status = "running"
        job.message = f"Scraping up to {max_items} DPWH civil works projects via Apify..."

        def _scrape_worker():
            from pipeline.scrape_cebu_dpwh import main as run_scraper
            run_scraper()

        try:
            await asyncio.to_thread(_scrape_worker)
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            job.message = "Web scraping completed and results stored in Supabase."
            logger.info(f"Scraper job {job_id} completed successfully.")
        except Exception as e:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc)
            job.error = str(e)
            job.message = f"Scraping failed: {e}"
            logger.error(f"Scraper job {job_id} encountered an error: {e}")


# Global singleton instance
pipeline_manager = PipelineJobManager()
