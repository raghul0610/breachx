# Production schema / migration-history reconciliation

Audit date: 2026-10-10
Project: BreachX (`wjxenruxeudkgqinbodv`)

## Status

**Canonical schema baseline gate remains blocked.** This note is catalog-derived evidence, not a complete Supabase CLI/pg_dump schema baseline. No production DDL or migration-history change was performed during this audit.

## Verified live catalog

- Fourteen public base tables exist: activity_logs, admin_audit_logs, blueprint_versions, blueprints, event_config, events, judging_scores, problem_assignments, problem_statements, profiles, team_members, teams, tracks, user_roles.
- `public.projects` does not exist. The repository migration `20261010070000_create_projects.sql` is not applied in production.
- Public enums: user_role, event_status, blueprint_status, judging_status.
- All 14 public tables have RLS enabled.
- `blueprints.blueprint_submission_lock` rejects updates after submission and rejects changes to event/team/assignment ownership.
- The enabled `ensure_rls` event trigger invokes `public.rls_auto_enable()`; the function is SECURITY DEFINER with search_path set to pg_catalog. Observed EXECUTE grants are limited to postgres and service_role.
- Anonymous event-catalog SELECT policies exist for events, event_config, tracks, and active problem_statements.

## Remote migration history and likely Git counterparts

| Remote version | Remote name | Likely source-history counterpart |
| --- | --- | --- |
| `20261008050118` | `allow_public_event_catalog_reads` | commit `b087fa8`: “feat: expose public event catalog reads for prototype” |
| `20261008050230` | `harden_public_security_definer` | commit `e9292f5`: “fix: restrict security definer helper execution” |
| `20261008050245` | `remove_public_security_definer_execute` | commit `dec069a`: “fix: revoke public security helper execution” |

Historical versions of `001_breachx_backend_foundation.sql` were fetched at all three commits. The contents confirm the intended incremental changes: `b087fa8` adds the anonymous event-catalog grants/policies; `e9292f5` adds `REVOKE EXECUTE ... FROM anon, authenticated`; and `dec069a` broadens that revoke to include `PUBLIC`. The subjects and exact SQL changes align with the three remote migration names. This establishes a strong content mapping, but the Supabase migration ledger itself still does not contain the legacy local migrations `001`–`003`, and the precise SQL stored/applied for each remote version has not been independently extracted from the ledger.

Other tracked migrations are `002_blueprint_persistence_hardening.sql` (commit `db5eefd`), `003_activity_monitoring.sql` (commit `2ad3b97`), and `20261010070000_create_projects.sql` (commit `805df8b`).

The CLI showed local versions 001, 002, 003, and 20261010070000, while remote history has only the three timestamped entries. The first three remote entries likely reflect incremental edits folded into the current legacy `001` file. This explains part of the mismatch but does not fully reconcile the ledger or the status of migrations 002 and 003.

## Dump attempt and limitation

The owner's Windows CLI command `npx supabase db dump --linked --schema public` failed because Docker/Podman is unavailable. The generated `artifacts/schema-audit/production-public-schema.sql` is zero bytes and is not a valid dump. Neither `psql` nor `pg_dump` is on PATH. Catalog inspection is useful evidence but not a substitute for a complete schema dump.

## Required before Gate 1 can pass

1. Obtain a complete schema dump using Supabase CLI with Docker/Podman, or PostgreSQL client tools with a safe direct connection; verify the output is non-empty and review it.
2. Compare the dump against current `001`–`003` and the historical versions of `001` at commits `b087fa8`, `e9292f5`, and `dec069a`.
3. Document a reviewed baseline plan that does not falsely mark unapplied migrations as applied.
4. Test the complete migration sequence on an isolated local Supabase stack before production deployment.
5. Keep the projects migration out of production until baseline reconciliation and local tests pass.

Do not run production DDL, `supabase db push`, `supabase migration repair`, or a linked reset as a shortcut. This note authorizes no production changes.
