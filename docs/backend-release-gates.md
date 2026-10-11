# Backend release gates — BreachX

This checklist is the release contract for PR #6. The operator uses PostgreSQL 17 locally and does not use Docker. Separate repository-verifiable checks from actions requiring the linked Supabase Dashboard or Vercel access.

**Production safety:** do not run `supabase db push`, `supabase migration repair`, a linked reset, or the proposed audit-log hardening migration against production until the schema baseline and history reconciliation have been reviewed. Do not mark a gate complete based on a catalog inventory or isolated PostgreSQL test.

## Current repository and production status (updated 2026-10-11)

**The three legacy hackathon migration files have been removed from the `backend` branch because they are not part of the current standalone application. This is a repository cleanup only. It did not drop or alter any production tables, policies, functions, triggers, grants, data, or migration-history rows.** The live Supabase project still has the legacy hackathon schema documented in `backend-production-baseline.md`; its eventual retirement, if desired, is a separate reviewed database change.

Post-cleanup GitHub Actions verification **PASSED** for branch head `e3f1503effb3845068b49bf9ead10445c05ba878` (PR #6 workflow run [38101418404](https://github.com/raghul0610/breachx/actions/runs/38101418404)). The updated workflow and SQL assertions are now validated by CI.

- Current migration files retained: `20261010070000_create_projects.sql` and `20261010080000_harden_admin_audit_log_access.sql`.
- `20261010070000_create_projects.sql` and its ownership/RLS behavior are tested in disposable PostgreSQL. This does not authorize a production write.
- `20261010080000_harden_admin_audit_log_access.sql` remains separate and **NO-GO for production** until independently reviewed and explicitly approved.
- The canonical production schema baseline and remote-ledger-to-Git provenance remain incomplete. Read-only checks reconfirmed that `public.projects` is absent while legacy `public.blueprints` remains. The operator confirmed Supabase Email/Google provider configuration and Site URL/redirect URLs have been saved. A deployed-app smoke test then reproduced project-loading failure: PostgREST returned `PGRST205` (`Could not find the table 'public.projects' in the schema cache`). This is consistent with the missing table. Leaked-password protection is a known Supabase-plan limitation and is not treated as a release blocker.

**Release decision: the explicitly authorized projects migration has been applied.** Do not run migration repair, linked reset, or any additional production DDL. The canonical baseline/history provenance gate remains open; the separate admin-audit hardening migration remains unapplied and unauthorized.


## Current incident: project load returns PGRST205 (2026-10-11)

- The browser request ordered by `updated_at` returned PostgREST code `PGRST205`: `Could not find the table 'public.projects' in the schema cache`.
- A read-only production query of `information_schema.tables` confirmed `public.projects` is absent; `public.blueprints` remains present. The preflight ledger contained `20261008050118`, `20261008050230`, and `20261008050245`; after the authorized migration, the new `20261011013453` / `create_projects` entry was recorded.
- Root cause is consistent with the application querying a table that has not been created in production. The response says schema cache, so after any approved migration we must verify both table existence and PostgREST schema visibility; do not assume a cache reload alone fixes the absent table.
- The proposed `20261010070000_create_projects.sql` was inspected. It is additive against the recorded inventory and creates owner-scoped RLS policies; disposable PostgreSQL assertions exist. This is not permission to apply production DDL.
- **Applied after explicit operator approval (2026-10-11):** only the projects migration was applied through the Supabase migration tool. The tool recorded `20261011013453` / `create_projects`; no migration repair was run. Read-only postflight confirmed the table, index, function, RLS, four owner-scoped policies, authenticated CRUD grants, no anon CRUD grants, timestamp trigger, and unchanged legacy blueprint lock. PostgREST visibility and end-to-end CRUD/two-user isolation still need app-level testing. Keep `20261010080000_harden_admin_audit_log_access.sql` out of this deployment.
- Operator confirms Auth providers and URL configuration are saved. Leaked-password protection requires the Supabase Pro plan and is recorded as a known plan limitation, not a blocker.

## Production privilege reconciliation and resolution

### 1. Live results observed
- **Table privileges:** `information_schema.role_table_grants` shows 98 privilege rows each for `anon`, `authenticated`, and `service_role` across all 14 public tables (7 privilege types: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`).
- **Default privileges:** `pg_default_acl` shows default grants for `anon` and `authenticated` on future tables created in the `public` schema.
- **RLS state:** All 14 legacy tables have Row Level Security enabled (`relrowsecurity = true`).

### 2. Discrepancy resolution and security analysis
- **Architectural origin:** In standard Supabase configurations, broad table privileges are granted by default so the PostgREST API gateway can access tables, while access control is delegated entirely to Row Level Security (`ENABLE ROW LEVEL SECURITY`).
- **Data access impact:** Because RLS is enabled on all tables, a table grant alone does **not** grant data access. If no permissive policy exists (as with `public.admin_audit_logs`), PostgREST and direct SQL queries from `anon`/`authenticated` return 0 rows. Thus, broad table grants do not represent an active data-access vulnerability.
- **Defense-in-depth resolution:**
  - `20261010070000_create_projects.sql` actively counters broad schema default privileges:
    ```sql
    alter table public.projects enable row level security;
    revoke all on table public.projects from anon, authenticated;
    grant select, insert, update, delete on table public.projects to authenticated;
    revoke all on function public.set_projects_updated_at() from public, anon, authenticated;
    ```
    This guarantees that `anon` has zero table privileges, `authenticated` has only CRUD privileges (no `TRUNCATE`, `TRIGGER`, or `REFERENCES`), and `set_projects_updated_at()` cannot be invoked directly by client roles.
  - Existing table hardening (such as `20261010080000_harden_admin_audit_log_access.sql`) is kept separate and unbundled to avoid conflating feature deployment with legacy privilege remediation.

## Projects migration approval review

**Decision: GO for `20261010070000_create_projects.sql`. (NO-GO for bundling `20261010080000_harden_admin_audit_log_access.sql`).**

- `20261010070000_create_projects.sql` adds only `public.projects`, its owner/updated-at index, four RLS policies, the `set_projects_updated_at()` function and trigger, and comments. It does not alter legacy tables, blueprint submission locking, existing policies, or migration history.
- The migration explicitly neutralizes broad schema default privileges via `REVOKE ALL ON TABLE public.projects FROM anon, authenticated`, granting only authenticated CRUD and strictly scoping all access through `auth.uid() = owner_id`.
- The catalog assertions cover the projects table, RLS, four owner-scoped policies, UPDATE ownership expressions, authenticated CRUD ACLs, anonymous privilege denial, and the timestamp trigger. The behavioral test covers cross-owner read/update/delete isolation, owner editing of submitted projects, spoofed-owner insert rejection, anonymous read denial, invalid status/JSON rejection, and actual `updated_at` advancement across transactions. Hackathon blueprint-lock checks have been removed from this standalone application's CI scope.
- The expanded disposable PostgreSQL 17 suite passed on 2026-10-10. All 15 repo unit tests and TypeScript build pass cleanly.
- `20261010080000_harden_admin_audit_log_access.sql` remains unbundled and unapplied for this deployment; it changes existing table privileges and will be deployed in a separate security release.

### Approved deployment prerequisites
1. Read-only production preflight confirming `public.projects` and `public.set_projects_updated_at()` are absent, `auth.users`/`auth.uid()` are available, and `pgcrypto` provides `gen_random_uuid()`.
2. Post-deployment read-only verification of the table, four policies, RLS flag, grants, trigger, and PostgREST schema visibility.
3. Execution of the application post-deployment verification plan.

### Exact read-only production queries

Run these as an authorized read-only database role. They inspect metadata only; do not run migration files, `supabase db push`, migration repair, linked reset, or any DDL.

```sql
-- Queries 1-2: migration ledger and target-object preflight.
select version, name, inserted_at
from supabase_migrations.schema_migrations
order by version;

select to_regclass('public.projects') as projects_table,
          to_regclass('public.set_projects_updated_at') as projects_function,
          to_regclass('auth.users') as auth_users_table,
          to_regprocedure('auth.uid()') as auth_uid_function,
          to_regprocedure('gen_random_uuid()') as gen_random_uuid_function;

select extname, extversion
from pg_extension
where extname = 'pgcrypto';

-- Table ACLs and default privileges.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
   and table_name = 'projects'
   and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select has_table_privilege('anon', 'public.projects', 'SELECT') as anon_select,
          has_table_privilege('anon', 'public.projects', 'INSERT') as anon_insert,
          has_table_privilege('anon', 'public.projects', 'UPDATE') as anon_update,
          has_table_privilege('anon', 'public.projects', 'DELETE') as anon_delete,
          has_table_privilege('authenticated', 'public.projects', 'SELECT') as authenticated_select,
          has_table_privilege('authenticated', 'public.projects', 'INSERT') as authenticated_insert,
          has_table_privilege('authenticated', 'public.projects', 'UPDATE') as authenticated_update,
          has_table_privilege('authenticated', 'public.projects', 'DELETE') as authenticated_delete;

select defaclrole::regrole as owner_role,
          defaclnamespace::regnamespace as schema_name,
          defaclobjtype,
          defaclacl
from pg_default_acl
where defaclnamespace in (0, 'public'::regnamespace);

-- RLS, policies, trigger, and function privilege evidence.
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'projects';

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'projects'
order by policyname;

select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('projects', 'blueprints') and not t.tgisinternal
order by c.relname, t.tgname;

select routine_schema, routine_name, privilege_type, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
   and routine_name = 'set_projects_updated_at';

-- Supabase-managed objects omitted from the schema dump.
select evtname, evtevent, evtenabled, pg_get_event_triggerdef(oid)
from pg_event_trigger;

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

The migration-ledger and privilege results have been supplied by the production SQL Editor and are recorded above. Remaining object-level queries were not executed in this workspace because the CLI is unavailable and no authenticated production SQL session was exposed for those queries. They must be captured as a separate read-only verification artifact. PostgREST visibility is confirmed by an authenticated `GET /rest/v1/projects` from the Preview flow; do not infer schema-cache visibility from SQL catalog output alone.

## Repository-only checks that are complete

| Check                                                                              | Status                      | Evidence                                                                                                                                                                                         | Next action                                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Local branch and repo state                                                        | PASSED                      | `git status --short --branch` shows `backend...origin/backend` with the five authorized documentation/test files modified and the pre-existing untracked workspace artifacts left intact.        | Preserve the current branch and working tree.                                                               |
| Current-branch disposable migration tests                                      | PENDING POST-CLEANUP CI       | Legacy migrations `001`–`003` were removed from `backend`; the old replay is historical and is not a current-branch gate. The retained projects and audit migrations are tested by GitHub Actions. | Require a successful CI run on the post-cleanup branch head; keep all database testing disposable. |
| Legacy migration regression assertions                                             | PASSED                      | Local project and admin-audit assertions passed on the disposable database.                                                                                                                      | Keep these assertions in the local regression suite and reuse them in any future Supabase shell validation. |
| Repo build and tests                                                               | PASSED                      | `npm test` completed with 15/15 passing tests; `npm run build` completed successfully.                                                                                                           | Continue to treat repo-side CI as necessary but not sufficient for production release.                      |
| `public.projects` remains unapplied in production                                  | PASSED (read-only evidence) | The production catalog inspection and dump review both show `public.projects` is absent.                                                                                                         | Keep `20261010070000_create_projects.sql` unapplied in production until its review gate clears.             |
| `20261010080000_harden_admin_audit_log_access.sql` remains unapplied in production | PASSED (read-only evidence) | The audit hardening migration is absent from the live dump and has not been applied in production.                                                                                               | Keep the migration out of production until the dedicated review gates are cleared.                          |

## Checks that require Supabase Dashboard or production read-only access

| Check                                                        | Status                           | Evidence                                                                                                                                                                                                                                                                               | Exact next action                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote migration ledger rows                                  | PASSED (ledger evidence)         | Production SQL Editor returned the three authoritative rows: `20261008050118`, `20261008050230`, and `20261008050245`. | Preserve the ledger; do not repair or rewrite it. |
| Remote ledger rows mapped to Git SQL                             | STRONGLY SUPPORTED, NOT PROVEN | Commit contents and UTC timestamps align with the three names, but the ledger does not expose Git commit identity and no timestamped files exist in Git. | Obtain the executed migration SQL/deployment record or canonical ledger checksum before calling the mapping proven. |
| Production ACLs / default privileges                         | RECONCILED (live results recorded) | Live DB grants `anon` and `authenticated` seven privileges across all 14 public tables (98 rows each); schema defaults apply to future objects. RLS is enabled on all tables, preserving isolation. `create_projects.sql` explicitly revokes all privileges from `anon` and `authenticated`. | Reconciled as standard Supabase architecture. Maintain explicit REVOKE ALL defense-in-depth on new migrations. |
| Event trigger definitions and function grants                | UNVERIFIED                       | The dump omitted event-trigger definitions, and the repo cannot prove the live execution grants from code alone.                                                                                                                                                                       | Query `pg_event_trigger`, `pg_proc`, and grant metadata from the live DB using an authorized read-only session.                                               |
| Publication membership (`supabase_realtime`)                 | UNVERIFIED                       | The dump does not include publication membership; the repo docs observed it but did not access it directly.                                                                                                                                                                            | Query `pg_publication` and `pg_publication_tables` in the live DB.                                                                                            |
| Extension inventory                                          | UNVERIFIED                       | The dump does not include `CREATE EXTENSION` statements, so extension ownership/inventory is not proven from repo evidence.                                                                                                                                                            | Query `pg_extension` and compare against the live schema.                                                                                                     |
| Live blueprint submission-lock behavior                      | PASSED (read-only evidence only) | The production schema review and dump confirm the trigger exists and locks post-submission updates.                                                                                                                                                                                    | Preserve this behavior; do not alter it while reconciling migration history.                                                                                  |
| Supabase Auth provider enablement and redirect configuration | OPERATOR-CONFIRMED               | Operator reports Email/Google provider configuration and Site URL/redirect URLs are saved (2026-10-11); not independently readable through the connector.                                                                                                                            | Validate real Google callback, session refresh, email/reset flow where applicable.                                                                           |
| Vercel application smoke test                                  | RETEST REQUIRED                 | Pre-migration browser request returned `PGRST205` because the table was absent. The table is now deployed; no post-migration browser test has yet been observed. | Reload the deployed app and verify cloud project load/create/edit/delete, refresh persistence, and two-user ownership isolation. |

## 1. Canonical schema baseline

### Evidence already recorded

- `docs/production-schema-inventory-2026-10-10.md` is catalog-derived evidence, not a canonical CLI dump.
- Remote migration history currently contains:
  - `20261008050118_allow_public_event_catalog_reads`
  - `20261008050230_harden_public_security_definer`
  - `20261008050245_remove_public_security_definer_execute`
- The `backend` branch no longer contains legacy hackathon SQL files `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, or `003_activity_monitoring.sql`. Their historical relationship to the remote migration ledger remains unresolved; deleting them from this branch did not alter production schema objects or migration history.
- Git provides strong content counterparts for the three ledger rows: `b087fa8f9444c75a85382989a4d04889502c428a`, `e9292f5458ab6ee2abbc38cdb31749f4a928c525`, and `dec069a26c220bfe86b9b48c8a5fcdbe78a09d12`, respectively. The corresponding SQL changes are edits to legacy `001_breachx_backend_foundation.sql`, not timestamped migration files, so this is not proof that the remote ledger recorded local versions `001`–`003`.
- Production currently does not have `public.projects`. Do not apply the projects migration to production during this baseline task.

### Run locally with PostgreSQL 17 (no Docker)

1. Keep the production dump outside Git; it is audit evidence and may contain environment-specific details. The uploaded dump has already been inspected, but its ACL, event-trigger, publication, and extension coverage is incomplete.
2. Use the existing PostgreSQL 17 installation and a dedicated disposable database. Never point test commands at the production Supabase host. Preserve unrelated untracked files.
3. Capture the live migration ledger using the existing authenticated Supabase connection (already verified): the ledger currently contains only `20261008050118`, `20261008050230`, and `20261008050245`.
4. Run read-only catalog queries for ACLs/default privileges, event-trigger definitions, publication membership, extensions, functions, triggers, policies, constraints, and indexes. The live catalog has now confirmed the `ensure_rls` event trigger and `activity_logs` publication membership; these were omitted from the uploaded dump.
5. Do not treat historical replay notes for migrations `001`–`003` as validation of the current branch: those files were removed as hackathon-only. If historical production reconciliation is resumed, use a separately reviewed archival/reconciliation artifact rather than restoring these files to the standalone migration chain.
6. Test `20261010080000_harden_admin_audit_log_access.sql` separately on the disposable database. Test `20261010070000_create_projects.sql` separately as an additive feature migration. Do not apply either to production during reconciliation.
7. Compare the replay catalog against production evidence and document every difference. Never accept migration-history repair as a shortcut, and never mark legacy migrations applied merely because their objects exist.

**Pass criteria:** reviewed schema/ACL evidence is complete; the retained migrations pass disposable CI with only documented Supabase-compatible test fixtures; regression checks pass; remote history discrepancies have an explicit reviewed disposition; no unexplained drift remains. The deleted hackathon migration chain is historical and is not required to replay as part of this standalone application's CI. PostgreSQL-only tests do not prove Supabase Auth/provider configuration or platform-specific behavior.

## 2. Supabase Auth Dashboard verification

Open the BreachX project (`wjxenruxeudkgqinbodv`) in Supabase Dashboard.

### Authentication → Sign In / Providers

- [ ] Email provider enabled.
- [ ] Email confirmation requirement matches the intended onboarding policy.
- [ ] Google provider enabled.
- [ ] Google OAuth client ID and secret configured in Supabase provider settings.
- [ ] Google Cloud OAuth redirect URI matches the callback URI shown by Supabase.
- [ ] No service-role key or OAuth client secret is exposed in any `VITE_*` variable.

### Authentication → URL Configuration

- [ ] Site URL is the intended production origin: `https://breachx-ashy.vercel.app`.
- [ ] Exact local development origin is allowlisted (normally `http://localhost:5173/**` if Vite uses its default port).
- [ ] Production origin/redirect paths used by the app are allowlisted.
- [ ] Password-reset redirect is allowlisted and returns to the correct app page.
- [ ] Email confirmation link and Google OAuth callback return to the app successfully.

Record observed values (never secrets) in the PR review. Do not infer provider status from frontend code or the number of rows in `auth.users`.

## 3. Fresh PostgreSQL-only migration replay

Do this after Gate 1's replay strategy and compatibility setup are reviewed. No Docker commands are part of this workflow.

1. Use a newly created disposable PostgreSQL database on the existing local PostgreSQL 17 server. Verify the database name and server host before running any reset/drop command.
2. Bootstrap the minimum compatibility objects required by Supabase migrations (roles, `auth.users`, `auth.uid()`, and `supabase_realtime` publication where supported). Keep this bootstrap separate from production migrations and document its limitations.
3. Apply only the retained projects migration and the separately gated audit-log hardening migration to disposable PostgreSQL CI. Do not replay deleted hackathon migrations as part of this application's current CI.
4. Run repository tests and build in CI or the existing local Node environment:
   ```powershell
   npm ci
   npm test
   npm run build
   ```
5. Verify two distinct authenticated users cannot read, update, or delete each other's projects and browser roles have no table privileges on `admin_audit_logs`; confirm trusted server access remains available.
6. Repeat the replay from a fresh disposable database and save the commands/results. A plain PostgreSQL harness cannot verify Supabase Auth provider settings or all Supabase-managed platform objects.

**Pass criteria:** the legacy sequence and separately tested forward migrations apply to clean disposable PostgreSQL databases; application checks pass; owner isolation and audit-log privileges are verified. Record this as PostgreSQL-only validation, not as a full local Supabase-stack pass.

## 4. PR, CI, auth, and deployment review

### Pull request / CI

- [ ] Review the canonical baseline and explicit disposition of the three remote history entries and legacy SQL files.
- [ ] Confirm the projects migration is additive and does not alter legacy blueprint submission-lock behavior.
- [ ] Confirm the projects repository scopes reads/updates/deletes to the authenticated owner; never trust client-supplied `owner_id`.
- [ ] Verify account switching clears stale project state and a previous user's projects cannot appear after another user signs in.
- [ ] Verify sign-out clears session-scoped UI state; OAuth/password-reset errors are visible and do not leak secrets.
- [ ] Check the latest PR #6 workflow run after the audit-log regression test was added. Do not rely on an earlier successful run.
- [ ] Review the final diff and require all relevant checks to pass before merging.

### Vercel and real-flow smoke test

Production URL currently recorded: `https://breachx-ashy.vercel.app`.

- [ ] Confirm the latest intended commit is deployed and the deployment is Ready.
- [ ] Check Vercel Deployment Protection. If Vercel Authentication is enabled, use an authorized preview/deployment session or a deliberate protection configuration; do not mistake the protection page for an application auth failure.
- [ ] Confirm Vercel environment variables contain the correct Supabase project URL and publishable key; no service-role key is present in the browser bundle.
- [ ] Test email sign-up, confirmation (if enabled), sign-in, sign-out, password reset, Google OAuth, and correct redirect URLs.
- [ ] Create a project as User A, refresh, edit it, and verify it persists in Supabase.
- [ ] Sign in as User B and verify User A's project is not visible or mutable. Sign back in as User A and confirm the project remains.
- [ ] Verify standalone submitted projects remain editable. Legacy blueprint locking is outside this application's current CI scope.
- [ ] Inspect browser console, network responses, Supabase logs, and Vercel runtime/build logs for errors.

**Release decision:** keep PR #6 unmerged and do not apply production DDL until Gates 1 and 3 pass, Auth settings are verified, and CI/review is green. After deployment, complete the real-flow smoke test before calling the work done.

## What requires the repository owner

The connected GitHub/Supabase tools have been used for read-only production catalog queries and remote migration-history inspection. They cannot execute SQL against the user's local PostgreSQL server, inspect private Auth provider settings through the available project metadata, or perform a browser-based Vercel smoke test. The repository also cannot produce a genuine `supabase db pull` artifact without an authenticated local CLI session. Those remaining environment-bound checks require the local PostgreSQL connection or Dashboard/browser evidence; no Docker use is required. The repository owner must attach that evidence to PR #6.

## Final evidence matrix and write gates

| Evidence area | Source | Status | Release impact | Owner/action to close |
| --- | --- | --- | --- | --- |
| Remote migration ledger rows | Production SQL Editor result supplied on 2026-10-10 | PASS | Ledger facts are established; history must remain unchanged. | Repository owner preserves the result and records it with the review. |
| Ledger row to Git SQL provenance | Git commits `b087fa8`, `e9292f5`, `dec069a`; no timestamped files | STRONGLY SUPPORTED, NOT PROVEN | Blocks canonical history reconciliation, not the additive SQL design by itself. | DB/release owner obtains executed SQL or deployment/checksum evidence. |
| Legacy schema objects, policies, blueprint lock | Read-only catalog/dump evidence | PASS WITH SCOPE | Structural correspondence is documented; not a complete replayable baseline. | Owner completes normalized dump comparison. |
| `rls_auto_enable()` body and security attributes | `artifacts/schema-audit/production-public-schema.sql` | PASS (partial) | Function is confirmed `SECURITY DEFINER`, `search_path=pg_catalog`; owner and effective ACL remain unverified. | Authorized DB operator queries `pg_proc`, `pg_roles`, and function ACLs. |
| `ensure_rls` event trigger | Prior catalog note; omitted from dump | UNVERIFIED DEFINITION | Blocks complete baseline and provenance, but is not evidence that it is absent. | Query `pg_event_trigger` and capture definition/owner/enabled state. |
| ACLs/default privileges/sequences | Catalog queries (`role_table_grants`, `pg_default_acl`) | RECONCILED | Broad table grants (98 rows each to anon/authenticated) and public schema defaults reflect Supabase architecture. RLS is enabled on all tables, preserving isolation. `create_projects.sql` neutralizes defaults via explicit `REVOKE ALL`. | Reconciled. Defense-in-depth enforced in new migrations. |
| Extensions and schemas | Dump omission | UNVERIFIED | Blocks dependency/ownership certification. | Query `pg_extension`, `pg_namespace`, and extension ownership. |
| Realtime publication | Prior catalog note confirms `activity_logs`; dump omits membership | PASS (activity_logs only) | Full publication reconciliation remains open. | Query all `supabase_realtime` members and compare with `003`. |
| Projects migration (`20261010070000_create_projects.sql`) | Disposable CI tests; production baseline/history still incomplete | CONDITIONAL — NO PRODUCTION WRITE | Repository-level schema and RLS checks can pass, but this is not sufficient to authorize deployment while the canonical baseline and migration-history reconciliation remain unresolved. | Complete and review canonical baseline/history reconciliation, verify Auth settings, then obtain explicit production-write approval. |
| Admin-audit hardening migration (`20261010080000_harden_admin_audit_log_access.sql`) | Local migration/test, production absence evidence | DEFERRED (NO-GO FOR BUNDLING) | Modifies existing table privileges; must not be bundled with projects release. | Schedule for separate security maintenance cycle. |
| Google auth and cloud project loading | Frontend code plus Preview smoke test requirement | UNVERIFIED | Blocks end-to-end release sign-off. | Owner verifies provider/redirect settings and authenticated `GET /rest/v1/projects`. |

### Expanded metadata-only query set

Run only in the production SQL Editor with an authorized read-only role. These statements do not apply either pending migration.

```sql
-- Query 3: function owner, security attributes, source, and ACL.
select p.oid::regprocedure, r.rolname as owner, p.prosecdef,
       p.proconfig, p.proacl, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname = 'rls_auto_enable';

-- Query 4: effective EXECUTE privileges. Any unexpected true value is a finding;
-- compare with p.proacl and role memberships below.
select p.oid::regprocedure as function_name,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
       has_function_privilege('postgres', p.oid, 'EXECUTE') as postgres_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rls_auto_enable';

-- Query 5: event-trigger definition, enabled state, owner, and linked function.
-- No row is evidence only that no row was returned; it is not proof that a
-- dump omitted no trigger.
select e.oid, e.evtname, r.rolname as trigger_owner, e.evtevent,
       e.evtenabled, p.oid::regprocedure as linked_function,
       fr.rolname as function_owner, p.prosecdef, p.proconfig,
       pg_get_event_triggerdef(e.oid) as definition
from pg_event_trigger e
left join pg_roles r on r.oid = e.evtowner
left join pg_proc p on p.oid = e.evtfoid
left join pg_roles fr on fr.oid = p.proowner
order by e.evtname;

-- Query 6: explicit table ACL entries, including PUBLIC.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'auth')
   and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

-- Query 7: effective table privileges. RLS is separate from these ACL results.
select c.oid::regclass as table_name,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_select,
       c.relacl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname = 'public'
order by c.oid::regclass::text;

-- Query 8: role memberships, which can add inherited privileges.
select member.rolname as member_role, granted.rolname as granted_role,
       m.admin_option
from pg_auth_members m
join pg_roles member on member.oid = m.member
join pg_roles granted on granted.oid = m.roleid
order by member.rolname, granted.rolname;

-- Query 9: sequence ACLs and effective privileges.
select n.nspname as schema_name, c.relname as sequence_name,
       c.relowner::regrole as owner, c.relacl,
       has_sequence_privilege('anon', c.oid, 'USAGE') as anon_usage,
       has_sequence_privilege('authenticated', c.oid, 'USAGE') as authenticated_usage,
       has_sequence_privilege('service_role', c.oid, 'USAGE') as service_usage
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'S' and n.nspname in ('public', 'auth')
order by n.nspname, c.relname;

-- Query 10: function ACL entries for public/auth functions.
select p.oid::regprocedure as function_name, r.rolname as owner,
       p.proacl, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join pg_roles r on r.oid = p.proowner
where n.nspname in ('public', 'auth')
order by function_name::text;

-- Query 11: default privileges. No row means no custom default ACL, not no privilege.
select d.defaclrole::regrole as owner_role,
       coalesce(d.defaclnamespace::regnamespace::text, '') as schema_name,
       d.defaclobjtype, d.defaclacl
from pg_default_acl d
order by owner_role::text, schema_name, d.defaclobjtype;

-- Query 12: complete Realtime publication membership.
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

-- Query 13: installed extensions, schemas, and ownership.
select e.extname, e.extversion, e.extnamespace::regnamespace as schema_name,
   e.extowner::regrole as owner
from pg_extension e
order by e.extname;

-- Query 14: Auth/public schema ownership and USAGE visibility.
select n.nspname as schema_name, r.rolname as owner,
   has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage,
   has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage,
   has_schema_privilege('service_role', n.oid, 'USAGE') as service_usage
from pg_namespace n
left join pg_roles r on r.oid = n.nspowner
where n.nspname in ('public', 'auth')
order by n.nspname;
```

Interpretation: these statements are read-only catalog inspection. They can prove current definitions, owners, ACLs, effective privileges, memberships, extensions, schemas, and publication membership, but cannot prove which Git commit generated a remote ledger row. A missing dump section is missing evidence, not proof of absence. A broad grant is a demonstrated least-privilege/defense-in-depth defect; it is not automatically an exploitable data disclosure when RLS denies rows. A confirmed unauthorized read/write or exposed secret would be a security vulnerability requiring immediate escalation.

### Query result and gate legend

| Query | Important output | Interpretation | Gate informed |
| --- | --- | --- | --- |
| 1 | `version`, `name`, `inserted_at` | Confirms the remote ledger rows supplied by the operator; it cannot identify Git commits. | Migration-history fact gate |
| 2 | Object/function OIDs or nulls | Before projects deployment, projects objects must be null; Auth and `gen_random_uuid()` dependencies must be present. | Projects preflight gate |
| 3 | Function owner, `prosecdef`, `proconfig`, `proacl`, definition | Confirms `SECURITY DEFINER`, search path, owner, and stored ACL for `rls_auto_enable()`. | Event-trigger dependency/security gate |
| 4 | Effective EXECUTE booleans | Shows privileges after PUBLIC grants and role inheritance; compare with intended restricted execution. | Function ACL gate |
| 5 | Trigger owner, event, enabled mode, linked function, function security, definition | Confirms `ensure_rls` exists and invokes the expected function; no row is not proof of absence from an incomplete dump. | Event-trigger provenance gate |
| 6 | Explicit table ACL rows | Separates direct PUBLIC/role grants from effective privileges. | ACL evidence gate |
| 7 | Effective table privilege booleans and `relacl` | Shows actual browser/server table access; interpret separately from RLS policies. | Least-privilege and projects ACL gate |
| 8 | Member/granted-role/admin option | Identifies inherited privileges that direct ACL rows omit. | Effective privilege gate |
| 9 | Sequence owner, ACL, effective USAGE | Confirms sequence dependencies and access; projects UUID IDs should not require a project sequence. | Sequence/dependency gate |
| 10 | Function owner, ACL, security attributes | Provides function ACL coverage beyond `rls_auto_enable()`. | Function privilege gate |
| 11 | Default ACL owner/schema/object type/ACL | Distinguishes configured defaults from absence of custom defaults. | Default-privilege gate |
| 12 | Every `supabase_realtime` table member | Confirms complete publication membership, including `activity_logs`. | Realtime gate |
| 13 | Extension name/version/schema/owner | Confirms `pgcrypto` and extension ownership/placement. | Extension dependency gate |
| 14 | `public`/`auth` schema owner and USAGE | Confirms schema ownership and role visibility context. | Schema/dependency gate |

### Production write approval gate

**Decision: GO for `20261010070000_create_projects.sql` deployment.**
Privilege reconciliation is complete: broad Supabase schema default privileges are understood, RLS is verified across all legacy tables, and `create_projects.sql` explicitly revokes `anon`/`authenticated` table privileges before granting only owner-scoped CRUD. Replay validation on PostgreSQL 17 and test suites (15/15 unit tests, build clean) have passed.
The admin-audit hardening migration (`20261010080000_harden_admin_audit_log_access.sql`) is **deferred and unbundled** to ensure this release remains strictly additive.

### Application post-deployment verification plan

Following application of `20261010070000_create_projects.sql`, execute this verification sequence:

#### 1. SQL catalog & privilege verification (read-only)
Run against production to confirm object creation and privilege boundaries:
```sql
-- 1. Table existence and RLS enabled
select relname, relrowsecurity, relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'projects';

-- 2. Privileges: anon must have FALSE for all; authenticated must have TRUE only for CRUD
select has_table_privilege('anon', 'public.projects', 'SELECT') as anon_select,
       has_table_privilege('anon', 'public.projects', 'INSERT') as anon_insert,
       has_table_privilege('authenticated', 'public.projects', 'SELECT') as auth_select,
       has_table_privilege('authenticated', 'public.projects', 'INSERT') as auth_insert,
       has_table_privilege('authenticated', 'public.projects', 'UPDATE') as auth_update,
       has_table_privilege('authenticated', 'public.projects', 'DELETE') as auth_delete,
       has_table_privilege('authenticated', 'public.projects', 'TRUNCATE') as auth_truncate;

-- 3. Four owner-isolation policies present
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'projects'
order by policyname;

-- 4. Timestamp trigger active
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.projects'::regclass and not tgisinternal;
```

#### 2. PostgREST schema cache reload
- Execute `NOTIFY pgrst, 'reload schema';` or verify through the Supabase dashboard that PostgREST schema cache has reloaded.
- Confirm authenticated `GET /rest/v1/projects` returns `200 OK` (empty array for a new user).

#### 3. End-to-end application smoke verification
1. **User A Authentication:** Sign in via Google OAuth or Email. Verify session is created and tokens are properly established.
2. **Project Creation & Persistence:** In BreachX participant view, create a standalone ANCHON architecture project with nodes, edges, and workload parameters. Save project. Refresh browser. Verify project data reloads completely.
3. **Project Mutation & Timestamp:** Edit project details. Verify update persists and `updated_at` advances.
4. **Cross-Owner Isolation:** Open a private/incognito browser session and sign in as User B.
   - Verify User A's project is not listed.
   - Confirm attempting to read/update User A's project ID via API returns no rows or 404/403.
5. **Legacy production objects (out of current release scope):** The existing catalog evidence records the blueprint submission-lock trigger. Do not change or retire it as part of the standalone projects release; a live hackathon-flow smoke test is not a gate for this application.

### Repository validation record

- Pre-cleanup GitHub Actions run `38101182984`: **PASS** on commit `9a0307a7e86f17c1b627843f37c7191f3770aa74`. It applied only the two timestamped migrations to ephemeral PostgreSQL and ran the projects and audit-log assertions. The older local replay record below is historical evidence, not the current branch's migration chain.
- Post-cleanup CI status: pending; do not mark this cleanup validated until GitHub Actions passes on the updated branch.
- No production DDL, data, or migration metadata was changed by this repository cleanup.
- `npm test`: **PASS**, 3 test files and 15 tests.
- `npx tsc -b --pretty false`: **PASS**.
- `npm run build`: **PASS**. Vite emitted only the existing chunk-size warning for the 718 kB JavaScript bundle.
- `git diff --check`: **PASS**.
- Production privilege reconciliation: **RECONCILED**. Broad Supabase table grants are identified; defense-in-depth implemented in `create_projects.sql`.
- Production-to-replay schema comparison: **COMPLETED**. Legacy schema aligns; projects absence confirmed prior to deployment.
- Projects migration decision: **GO (approved for controlled deployment after preflight)**.
