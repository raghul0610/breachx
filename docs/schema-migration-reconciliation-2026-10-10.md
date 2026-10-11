# Production schema and migration-history reconciliation

Audit updated: 2026-10-11  
Supabase project: BreachX (`wjxenruxeudkgqinbodv`)  
Project status observed: ACTIVE_HEALTHY; region `ap-northeast-2`; PostgreSQL `17.11.0.003`.

## Current decision

**The live catalog is now inventoried, but the canonical CLI baseline and migration provenance are not fully reconciled. Do not repair migration history or push migrations.** The inventory below comes from read-only catalog queries and is a useful comparison artifact; it is not a replacement for a reviewed `supabase db pull` result.

Only `supabase/migrations/20261010070000_create_projects.sql` was authorized for production application. It was applied on 2026-10-11 through the Supabase migration tool as `create_projects`. The remote ledger assigned version `20261011013453`. No history repair was performed. The admin-audit hardening migration remains unapplied.

## Remote migration ledger

The live ledger currently contains four entries:

- `20261008050118` — `allow_public_event_catalog_reads`
- `20261008050230` — `harden_public_security_definer`
- `20261008050245` — `remove_public_security_definer_execute`
- `20261011013453` — `create_projects` (applied after explicit authorization on 2026-10-11)

The first three rows do not match the legacy local filenames `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql`. SQL and timestamps previously examined strongly support a mapping to commits `b087fa8`, `e9292f5`, and `dec069a`, respectively, but the ledger does not store Git commit identity or SQL checksums. This mapping is **strongly supported, not proven**. The three legacy migration files have since been removed from the current `backend` branch as out of scope; their deletion did not remove the production objects they created.

The local projects migration filename version `20261010070000` also differs from the version Supabase recorded for its tool-applied execution, `20261011013453`. Record this as an intentional execution/version discrepancy; do not “correct” it by inserting, deleting, or repairing ledger rows.

## Current read-only production catalog

Direct read-only catalog query on 2026-10-11 confirmed 15 public tables, all with RLS enabled:

`activity_logs`, `admin_audit_logs`, `blueprint_versions`, `blueprints`, `event_config`, `events`, `judging_scores`, `problem_assignments`, `problem_statements`, `profiles`, `projects`, `team_members`, `teams`, `tracks`, `user_roles`.

Public enum types and values:

- `blueprint_status`: `DRAFT`, `SUBMITTED`
- `event_status`: `DRAFT`, `READY`, `LIVE`, `PAUSED`, `ENDED`
- `judging_status`: `DRAFT`, `FINAL`
- `user_role`: `PARTICIPANT`, `ADMIN`, `JUDGE`

Public functions observed:

- `enforce_blueprint_submission_lock()` — SECURITY INVOKER
- `rls_auto_enable()` — SECURITY DEFINER
- `set_projects_updated_at()` — SECURITY INVOKER

Non-internal public-table triggers observed:

- `blueprints.blueprint_submission_lock` → `enforce_blueprint_submission_lock()`
- `projects.projects_set_updated_at` → `set_projects_updated_at()`

Enabled PostgreSQL event triggers observed: `ensure_rls`, `issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch`. Extensions observed: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`. Publication `supabase_realtime` is not configured for all tables; its observed table membership is `public.activity_logs`.

The new `public.projects` table, `projects_owner_updated_at_idx` index, `set_projects_updated_at()` function and `projects_set_updated_at` trigger exist. RLS is enabled with four owner-scoped policies (SELECT/INSERT/UPDATE/DELETE). Authenticated has table CRUD privileges; anon has no CRUD privileges. The existing `blueprints.blueprint_submission_lock` trigger remains present. These facts were verified after the projects migration. The deployed app's project persistence after refresh and second-account isolation were manually tested and reported passing by the operator; these are operator-confirmed, not independently browser-tested here.

## Remaining reconciliation questions

1. **Canonical schema baseline:** still needs a CLI-generated and reviewed schema dump from the linked project. This document's catalog inventory does not include a complete normalized definition of every table, constraint, index, policy, grant, function body, and platform object.
2. **Historical migration provenance:** the first three ledger entries remain strongly mapped but not proven against exact executed SQL/checksums.
3. **Current-branch replay:** the legacy migration chain was tested historically on disposable PostgreSQL 17 with a Supabase-compatible bootstrap. That historical result is not a replay test of the current branch after the three legacy files were removed. Current CI does not prove the old chain can be reconstructed from the current branch alone.
4. **Auth settings:** the operator previously confirmed provider and redirect settings were saved and Google sign-in worked. This does not prove every Email, reset-password, and callback path.
5. **Release review:** PR #6 remains open and draft; no merge is authorized by this note.

## Safe next procedure

Run these locally from the repository root on branch `backend`, with Supabase CLI installed and authenticated:

1. Check `git status --short` and preserve unrelated/untracked artifacts; do not stage or delete them.
2. Confirm the linked project is `wjxenruxeudkgqinbodv`.
3. Use the CLI-supported `supabase db pull` workflow to generate a candidate schema/reconciliation artifact. Review the exact command behavior and generated files before accepting changes; do not overwrite existing migrations blindly.
4. Inspect `git diff` and compare the generated schema with this inventory and the four-row remote ledger. Keep the candidate dump separate from executable forward migrations until the differences are explained.
5. Save the exact CLI version, command output, generated file path, and diff summary in the PR notes.

Do **not** run `supabase db push`, `supabase migration repair`, a linked reset, or any further production DDL as part of this baseline task. Do not apply `20261010080000_harden_admin_audit_log_access.sql` without separate explicit authorization.
