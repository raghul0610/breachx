# ANCHON backend: production baseline and migration reconciliation

Capture date: 2026-10-10 UTC  
Supabase project: `BreachX` / `wjxenruxeudkgqinbodv`  
Observed status: `ACTIVE_HEALTHY`; region `ap-northeast-2`; PostgreSQL `17.11.0.003`.

## Safety status

The inspection that informed this document was read-only. No production DDL or data was changed. The new projects migration is intended to be tested locally first and must not be applied to production until the gates below pass.

This document is a catalog-derived inventory, **not** a canonical `supabase db pull`/schema dump. Generate and review that baseline locally before any production deployment.

## Migration-history reconciliation

The remote migration history returned these entries:

- `20261008050118` — `allow_public_event_catalog_reads`
- `20261008050230` — `harden_public_security_definer`
- `20261008050245` — `remove_public_security_definer_execute`

The historical repository state included `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql`. These three hackathon-specific files have since been removed from the `backend` branch because they are outside the current standalone application's scope. Their deletion is not a database migration: the production tables and objects listed in this document were not dropped or altered, and the remote migration ledger was not repaired.

The remote filenames/versions still do not match the historical local filenames. Migration 002's prior statement that it was applied to production is not matched by a corresponding remote ledger version. This establishes migration-history drift, but does not prove how it occurred.

**Do not** run `supabase migration repair`, `supabase db push`, or manually insert migration-history rows until the live schema has been captured and each migration reconciled against the actual objects.

## Current public schema inventory

All 14 observed public tables have RLS enabled:

| Table | Columns | Policies | Notes |
|---|---:|---:|---|
| `activity_logs` | 7 | 2 | Activity trail |
| `admin_audit_logs` | 9 | 0 | RLS enabled; verify intended trusted-server access |
| `blueprint_versions` | 10 | 2 | Version history |
| `blueprints` | 12 | 3 | Legacy hackathon submissions; submission-lock trigger exists |
| `event_config` | 6 | 2 | Event submission settings |
| `events` | 7 | 2 | Public catalog read policies |
| `judging_scores` | 14 | 3 | Judge scoring |
| `problem_assignments` | 6 | 1 | Team assignment |
| `problem_statements` | 7 | 2 | Active problem catalog |
| `profiles` | 4 | 2 | References Auth users |
| `team_members` | 3 | 1 | Team membership |
| `teams` | 4 | 1 | Event teams |
| `tracks` | 6 | 2 | Event tracks |
| `user_roles` | 3 | 1 | PARTICIPANT/ADMIN/JUDGE |

No `public.projects` table existed at capture time.

Observed public enums:
- `blueprint_status`: `DRAFT`, `SUBMITTED`
- `event_status`: `DRAFT`, `READY`, `LIVE`, `PAUSED`, `ENDED`
- `judging_status`: `DRAFT`, `FINAL`
- `user_role`: `PARTICIPANT`, `ADMIN`, `JUDGE`

Observed public functions:
- `enforce_blueprint_submission_lock()` — not SECURITY DEFINER
- `rls_auto_enable()` — SECURITY DEFINER

Observed row counts: `auth.users` 0, `profiles` 0, `events` 1, `tracks` 3, `problem_statements` 3, `teams` 0, `blueprints` 0, `blueprint_versions` 0, `activity_logs` 0, `admin_audit_logs` 0.

## Canonical baseline procedure

Run from the repository root after installing the Supabase CLI and Docker, and make sure you are on branch `backend`:

1. `supabase login`
2. `supabase link --project-ref wjxenruxeudkgqinbodv`
3. Review the linked project before executing any database command.
4. Capture the live schema using the CLI's supported pull workflow, e.g. `supabase db pull`. Read the generated migration and inspect `git diff`; do not overwrite or delete the existing migration files.
5. Compare the generated SQL with the remote migration history and live catalog. Explain each difference before considering a repair.

Because the remote history and repository history differ, treat the first `db pull` output as a reconciliation artifact for review—not permission to push it back to production.

## Authentication configuration review

Repository review found:
- `src/lib/supabase.ts` initializes the client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/lib/db.ts` calls `supabase.auth.getUser()` and uses it as a guard for some hackathon data access.
- No complete sign-in/sign-up UI, Google OAuth flow, or auth-state subscription was found in the inspected files.
- `auth.users` had zero rows at capture time.

The available project connector did not expose provider settings. Verify manually in Supabase Dashboard > Authentication:
- Email provider enabled and email confirmation behavior.
- Google provider enabled and Google OAuth client ID/secret configured.
- Site URL and allowed redirect URLs for local development and production.
- Password/reset and callback flows.
- Do not expose service-role keys or Google OAuth client secrets in Vite/browser environment variables. Only the publishable/anon key belongs in the browser.

## New projects table design

Migration `20261010070000_create_projects.sql` is additive:
- New `public.projects` table references `auth.users(id)` through `owner_id`.
- Graph `nodes` and `edges` are JSONB arrays; optional `workload` and `viewport` are JSONB objects.
- Valid status is `draft` or `submitted`; application name must be non-empty.
- RLS grants authenticated users owner-only SELECT/INSERT/UPDATE/DELETE.
- UPDATE checks both the existing row and the resulting owner, preventing ownership transfer.
- `updated_at` is maintained by a trigger.
- No anon policy exists.
- Submitted projects remain editable by their owner.
- The projects migration does not modify the existing production hackathon `blueprints` table or `blueprint_submission_lock`. Those live objects remain in the production inventory; retiring them is a separate database decision.

## Local testing gates

Use a disposable local Supabase database. Do not test by inserting rows into production.

1. Start local services: `supabase start`.
2. Apply migrations to the local database: `supabase db reset` (only in the local environment; this rebuilds the local database).
3. Run the catalog assertions in `supabase/tests/projects_migration_assertions.sql`.
4. Add two local Auth users and test RLS:
   - User A can create/read/update/delete A's project.
   - User B cannot read/update/delete A's project.
   - A cannot insert a row owned by B or transfer ownership to B.
   - Anonymous requests cannot read or mutate projects.
   - Invalid status and invalid JSON shapes are rejected.
   - A submitted project remains editable and its `updated_at` changes.
   - Do not include hackathon blueprint behavior in the standalone projects CI suite; the production object remains untouched by this migration.
5. Inspect the local schema diff and ensure only intended project objects were added.
6. Run the repository's build/typecheck/test scripts and review all diffs.
7. Only after local checks pass and migration drift is explained, plan a separate production deployment.

## Current status

- [x] Read-only production catalog inspection
- [x] Remote vs local migration-history discrepancy documented
- [x] Auth code path inspected
- [x] Additive project migration authored
- [x] Schema assertion test authored
- [ ] Canonical CLI baseline generated and reviewed locally
- [ ] Dashboard Auth provider settings verified
- [ ] Migration executed and tested on disposable/local Supabase
- [ ] Two-user RLS tests passed
- [ ] Production deployment approved and performed (not done)
