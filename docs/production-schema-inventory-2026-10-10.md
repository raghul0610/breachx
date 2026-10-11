# Production schema inventory (read-only)

Capture time: 2026-10-10 05:04 UTC  
Supabase project: `BreachX` (`wjxenruxeudkgqinbodv`)  
Database: PostgreSQL 17.11.0.003; region `ap-northeast-2`  
Capture method: read-only catalog SQL through the Supabase project connector.

## Important scope

This is a catalog-derived inventory of the live database, **not** a canonical `supabase db pull` dump and not a migration baseline to apply. It records actual live objects as evidence for reconciliation. A local CLI-generated schema dump is still required before deciding how to baseline migrations.

## Confirmed migration history

- `20261008050118` — `allow_public_event_catalog_reads`
- `20261008050230` — `harden_public_security_definer`
- `20261008050245` — `remove_public_security_definer_execute`

The local repository contains `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, `003_activity_monitoring.sql`, and the additive `20261010070000_create_projects.sql`. The remote migration history does not explain how the legacy files relate to the live schema. Do not run `supabase db push`, `supabase migration repair`, or a linked reset to force alignment.

## Live public tables

All 14 tables below have row-level security enabled. The live schema does not contain `public.projects`.

| Table | Purpose inferred from names/columns | Current RLS policy count |
|---|---|---:|
| `activity_logs` | Event/team activity trail | 2 |
| `admin_audit_logs` | Administrative audit trail | 0 |
| `blueprint_versions` | Historical blueprint versions | 2 |
| `blueprints` | Existing hackathon submissions | 3 |
| `event_config` | Event submission settings | 2 |
| `events` | Event catalog | 2 |
| `judging_scores` | Judge scores | 3 |
| `problem_assignments` | Team problem assignments | 1 |
| `problem_statements` | Problem statement catalog | 2 |
| `profiles` | User profile data | 2 |
| `team_members` | User-to-team membership | 1 |
| `teams` | Event teams | 1 |
| `tracks` | Event tracks | 2 |
| `user_roles` | Participant/admin/judge roles | 1 |

The catalog contains these public enums:

- `blueprint_status`: `DRAFT`, `SUBMITTED`
- `event_status`: `DRAFT`, `READY`, `LIVE`, `PAUSED`, `ENDED`
- `judging_status`: `DRAFT`, `FINAL`
- `user_role`: `PARTICIPANT`, `ADMIN`, `JUDGE`

The live `public.blueprints` table has a `blueprint_submission_lock` trigger. Its function rejects updates after submission and rejects changes to event/team/assignment ownership fields. Preserve this legacy behavior while introducing standalone ANCHON projects.

## Advisor findings captured at audit time

### Security

Supabase's security advisor reported `public.admin_audit_logs` as RLS-enabled with no policies. A follow-up read-only privilege check found that `anon` and `authenticated` nevertheless had SELECT, INSERT, UPDATE, and DELETE table privileges. RLS with no policies already denies ordinary row access, but the grants are unnecessarily broad and make the security posture harder to reason about.

A proposed migration, `20261010080000_harden_admin_audit_log_access.sql`, now revokes table privileges from PUBLIC, anon, and authenticated and adds an explicit deny-all RLS policy for browser roles. A regression test verifies the grants and policy. This hardening is committed on `backend` but has **not** been applied to production; apply it only after the migration-history baseline is reconciled and the reviewed deployment is approved. Trusted server access via service_role remains separate and must never expose that key to the browser.

### Performance

The advisor reported 10 foreign keys without covering indexes and 7 indexes not used in observed query statistics. These are informational findings, not automatic remediation instructions. Review actual query plans, expected table growth, and write costs before changing indexes.

## Auth configuration status

The Supabase project metadata API confirms project identity and database health but does not expose the Authentication provider settings or URL Configuration. Provider settings therefore remain **unverified**; see `docs/auth-configuration-review.md`. The `auth.users` row count is not proof that Email or Google sign-in is enabled.

## Next steps before production migration

1. Use the Supabase CLI locally to link the project and capture a canonical schema with `supabase db pull`; inspect the generated diff and any history prompt before accepting it.
2. Reconcile every legacy migration against the canonical schema and the remote migration list. Preserve the old SQL files until an explicit baseline plan is reviewed.
3. Run the full migration sequence and projects/RLS tests against a local Supabase stack or an explicitly approved disposable database.
4. Verify Email/Google providers, Site URL, allowed redirect URLs, confirmation/reset flows in the Dashboard.
5. Only then review and approve a separate production migration plan.

No production DDL, migration metadata, or data was changed during this capture.
