-- ============================================================================
-- Field Report Verification Subsystem — Storage Migration 0002
-- ============================================================================
-- Creates the `report-photos` Storage bucket that holds citizen-submitted
-- field photos (Pillar 1 ground-truth evidence, Pillar 2 forensic input).
--
-- Trust model:
--   * Uploads happen ONLY through the backend service role, after the photo
--     passes geofence + forensics checks. Clients never write to the bucket
--     directly, so there is no anon/authenticated INSERT policy.
--   * Objects are publicly readable so the web/mobile badging UI can render the
--     thumbnail via photo_url. No PII is embedded in the object path.
-- ============================================================================

-- Create the bucket (id == name). public = true so photo_url resolves without
-- a signed URL. Size/type limits guard against abuse.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'report-photos',
    'report-photos',
    true,
    10485760,                                   -- 10 MB per photo
    array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Public read of objects in the report-photos bucket (civic transparency).
drop policy if exists "report photos public read" on storage.objects;
create policy "report photos public read"
    on storage.objects
    for select
    using (bucket_id = 'report-photos');

-- Intentionally NO insert/update/delete policy for anon/authenticated roles:
-- the backend service role bypasses RLS and is the only writer.
