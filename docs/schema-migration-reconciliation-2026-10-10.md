# Production schema / migration-history reconciliation

Audit date: 2026-10-10
Project: BreachX (`wjxenruxeudkgqinbodv`)

## Status

**Canonical schema baseline gate remains blocked.** This note records read-only production evidence and comparison findings. No production DDL or migration-history change was performed during this audit.

## Production-evidence status

The production SQL Editor supplied the authoritative three-row migration ledger on 2026-10-10. The local Supabase CLI is unavailable, so no additional live metadata query was run from this workspace. The ledger facts are verified from the operator-provided SQL Editor result; all other live facts below retain their prior evidence status.

## Historical local replay evidence (2026-10-10; not the current branch chain)

The actual replay blocker is not a schema mismatch in the repo itself; it is the missing Supabase-managed runtime objects that the legacy migration chain assumes exist.

Verified on a disposable local PostgreSQL 17 database:

- `psql ... -f supabase/migrations/001_breachx_backend_foundation.sql` against an empty database fails with `ERROR: schema "auth" does not exist`.
- After local bootstrap of `auth.users`, `auth.uid()`, `public.rls_auto_enable()`, the `ensure_rls` event trigger, and the `supabase_realtime` publication, the legacy migration chain proceeds successfully.
- `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql` replay cleanly on the disposable database.
- `20261010070000_create_projects.sql` and `20261010080000_harden_admin_audit_log_access.sql` also replay and pass their local regression assertions on the same disposable database.
- This confirms the migration files are not standalone vanilla-PostgreSQL migrations; they are designed to run in a Supabase environment that provides the `auth` schema, the `auth.uid()` function, and the Supabase-managed event/publication setup.

The production schema dump therefore remains evidence, not a canonical replay baseline. The live platform-specific objects and production Auth configuration still need independent dashboard verification before the production baseline gate can pass.

## Release-readiness status (2026-10-10)

| Area                                                                               | Status                         | Evidence                                                                                                                                                                                                                                              | Exact next action                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Historical disposable replay of legacy migrations                                 | HISTORICAL — NOT CURRENT CI    | Verified on PostgreSQL 17 before the three hackathon-only migration files and blueprint test fixtures were removed from `backend`.                                                                                                                    | Do not treat this as current-branch validation; current CI covers the retained migrations only.           |
| Repo tests and build                                                               | PASSED                         | `npm test` passed (15/15) and `npm run build` completed successfully.                                                                                                                                                                                 | Treat this as necessary but not sufficient for production approval.                                       |
| Production schema dump / catalog evidence                                          | PASSED (read-only evidence)    | The live catalog and dump agree on the 14 legacy tables, enums, RLS settings, and blueprint lock trigger.                                                                                                                                             | Use this evidence to compare against future canonical dump output; do not treat it as the final baseline. |
| Production migration-history ledger rows                                           | PASSED (operator evidence)     | The SQL Editor returned the three authoritative rows `20261008050118`, `20261008050230`, and `20261008050245`.                                                                                                                                        | Preserve the ledger and do not repair or rewrite history.                                                 |
| Production ledger rows mapped to Git/local SQL                                     | STRONGLY SUPPORTED, NOT PROVEN | Commit SQL and UTC timestamps align with the three row names, but the ledger does not expose Git commit identity and no timestamped files exist in Git.                                                                                               | Obtain executed SQL/deployment records or a canonical checksum before calling provenance proven.          |
| Production ACLs / default privileges                                               | RECONCILED                     | Live DB grants `anon` and `authenticated` seven table privileges across 14 tables (98 rows each); broad schema defaults apply to future tables. RLS is enabled on all tables. `create_projects.sql` explicitly neutralizes defaults via `REVOKE ALL`. | Enforce explicit `REVOKE ALL` defense-in-depth on new migrations; keep existing table hardening separate. |
| Event trigger / publication / extension inventory                                  | UNVERIFIED                     | The dump omitted these objects, and no live session is available here to query them directly.                                                                                                                                                         | Query `pg_event_trigger`, `pg_publication`, `pg_publication_tables`, and `pg_extension` from the live DB. |
| Auth provider and redirect configuration                                           | UNVERIFIED                     | The repo does not contain live dashboard values; the auth settings are not in the repo.                                                                                                                                                               | Require the Supabase Dashboard review for Email, Google, Site URL, and callback redirects.                |
| Production deployment and Vercel smoke test                                        | UNVERIFIED                     | No authenticated Vercel or production session was available for browser smoke testing.                                                                                                                                                                | Require repository-owner execution to complete the live production flow.                                  |
| `public.projects` remains absent in production                                     | PASSED (read-only evidence)    | The live catalog and dump both show no `public.projects` table.                                                                                                                                                                                       | Leave the feature migration unapplied in production until its release gate clears.                        |
| `20261010080000_harden_admin_audit_log_access.sql` remains unapplied in production | PASSED (read-only evidence)    | The live dump does not contain the deny policy or revoke statements.                                                                                                                                                                                  | Keep the proposed hardening migration in a separate review path.                                          |

## Projects migration approval review

**Decision: GO for `20261010070000_create_projects.sql`. (NO-GO for bundling `20261010080000_harden_admin_audit_log_access.sql`).**

The projects migration is additive relative to the documented production schema: it creates the currently absent `public.projects` table, one index, four owner-scoped policies, one new timestamp function/trigger, and comments. It does not modify the fourteen existing public tables, the legacy `blueprints` submission-lock trigger, or migration history. The migration-level preconditions requiring confirmation are the Supabase `auth.users` table, `auth.uid()`, and `gen_random_uuid()` supplied by `pgcrypto`.

The migration explicitly defends against broad Supabase default privileges:

- `revoke all on table public.projects from anon, authenticated;`
- `grant select, insert, update, delete on table public.projects to authenticated;`
- `revoke all on function public.set_projects_updated_at() from public, anon, authenticated;`

The historical expanded assertions verified projects schema/RLS/ACL behavior and, at that time, also checked legacy blueprint locking. The blueprint-specific fixture and assertions have since been removed from the current standalone application's CI scope. The previous pass result applies to the pre-cleanup test suite only; current CI must rerun after cleanup.

The proposed `20261010080000_harden_admin_audit_log_access.sql` remains a separate, unapplied hardening change. It revokes privileges and adds a deny policy on an existing table; it must not be bundled into approval of the additive projects migration.

### Deployment sequence and verification

1. Execute read-only production preflight (`to_regclass('public.projects') is null`, `auth.users`/`auth.uid()` present, `pgcrypto` available).
2. Apply `20261010070000_create_projects.sql`.
3. Reload PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`).
4. Execute SQL catalog verification and the application smoke test (User A project persistence and User B isolation). Legacy hackathon flow is outside this standalone application's release scope.

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

| Remote version   | Remote name                              | Git commit with matching SQL change        | Evidence and status                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261008050118` | `allow_public_event_catalog_reads`       | `b087fa8f9444c75a85382989a4d04889502c428a` | Commit `b087fa8` adds four `GRANT SELECT ... TO anon` statements and four anonymous event-catalog policies to `supabase/migrations/001_breachx_backend_foundation.sql`. **Proven content correspondence; ledger-to-commit identity remains unproven.** |
| `20261008050230` | `harden_public_security_definer`         | `e9292f5458ab6ee2abbc38cdb31749f4a928c525` | Commit `e9292f5` adds `REVOKE EXECUTE ... FROM anon, authenticated` for `public.rls_auto_enable()` in `supabase/migrations/001_breachx_backend_foundation.sql`. **Proven content correspondence; ledger-to-commit identity remains unproven.**         |
| `20261008050245` | `remove_public_security_definer_execute` | `dec069a26c220bfe86b9b48c8a5fcdbe78a09d12` | Commit `dec069a` changes that revoke to include `PUBLIC`. **Proven content correspondence; ledger-to-commit identity remains unproven.**                                                                                                               |

The commit timestamps also closely align with the ledger versions: `b087fa8` committed at `2026-10-08 05:01:22Z`, `e9292f5` at `05:02:32Z`, and `dec069a` at `05:02:53Z`; the supplied ledger versions are `05:01:18Z`, `05:02:30Z`, and `05:02:45Z`. This supports, but does not prove, that the commits were the source changes represented by the remote entries. No timestamped migration files with these three names appear in Git.

Historical versions of `001_breachx_backend_foundation.sql` were inspected at all three commits. The contents confirm the incremental changes above, but do not make local migrations `001`–`003` recorded in the remote ledger.

## Legacy migration provenance and unexplained live effects

| Local file                                                    | Creation commit                                                                               | Live effects explained by the file                                                                                                                                                                                                                                           | Remaining discrepancy                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/001_breachx_backend_foundation.sql`      | `28837c39af6d2516e33c2167a8ee96a671b7efb6` (`feat: add 001_breachx_backend_foundation.sql`)   | The fourteen legacy tables, four enums, constraints, indexes, base RLS policies, `pgcrypto` dependency, anonymous event-catalog grants/policies, and the final `PUBLIC`/`anon`/`authenticated` revoke text are present in the file and substantially match catalog evidence. | The file does not create `public.rls_auto_enable()` or the `ensure_rls` event trigger; those production objects are not explained by this repository file and remain attributable only to Supabase-managed/bootstrap or other external SQL until their provenance is captured. The file's ACL statements also do not explain the broad production grants previously observed across all roles. |
| `supabase/migrations/002_blueprint_persistence_hardening.sql` | `db5eefd870378e325617f8d1bfaea74195b5d32d` (`chore: add blueprint persistence hardening`)     | `blueprint_versions_team_insert`, `activity_team_insert`, `enforce_blueprint_submission_lock()`, and the `blueprint_submission_lock` trigger match the documented live blueprint-lock and policy effects.                                                                    | The remote ledger does not contain version `002`; the production catalog match proves object-state correspondence, not that this local filename/version was recorded or applied as such.                                                                                                                                                                                                       |
| `supabase/migrations/003_activity_monitoring.sql`             | `2ad3b973e1b5f5ebbeb2a2d04b37f31791f52011` (`feat: add secure activity monitoring migration`) | Replacement of `activity_team_select` with `activity_participant_or_admin_select`, plus the intended `supabase_realtime` addition for `activity_logs`, matches documented catalog evidence where observable.                                                                 | The remote ledger does not contain version `003`; publication membership was not present in the dump and requires a live catalog query, so the realtime change is not independently proven from the supplied dump.                                                                                                                                                                             |

The observed `rls_auto_enable()` function and enabled `ensure_rls` event trigger remain unexplained by the three local migration files; their Supabase-managed/external provenance is still a hypothesis. The reported 98 grant rows per browser role and broad public-schema defaults are now reconciled at the stated scope as standard Supabase/PostgREST access prerequisites guarded by RLS. This is a least-privilege/defense-in-depth concern, not a demonstrated data-access vulnerability; the projects migration explicitly revokes inherited table/function access for the new object.

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

### Privilege drift and resolution

A read-only query of `information_schema.role_table_grants` returned 98 table-privilege grant rows for each of `anon`, `authenticated`, and `service_role`, across the 14 public tables (7 privilege types: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, and UPDATE). Furthermore, `pg_default_acl` applies broad default privileges to future tables created in schema `public`.

**Resolution:**

1. **Architectural context:** This is the standard Supabase posture where PostgREST relies on schema-level table privileges and enforces boundaries exclusively via Row Level Security (`ENABLE ROW LEVEL SECURITY`).
2. **Access control safety:** Because all 14 legacy tables have RLS enabled, table grants alone do not permit unauthorized data access; without an applicable permissive policy, no rows are returned.
3. **Defense-in-depth on new objects:** Rather than relying on schema defaults, `20261010070000_create_projects.sql` explicitly revokes all privileges from `anon` and `authenticated`, granting only CRUD to `authenticated` and enforcing owner-only isolation via 4 RLS policies.
4. **Legacy table hardening:** Dedicated hardening for existing tables (such as `20261010080000_harden_admin_audit_log_access.sql` for `admin_audit_logs`) is kept unbundled from the projects rollout.

### Evidence limitations

The dump was validated by the user in their local PowerShell session, but its contents are not stored in this repository and were not independently parsed line-by-line in this review. The live catalog queries independently corroborate the listed table, enum, policy, index, trigger, function, and grant findings. Before approving a canonical baseline, compare the complete dump and all definitions, including column types/defaults/nullability, constraints, function bodies, grants, extensions, event triggers, publications, and comments.

## Additional live ACL, event-trigger, publication, and extension audit (read-only)

A follow-up read-only query completed after reviewing the uploaded dump:

- `anon`, `authenticated`, and `service_role` each have 98 table-grant rows across all 14 public tables, covering DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, and UPDATE.
- `pg_default_acl` has defaults for the `public` schema owned by both `postgres` and `supabase_admin` that grant table/function/sequence privileges to browser roles (`anon` and `authenticated`) and `service_role`. This explains why a schema-only dump without ACLs cannot represent effective privilege posture. Review defaults separately from existing table grants; do not change them during this reconciliation pass.
- Five extensions are installed: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, and `uuid-ossp 1.1`.
- Seven enabled event triggers were observed: `ensure_rls`, `issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, and `pgrst_drop_watch`. The five `issue_*` / PostgREST event triggers are platform-managed; don't attempt to recreate them in the application baseline. `ensure_rls` invokes `public.rls_auto_enable()`, which remains SECURITY DEFINER with `search_path=pg_catalog`.
- The `supabase_realtime` publication contains `public.activity_logs`.

These facts improve production-side coverage, but they do not reconcile the remote migration ledger. The production catalog was queried read-only; no schema, grants, default privileges, or migration history were modified. The legacy migration files described in the historical comparison below have since been removed from the `backend` branch as hackathon-only; this does not remove their corresponding live database objects.

## Reconciliation decision

The live schema is better documented, but **this is still not a canonical, replayable schema baseline**. The local migration history remains unreconciled with the remote ledger, and event-trigger/publication provenance remains incomplete.

1. Preserve the original legacy migration files; do not rename, delete, squash, or mark them applied as a shortcut.
2. Do not run production `supabase db push`, `supabase migration repair`, or a linked reset.
3. Keep `20261010070000_create_projects.sql` out of production; live `public.projects` is absent.
4. Synchronize the local backend checkout with the reviewed backend branch and inspect the file inventory before local testing.
5. Review the full dump against the current and historical migrations, document all differences, then test the proposed migration strategy on an isolated local Supabase stack.
6. Verify Supabase Auth providers and URL configuration separately; these remain unverified.
7. Only after review and isolated testing should a separate production migration plan be approved.

No production DDL, data, or migration metadata was changed during this audit.

## Full dump comparison addendum (uploaded dump reviewed)

The user supplied the complete 2,142-line PostgreSQL 17.11 dump (31,492 bytes in the local repository; uploaded representation 32,919 bytes after formatting). The dump was inspected against migrations 001–003 and the two timestamped migrations in this branch. This is a textual/structural comparison, not a restore test.

### Objects positively represented in the dump

- Four enum types and all fourteen legacy public tables.
- Two functions: `enforce_blueprint_submission_lock()` and `rls_auto_enable()`.
- The `blueprint_submission_lock` table trigger.
- Nine named secondary indexes from migration 001.
- Primary keys, unique constraints, check constraints, and foreign keys for the legacy tables.
- RLS enabled statements and the current policies, including `activity_participant_or_admin_select`, `activity_team_insert`, the two `blueprint_versions` policies, and anonymous event-catalog policies.
- No `public.projects` table, consistent with the production catalog inspection and the decision to keep migration `20261010070000_create_projects.sql` unapplied.

### Confirmed differences / coverage gaps

1. **The dump does not contain any GRANT, REVOKE, or ALTER DEFAULT PRIVILEGES statements.** Therefore it cannot validate production ACLs or explain the 98-grant-row-per-role finding. The dump may have been created with ACLs excluded; the invocation/options were not included in the file, so the exact cause is unknown. Capture a separate ACL report or regenerate a dump with privileges included before declaring the baseline complete.
2. **The dump does not include the live `ensure_rls` event trigger**, although read-only catalog inspection previously found it enabled and linked to `rls_auto_enable()`. The dump contains the function but no `CREATE EVENT TRIGGER` statement. Treat this as a dump-coverage gap until a full database-level export or dedicated catalog query documents event triggers. Do not infer the trigger is absent in production.
3. **The dump contains no publication membership statement** for `supabase_realtime`. Catalog inspection found `activity_logs` in that publication. Capture publication and publication-table membership separately; do not infer that realtime membership is absent.
4. **No CREATE EXTENSION statement appears.** This dump cannot establish extension inventory or ownership. Capture `pg_extension` separately.
5. The dump contains only the two public functions and one table trigger listed above. This matches the observed public function/table-trigger inventory, but does not by itself capture event-trigger inventory or function ACLs.
6. The dump includes the legacy schema objects, but it cannot establish the remote migration ledger or which exact historical SQL was executed. The remote history mismatch remains unresolved.
7. The proposed audit hardening migration `20261010080000_harden_admin_audit_log_access.sql` has not been applied: its deny policy and explicit browser-role revoke are not in the dump. This is expected and must remain a separately tested forward migration.
8. `20261010070000_create_projects.sql` is also absent from the dump, as expected for the current production schema.

### Newly confirmed clean-replay blocker

The historical `001_breachx_backend_foundation.sql` ended with `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()`, but did not define `public.rls_auto_enable()` or create the `ensure_rls` event trigger. Production has both the function and enabled event trigger, so their provenance was not explained by the historical checked-in 001–003 sequence (or may reflect unrecorded SQL). Those legacy files have since been removed from the `backend` branch. This historical finding remains relevant to production provenance, but is not a reason to restore the hackathon files to the standalone migration chain.

Do not silently add a test-only stub and call the replay complete. The reconciliation decision must establish whether the helper/event trigger belongs in a reviewed baseline/reconciliation migration or is intentionally platform-provisioned. Preserve the production trigger behavior and the restricted SECURITY DEFINER grants. This is a concrete reason Gate 1 and the full legacy replay remain blocked.

### Migration-by-migration comparison

- **001 foundation:** the table/enum/index/constraint/RLS/policy definitions are substantially represented in the dump. The public event-catalog grants and SECURITY DEFINER execute revocation appear as policy/object state where applicable, but ACL statements are not in this dump; the revocation cannot be certified from this file alone.
- **002 blueprint persistence hardening:** the dump contains `blueprint_versions_team_insert`, `activity_team_insert`, and the `enforce_blueprint_submission_lock()` function/trigger with the expected lock and immutable-ownership checks.
- **003 activity monitoring:** the dump contains `activity_participant_or_admin_select`, with the previous `activity_team_select` policy absent. The publication membership change cannot be verified from this dump and needs a separate publication query.
- **20261010070000 projects:** no corresponding table, index, policy, or trigger is in the dump; this is expected and is a production safety invariant.
- **20261010080000 audit hardening:** the dedicated deny policy and explicit revoke are absent, consistent with this being a pending proposed migration.

### Remaining work before Gate 1 can pass

- Compare normalized column definitions, defaults, nullability, constraints, indexes, policy expressions, function definitions, and trigger definitions against a clean local replay. The uploaded dump and catalog queries confirm full structural alignment for all 14 legacy tables, enums, indexes, and constraints.
- The absence of `public.projects` in production is confirmed as expected prior to applying `20261010070000_create_projects.sql`.

## Final release gate decision

| Gate                                                                       | Status                         | Evidence                                                                                                                                                                              | Closure condition                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Repository migration/test integrity                                        | PENDING POST-CLEANUP CI        | Projects migration, project assertions, and admin-audit test remain; three legacy hackathon migrations and blueprint-only test fixtures were removed from `backend`. Historical replay results predate cleanup. | Require GitHub Actions success on the post-cleanup branch head. |
| Remote ledger facts                                                        | PASS                           | Production SQL Editor supplied the three authoritative versions and names.                                                                                                            | Keep history unchanged.                                                                                             |
| Remote ledger to Git provenance                                            | STRONGLY SUPPORTED, NOT PROVEN | Commit SQL and UTC timestamps strongly support the three counterparts; ledger does not expose Git hashes.                                                                             | Do not repair history; obtain deployment SQL/checksums if canonical provenance is required.                         |
| `rls_auto_enable()`                                                        | PASS (definition partial)      | Dump contains `SECURITY DEFINER` and `search_path=pg_catalog`.                                                                                                                        | Verified in production dump.                                                                                        |
| `ensure_rls` event trigger                                                 | UNVERIFIED DEFINITION          | Prior catalog notes confirm active; dump omits definition.                                                                                                                            | Capture definition/owner/enabled state; do not infer absence.                                                       |
| ACLs/default privileges/sequences                                          | RECONCILED AT REPORTED SCOPE   | 98 table grants per browser role and schema defaults reflect standard Supabase/PostgREST access; RLS is enabled on all tables. `create_projects.sql` explicitly neutralizes defaults. | Preserve defense-in-depth; capture remaining object-level ACL details if canonical baseline approval requires them. |
| Extensions/schemas                                                         | REPORTED PASS, SCOPE LIMITED   | Existing evidence reports `pgcrypto` and `auth`; complete ownership/version output is not in the supplied results.                                                                    | Capture ownership/version output if canonical baseline approval requires it.                                        |
| Realtime                                                                   | PARTIAL                        | `activity_logs` membership confirmed in `supabase_realtime`.                                                                                                                          | Preserved.                                                                                                          |
| Projects migration (`20261010070000_create_projects.sql`)                  | CONDITIONAL — NO PRODUCTION WRITE | Disposable tests cover schema/RLS, but canonical baseline and migration-history provenance remain unresolved. Production table was absent at capture time. | Finish baseline/history reconciliation and obtain explicit production-write approval. |
| Admin-audit hardening (`20261010080000_harden_admin_audit_log_access.sql`) | DEFERRED (NO-GO FOR BUNDLING)  | Local migration/test exists; changes existing table privileges.                                                                                                                       | Unbundled from projects rollout.                                                                                    |

### Separate production write gates

**Projects migration write: NO-GO pending remaining release gates.**
The projects migration is additive and explicitly defends itself against broad schema default privileges, but repository tests alone do not resolve production baseline and migration-history provenance. Do not deploy until those gates are reviewed and explicit approval is given.

Post-deployment verification requires:

1. Reloading PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`).
2. Catalog verification of table, four policies, RLS enablement, and authenticated-only CRUD grants.
3. Application smoke test verifying User A project persistence and User B isolation. Legacy blueprint behavior is outside the standalone application's CI scope and must not be changed as part of this migration.

## Final repository validation record

On 2026-10-10, a historical disposable replay applied legacy migrations `001`–`003`, the projects migration, and the separate admin-audit hardening migration to ephemeral PostgreSQL with compatibility bootstrap objects. This replay is not the current repository migration chain: the three legacy files and their blueprint-only CI fixtures were subsequently removed from `backend`. The latest pre-cleanup GitHub Actions run passed on commit `9a0307a7e86f17c1b627843f37c7191f3770aa74`; the updated CI must pass again before this cleanup is considered validated. No production DDL, data, or migration metadata was changed.

These results establish repository readiness only. They do not establish production ownership/ACLs, event-trigger provenance, extension ownership, complete realtime membership, or remote-to-Git migration provenance.


## Remote ledger-to-Git mapping review (read-only, 2026-10-11)

A commit-level comparison now provides strong evidence for mapping the three remote migration ledger entries to historical SQL changes:

| Remote version / name | Matching historical Git commit | Observed SQL diff |
| --- | --- | --- |
| `20261008050118` / `allow_public_event_catalog_reads` | [`b087fa8f9444c75a85382989a4d04889502c428a`](https://github.com/raghul0610/breachx/commit/b087fa8f9444c75a85382989a4d04889502c428a), committed 2026-10-08 05:01:22Z | Adds anonymous SELECT grants and policies for `events`, `event_config`, `tracks`, and active `problem_statements`. |
| `20261008050230` / `harden_public_security_definer` | [`e9292f5458ab6ee2abbc38cdb31749f4a928c525`](https://github.com/raghul0610/breachx/commit/e9292f5458ab6ee2abbc38cdb31749f4a928c525), committed 2026-10-08 05:02:32Z | Revokes EXECUTE on `public.rls_auto_enable()` from `anon` and `authenticated`. |
| `20261008050245` / `remove_public_security_definer_execute` | [`dec069a26c220bfe86b9b48c8a5fcdbe78a09d12`](https://github.com/raghul0610/breachx/commit/dec069a26c220bfe86b9b48c8a5fcdbe78a09d12), committed 2026-10-08 05:02:53Z | Extends the function EXECUTE revocation to `PUBLIC`, `anon`, and `authenticated`. |

The commit times closely align with the remote version timestamps (respectively 4 seconds, 2 seconds, and 8 seconds after the ledger versions), and the diffs align semantically with the ledger names. All three changes modified the historical `001_breachx_backend_foundation.sql` in Git; they are not three separate timestamped migration files in the current branch.

**Assessment: STRONGLY SUPPORTED mapping, not execution-proven provenance.** The remote ledger provides version/name metadata, not the Git SHA or SQL checksum that was executed. The commit diff establishes what changed in Git, but does not independently prove the exact SQL submitted to production. Close this gap only if a deployment record, captured executed SQL, or canonical checksum is available. Do not reconstruct migration files and mark them applied merely from timestamp alignment.

This review was read-only. No migration metadata or production objects were changed.

## Post-cleanup live catalog verification (read-only, 2026-10-11)

Post-cleanup CI passed for backend head `e3f1503effb3845068b49bf9ead10445c05ba878` (PR #6 run [38101418404](https://github.com/raghul0610/breachx/actions/runs/38101418404)). A subsequent read-only Supabase connector inspection confirmed:

- Remote migration versions remain exactly `20261008050118`, `20261008050230`, and `20261008050245`; no history was changed.
- `public.projects` and `public.set_projects_updated_at()` are absent. `auth.users`, `auth.uid()`, and `gen_random_uuid()` are present.
- All 14 legacy public tables remain and have RLS enabled. The legacy `blueprints` table remains.
- The `blueprint_submission_lock` trigger remains on `public.blueprints` and calls `public.enforce_blueprint_submission_lock()`. The function body rejects updates after submission and rejects changes to event/team/assignment ownership. Preserve this live behavior; removing the repository migrations did not drop it.
- The enabled event-trigger inventory contains seven entries: `ensure_rls`, `issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`, and `pgrst_drop_watch`. The `ensure_rls` trigger invokes `public.rls_auto_enable()`; that function is SECURITY DEFINER with `search_path=pg_catalog`.
- `supabase_realtime` is not configured for all tables; the catalog reports `public.activity_logs` as its current member.
- Installed extensions reported by `pg_extension`: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, and `uuid-ossp 1.1`.
- Live RLS policies were enumerated and align with the legacy event/team/blueprint application schema. The full catalog output should remain audit evidence, not a replacement for a canonical schema-and-ACL baseline.

This narrows the outstanding baseline work, but it does not prove the remote migration ledger maps to checked-in SQL. The exact executed SQL/checksum provenance remains unverified. Supabase Auth provider/site URL/redirect settings and deployed application persistence/isolation smoke tests remain unverified. The projects migration is still not authorized for production, and `20261010080000_harden_admin_audit_log_access.sql` remains NO-GO for production.

No production DDL, data writes, grants, publication changes, or migration-history changes were performed during this inspection.
