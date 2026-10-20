-- ============================================================================
-- Field Report Verification Subsystem — Schema Migration 0001
-- ============================================================================
-- Pillars implemented by this schema:
--   1. Physical Presence Verification (Geofence Lock)  -> latitude/longitude/distance_meters/geofence_pass
--   2. Digital Image Forensics (ELA & pHash)           -> ela_score/phash/phash_recycled/forensics_verdict
--   3. Identity & Sybil Resistance                     -> reporter_id + user_reputation + daily rate counting
--   5. Epistemic UI Badging                            -> status + all verification columns surfaced to clients
--
-- Persistence model (hybrid): this Postgres schema is the system of record for
-- report rows and reputation. Photos live in the `report-photos` Storage
-- bucket (see 0002_storage_report_photos.sql). Neo4j additionally receives a
-- lightweight :Report node + report_count increment for graph/chat visibility.
--
-- Apply with the Supabase SQL editor or CLI (see supabase/README.md).
-- ============================================================================

-- Enable UUID generation (pgcrypto ships with Supabase).
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- reports: one row per citizen field report with its verification verdict.
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
    id                uuid primary key default gen_random_uuid(),
    project_id        text        not null,
    reporter_id       uuid        not null,            -- Supabase auth.users.id
    description       text        not null,
    category          text        not null default 'other',
    photo_url         text,                            -- public URL in report-photos bucket
    photo_path        text,                            -- storage object path (for signed URLs / deletion)

    -- Pillar 1: Geofence
    latitude          double precision,
    longitude         double precision,
    distance_meters   integer,
    geofence_pass     boolean     not null default false,

    -- Pillar 2: Forensics
    ela_score         double precision,                -- higher = more likely edited
    phash             text,                            -- perceptual hash (hex)
    phash_recycled    boolean     not null default false,
    forensics_verdict text        not null default 'clean',   -- clean | suspicious | recycled

    -- Pillar 5: Verdict surfaced to clients
    status            text        not null default 'pending', -- verified | pending | flagged | rejected
    reporter_reputation integer   not null default 0,

    created_at        timestamptz not null default now(),

    constraint reports_category_check
        check (category in ('ghost_project','delay','substandard_materials','safety_hazard','other')),
    constraint reports_status_check
        check (status in ('verified','pending','flagged','rejected')),
    constraint reports_forensics_verdict_check
        check (forensics_verdict in ('clean','suspicious','recycled'))
);

-- Indexes --------------------------------------------------------------------
-- Retrieval by project (GET /api/reports/{project_id}), newest first.
create index if not exists reports_project_id_created_at_idx
    on public.reports (project_id, created_at desc);
-- Pillar 3: fast "how many reports did this user file since <timestamp>".
create index if not exists reports_reporter_id_created_at_idx
    on public.reports (reporter_id, created_at desc);
-- Pillar 2: recycled-photo lookups compare against prior pHashes.
create index if not exists reports_phash_idx
    on public.reports (phash);

-- ----------------------------------------------------------------------------
-- user_reputation: one row per reporter, accumulating verification signals.
-- ----------------------------------------------------------------------------
create table if not exists public.user_reputation (
    user_id         uuid        primary key,            -- Supabase auth.users.id
    score           integer     not null default 0,
    reports_total   integer     not null default 0,
    reports_flagged integer     not null default 0,
    updated_at      timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- The backend uses the SERVICE ROLE key, which bypasses RLS. These policies
-- exist so that if the anon/authenticated keys are ever used directly (e.g. a
-- future direct-from-client read), only safe access is possible.
-- ----------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.user_reputation enable row level security;

-- Public (anon) may READ reports — these are civic transparency records. The
-- reporter_id column is a non-identifying UUID; no PII is stored on the row.
drop policy if exists reports_public_read on public.reports;
create policy reports_public_read
    on public.reports
    for select
    using (true);

-- Authenticated users may INSERT only rows attributed to themselves.
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own
    on public.reports
    for insert
    to authenticated
    with check (auth.uid() = reporter_id);

-- Reputation is publicly readable (badging) but only writable via service role.
drop policy if exists reputation_public_read on public.user_reputation;
create policy reputation_public_read
    on public.user_reputation
    for select
    using (true);

-- No anon/authenticated insert/update policy on user_reputation: writes happen
-- exclusively through the backend service role (bypasses RLS).
