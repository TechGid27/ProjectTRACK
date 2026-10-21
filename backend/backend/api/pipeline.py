"""
Pipeline Administration Endpoints
=================================
Trigger and monitor batch synchronization and scraping background jobs.
"""

from typing import List
from fastapi import APIRouter, BackgroundTasks, HTTPException, Path

from backend.models.pipeline import SyncRequest, ScrapeRequest, JobStatus, ScheduleStatus
from backend.services.pipeline_service import pipeline_manager
from backend.services.scheduler import passive_scheduler

router = APIRouter(prefix="/pipeline", tags=["Pipeline Administration"])


@router.post("/sync", response_model=JobStatus, summary="Trigger Batch Ingestion into Neo4j")
async def trigger_sync(request: SyncRequest, background_tasks: BackgroundTasks):
    """
    Trigger paginated batch synchronization of DPWH projects from Supabase into Neo4j Aura.
    Runs asynchronously in the background.
    """
    job = pipeline_manager.create_job(job_type="sync")
    background_tasks.add_task(
        pipeline_manager.run_sync_job,
        job_id=job.job_id,
        batch_size=request.batch_size,
        limit=request.limit
    )
    return job


@router.post("/scrape", response_model=JobStatus, summary="Trigger Apify Web Scraper")
async def trigger_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    """
    Trigger Apify web scraper for Cebu DPWH portal civil works.
    Runs asynchronously in the background.
    """
    job = pipeline_manager.create_job(job_type="scrape")
    background_tasks.add_task(
        pipeline_manager.run_scrape_job,
        job_id=job.job_id,
        max_items=request.max_items
    )
    return job


@router.get("/jobs", response_model=List[JobStatus], summary="List Background Jobs")
async def list_jobs():
    """List recent pipeline execution tasks."""
    return pipeline_manager.list_jobs()


@router.get("/jobs/{job_id}", response_model=JobStatus, summary="Check Background Job Status")
async def get_job_status(job_id: str = Path(..., description="Job UUID")):
    """Check status and logs of a specific background job."""
    job = pipeline_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


@router.get("/schedule", response_model=ScheduleStatus, summary="Passive Scraper Schedule State")
async def get_schedule():
    """
    Report the passive periodic scraper's configuration and durable last/next
    run timestamps. Reflects PASSIVE_SCRAPE_* settings and the Supabase-backed
    pipeline_schedule_state row.
    """
    return await passive_scheduler.status()


@router.post("/schedule/run-now", response_model=JobStatus, summary="Trigger Passive Scrape Immediately")
async def run_schedule_now(background_tasks: BackgroundTasks):
    """
    Force a passive scrape+sync cycle now, bypassing the interval guard (manual
    override of the quarterly schedule). Runs in the background and is tracked
    as a normal scrape job.
    """
    job = pipeline_manager.create_job(job_type="scrape")
    background_tasks.add_task(passive_scheduler.run_cycle, force=True)
    return job
