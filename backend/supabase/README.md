# Supabase Provisioning — Field Report Verification

This folder holds the database schema and storage configuration for the citizen
**Field Report Verification** subsystem (Pillars 1, 2, 3, 5). The backend is the
only writer; it uses the **service role key** (`SUPABASE_SERVICE_KEY`) and
therefore bypasses Row Level Security. The RLS policies here are defense-in-depth
for any future direct-from-client access.

## Files

| File | Purpose |
| :--- | :--- |
| `migrations/0001_reports_verification.sql` | `reports` + `user_reputation` tables, indexes, RLS |
| `migrations/0002_storage_report_photos.sql` | `report-photos` Storage bucket + read policy |

## Apply (SQL Editor — simplest)

1. Open your project → **SQL Editor** → **New query**.
2. Paste the contents of `0001_reports_verification.sql`, run it.
3. Paste the contents of `0002_storage_report_photos.sql`, run it.
4. Confirm under **Table Editor** that `reports` and `user_reputation` exist, and
   under **Storage** that the `report-photos` bucket exists.

## Apply (Supabase CLI)

```bash
# From backend/ with the Supabase CLI linked to your project:
supabase db push          # if using the CLI migration workflow
# — or apply each file directly —
supabase db execute --file supabase/migrations/0001_reports_verification.sql
supabase db execute --file supabase/migrations/0002_storage_report_photos.sql
```

## Required backend environment

These must be set for the backend to read/write reports and upload photos:

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your_service_role_key"   # server-only, never exposed to clients
SUPABASE_ANON_KEY="your_anon_key"              # already used by auth
SUPABASE_REPORT_BUCKET="report-photos"         # optional override; defaults to report-photos
```

## Schema summary

`reports`
- Identity: `reporter_id` (Supabase `auth.users.id`)
- Pillar 1: `latitude`, `longitude`, `distance_meters`, `geofence_pass`
- Pillar 2: `ela_score`, `phash`, `phash_recycled`, `forensics_verdict`
- Pillar 5: `status`, `reporter_reputation`, `created_at`, `photo_url`

`user_reputation`
- `user_id`, `score`, `reports_total`, `reports_flagged`, `updated_at`
