-- ============================================================================
-- Passive Scrape Scheduler — Durable Last-Run State — Schema Migration 0003
-- ============================================================================
-- Backs the passive periodic scraper (APScheduler, see
-- backend/backend/services/scheduler.py). A single row per scheduled job
-- records when it last ran so the recurring interval (default ~90 days)
-- survives backend restarts and redeploys, and so overlapping or duplicate
-- runs across replicas are skipped (the scheduler only proceeds when
-- last_run_at is older than the configured interval).
--
-- The backend writes this table with the SERVICE ROLE key (bypasses RLS).
-- Graceful degradation: if this table is absent or Supabase is unconfigured,
-- the scheduler falls back to an in-memory start time and logs a warning —
-- the application still runs.
--
-- Apply with the Supabase SQL editor or CLI (see supabase/README.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pipeline_schedule_state: one row per named scheduled job.
-- ----------------------------------------------------------------------------
create table if not exists public.pipeline_schedule_state (
    job_name     text        primary key,              -- e.g. 'passive_scrape'
    last_run_at  timestamptz,                           -- start of the most recent run
    last_status  text,                                  -- completed | failed | running
    last_job_id  text,                                  -- PipelineJobManager job UUID
    updated_at   timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Writes happen exclusively through the backend service role (bypasses RLS).
-- No anon/authenticated policies are defined, so direct client access is
-- denied by default while the service role continues to operate.
-- ----------------------------------------------------------------------------
alter table public.pipeline_schedule_state enable row level security;
