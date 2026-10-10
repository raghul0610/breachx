# Production schema / migration-history reconciliation

Audit date: 2026-10-10
Project: BreachX (`wjxenruxeudkgqinbodv`)

## Status

**Canonical schema baseline gate remains blocked.** This note records read-only production evidence and comparison findings. No production DDL or migration-history change was performed during this audit.

## Verified live catalog

- Fourteen public base tables exist: activity_logs, admin_audit_logs, blueprint_versions, blueprints, event_config, events, judging_scores, problem_assignments, problem_statements, profiles, team_members, teams, tracks, user_roles.
- `public.projects` does not exist. The repository migration `20261010070000_create_projects.sql` is not applied in production.
- Public enums: user_role, event_status, blueprint_status, judging_status.
- All 14 public tables have RLS enabled.
- `blueprints.blueprint_submission_lock` rejects updates after submission and rejects changes to event/team/assignment ownership.
- The enabled `ensure_rls` event trigger invokes `public.rls_auto_enable()`; the function is SECURITY DEFINER with search_path set to pg_catalog. Observed EXECUTE grants are limited to postgres and service_role.
- Anonymous event-catalog SELECT policies exist for events, event_config, tracks, and active problem_statements.
- `activity_logs` is included in `supabase_realtime`.

## Remote migration history and likely Git counterparts

| Remote version | Remote name | Likely source-history counterpart |
| --- | --- | --- |
| `20261008050118` | `allow_public_event_catalog_reads` | commit `b087fa8`: “feat: expose public event catalog reads for prototype” |
| `20261008050230` | `harden_public_security_definer` | commit `e9292f5`: “fix: restrict security definer helper execution” |
| `20261008050245` | `remove_public_security_definer_execute` | commit `dec069a`: “fix: revoke public security helper execution” |

Historical versions of `001_breachx_backend_foundation.sql` were fetched at all three commits. The contents confirm the intended incremental changes: `b087fa8` adds anonymous event-catalog grants/policies; `e9292f5` adds `REVOKE EXECUTE ... FROM anon, authenticated`; and `dec069a` broadens that revoke to include `PUBLIC`. This is a strong content mapping, but does not make local migrations `001`–`003` recorded in the remote ledger.

## Local migration inventory and status

The local CLI reported these files:
- `001_breachx_backend_foundation.sql`
- `002_blueprint_persistence_hardening.sql`
- `003_activity_monitoring.sql`
- `20261010070000_create_projects.sql`

The remote ledger contains only the three timestamped versions above. It does not contain versions `001`, `002`, or `003`. The projects migration is local-only and must remain unapplied in production.

The backend branch also contains `20261010080000_harden_admin_audit_log_access.sql`, a proposed hardening migration. The user's local migration listing did not show this file at audit time, so the local checkout and GitHub branch inventory need to be synchronized and checked before any local testing or commit. The proposed hardening migration has not been applied to production.

## Schema dump validation

A direct `pg_dump` using PostgreSQL client tools succeeded locally against the Supabase Session Pooler. The resulting file is `artifacts/schema-audit/production-public-schema.sql`, 31,492 bytes. The user verified its PostgreSQL dump-complete marker. It contains 14 `public` tables, four enums, two functions, the blueprint submission-lock trigger, RLS statements and policies. This is a valid schema-only dump candidate; it has not been committed.

## Comparison findings

### Core object structure

- Live table inventory matches the 14 tables created by the legacy foundation migration.
- The four live enums match the enum definitions in `001_breachx_backend_foundation.sql`.
- The nine named secondary indexes from the foundation migration are present in the live catalog, in addition to primary-key and unique-constraint indexes.
- The live policy inventory is consistent with the intended sequence: the foundation policies and anonymous event-catalog policies, the two additional policies from `002`, and the activity read-policy replacement from `003`. Live `activity_logs` has `activity_participant_or_admin_select` and `activity_team_insert`; the old `activity_team_select` policy is absent.
- The live `blueprint_submission_lock` trigger and `enforce_blueprint_submission_lock()` function exist. Preserve their behavior.
- The live `rls_auto_enable()` function is SECURITY DEFINER with `search_path=pg_catalog`; its observed execution grants are restricted to trusted roles.

These structural matches do **not** reconcile the migration ledger: a live object matching a local migration does not prove the remote history records that local migration version as applied.

### Privilege drift and security concern

A read-only query of `information_schema.role_table_grants` returned 98 table-privilege grant rows for each of `anon`, `authenticated`, and `service_role`, across the 14 public tables. The privilege types shown for each role were DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, and UPDATE. These broad table grants are wider than the explicit anonymous SELECT grants in the foundation migration. RLS still governs row access, but grants should be deliberately reviewed rather than inferred from policies alone.

Specifically, `admin_audit_logs` has RLS enabled and no production policies. With the observed browser-role table grants, RLS currently denies row access because no policy permits it, but the table grants are unnecessarily broad. The backend branch contains `20261010080000_harden_admin_audit_log_access.sql` to revoke browser-role privileges and add an explicit deny policy. Do not apply it until the migration-history plan, local test sequence, and deployment review are complete.

### Evidence limitations

The dump was validated by the user in their local PowerShell session, but its contents are not stored in this repository and were not independently parsed line-by-line in this review. The live catalog queries independently corroborate the listed table, enum, policy, index, trigger, function, and grant findings. Before approving a canonical baseline, compare the complete dump and all definitions, including column types/defaults/nullability, constraints, function bodies, grants, extensions, event triggers, publications, and comments.

## Reconciliation decision

The live schema is now better documented, but **this is still not a canonical, replayable schema baseline**. The local migration history remains unreconciled with the remote ledger.

1. Preserve the original legacy migration files; do not rename, delete, squash, or mark them applied as a shortcut.
2. Do not run production `supabase db push`, `supabase migration repair`, or a linked reset.
3. Keep `20261010070000_create_projects.sql` out of production; live `public.projects` is absent.
4. Synchronize the local backend checkout with the reviewed backend branch and inspect the file inventory before local testing.
5. Review the full dump against the current and historical migrations, document all differences, then test the proposed migration strategy on an isolated local Supabase stack.
6. Verify Supabase Auth providers and URL configuration separately; these remain unverified.
7. Only after review and isolated testing should a separate production migration plan be approved.

No production DDL, data, or migration metadata was changed during this audit.