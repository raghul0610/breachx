# ANCHON backend: production baseline and migration reconciliation

Capture updated: 2026-10-11  
Supabase project: `BreachX` / `wjxenruxeudkgqinbodv`  
Observed status: `ACTIVE_HEALTHY`; region `ap-northeast-2`; PostgreSQL `17.11.0.003`.

## Safety status

Only `supabase/migrations/20261010070000_create_projects.sql` was applied to production, after explicit operator authorization on 2026-10-11. Supabase recorded it as `20261011013453` / `create_projects`. Postflight catalog verification is complete. The admin-audit hardening migration remains unapplied. No migration-history repair, production reset, or `supabase db push` was performed.

This document is a catalog-derived inventory, **not** a canonical CLI schema dump. The CLI-generated baseline remains outstanding and must be reviewed before any further production deployment.

## Current production inventory

All 15 observed public tables have RLS enabled:

| Table | Notes |
|---|---|
| `activity_logs` | In `supabase_realtime` publication |
| `admin_audit_logs` | RLS enabled; no client policy; hardening migration not applied |
| `blueprint_versions` | Legacy hackathon version history |
| `blueprints` | Legacy hackathon submissions; submission-lock trigger remains |
| `event_config` | Legacy event settings |
| `events` | Public catalog policies |
| `judging_scores` | Legacy judging data |
| `problem_assignments` | Legacy team/problem assignments |
| `problem_statements` | Legacy problem catalog |
| `profiles` | References Auth users |
| `projects` | Standalone owner-scoped persistence; created by approved migration |
| `team_members` | Legacy membership |
| `teams` | Legacy teams |
| `tracks` | Legacy tracks |
| `user_roles` | PARTICIPANT/ADMIN/JUDGE |

Observed public enums:
- `blueprint_status`: `DRAFT`, `SUBMITTED`
- `event_status`: `DRAFT`, `READY`, `LIVE`, `PAUSED`, `ENDED`
- `judging_status`: `DRAFT`, `FINAL`
- `user_role`: `PARTICIPANT`, `ADMIN`, `JUDGE`

Observed public functions:
- `enforce_blueprint_submission_lock()` — SECURITY INVOKER
- `rls_auto_enable()` — SECURITY DEFINER
- `set_projects_updated_at()` — SECURITY INVOKER

Observed non-internal table triggers:
- `blueprints.blueprint_submission_lock` → `enforce_blueprint_submission_lock()`
- `projects.projects_set_updated_at` → `set_projects_updated_at()`

Enabled event triggers observed: `ensure_rls`, `issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch`.

Extensions observed: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`.

Publication `supabase_realtime` is not configured for all tables; the observed membership is `public.activity_logs`.

## Projects migration: postflight

Verified by read-only catalog queries after the approved migration:
- `public.projects`, `projects_owner_updated_at_idx`, `public.set_projects_updated_at()`, and `projects_set_updated_at` trigger exist.
- RLS is enabled and four owner-scoped policies exist for SELECT, INSERT, UPDATE, and DELETE.
- Authenticated has SELECT/INSERT/UPDATE/DELETE table privileges; anon has none of those table privileges.
- Existing `blueprints.blueprint_submission_lock` trigger remains present.
- The live migration ledger contains the three earlier entries plus `20261011013453` / `create_projects`; no history repair occurred.

Operator-reported deployed smoke tests passed: project persistence survived refresh, and a second account could not access the first account's private projects. These are user-confirmed browser results, not independently executed by this audit. The operator had also confirmed the deployed Google sign-in flow worked.

## Migration-history reconciliation

The remote ledger entries `20261008050118`, `20261008050230`, and `20261008050245` do not match the old local migration filenames. Previous SQL/timestamp comparison strongly supports mappings to commits `b087fa8`, `e9292f5`, and `dec069a`, but does not prove the exact SQL executed in production. The old `001`–`003` migration files were removed from the current `backend` branch as out of scope; this repository deletion did not drop production objects.

The local project migration filename version `20261010070000` differs from the Supabase-generated ledger version `20261011013453` because it was applied through the Supabase migration tool under the name `create_projects`. Preserve both facts; do not repair the ledger to force the filenames to match.

See [schema migration reconciliation](schema-migration-reconciliation-2026-10-10.md) for the detailed ledger and catalog findings.

## Canonical baseline procedure

The next task is still to generate and review the canonical schema baseline locally. The connected database tools can inspect catalog metadata, but that is not a substitute for the CLI-generated dump.

From the repository root, on branch `backend`:

1. Preserve all unrelated/untracked artifacts; do not delete or stage them as part of this task.
2. Check the installed Supabase CLI version and confirm the linked project is `wjxenruxeudkgqinbodv`.
3. Authenticate with `supabase login` if required, then use the supported `supabase db pull` workflow to produce a candidate schema/reconciliation artifact.
4. Review command output and `git diff` before accepting or moving generated files. Do not overwrite existing migrations blindly.
5. Compare the dump against the live inventory and four-row remote ledger. Document differences and exact CLI version/output before deciding how to represent the baseline in Git.

Do not run `supabase db push`, `supabase migration repair`, a linked reset, or further production DDL during this task. Do not apply `20261010080000_harden_admin_audit_log_access.sql` without separate explicit authorization.

## Status

- [x] Read-only production catalog inventory refreshed after projects migration
- [x] Remote migration ledger captured with four rows
- [x] Project table/RLS/grants/index/function/trigger postflight verified
- [x] Operator-reported deployed persistence and two-account isolation tests recorded
- [x] Migration-history discrepancy documented without repairing history
- [ ] Canonical CLI schema baseline generated and reviewed locally
- [ ] Exact provenance of the first three remote migration entries proven by execution records/checksums
- [ ] Current-branch migration replay and normalized schema diff completed
- [ ] Final PR #6 review and release decision completed
