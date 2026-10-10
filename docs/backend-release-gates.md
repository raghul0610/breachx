# Backend release gates — BreachX

This checklist is the release contract for PR #6. The operator uses PostgreSQL 17 locally and does not use Docker. Separate repository-verifiable checks from actions requiring the linked Supabase Dashboard or Vercel access.

**Production safety:** do not run `supabase db push`, `supabase migration repair`, a linked reset, or the proposed audit-log hardening migration against production until the schema baseline and history reconciliation have been reviewed. Do not mark a gate complete based on a catalog inventory or isolated PostgreSQL test.

## 1. Canonical schema baseline

### Evidence already recorded

- `docs/production-schema-inventory-2026-10-10.md` is catalog-derived evidence, not a canonical CLI dump.
- Remote migration history currently contains:
  - `20261008050118_allow_public_event_catalog_reads`
  - `20261008050230_harden_public_security_definer`
  - `20261008050245_remove_public_security_definer_execute`
- The repository has legacy SQL files `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql`, plus timestamped projects and audit-log hardening migrations. Their relationship to remote history is not established.
- Production currently does not have `public.projects`. Do not apply the projects migration to production during this baseline task.

### Run locally with PostgreSQL 17 (no Docker)

1. Keep the production dump outside Git; it is audit evidence and may contain environment-specific details. The uploaded dump has already been inspected, but its ACL, event-trigger, publication, and extension coverage is incomplete.
2. Use the existing PostgreSQL 17 installation and a dedicated disposable database. Never point test commands at the production Supabase host. Preserve unrelated untracked files.
3. Capture the live migration ledger using the existing authenticated Supabase connection (already verified): the ledger currently contains only `20261008050118`, `20261008050230`, and `20261008050245`.
4. Run read-only catalog queries for ACLs/default privileges, event-trigger definitions, publication membership, extensions, functions, triggers, policies, constraints, and indexes. The live catalog has now confirmed the `ensure_rls` event trigger and `activity_logs` publication membership; these were omitted from the uploaded dump.
5. Replay `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql` against an empty disposable PostgreSQL database only after bootstrapping the minimum Supabase-compatible `auth` schema/functions and roles needed by these migrations. Record any compatibility shim explicitly; a plain PostgreSQL replay is not a full Supabase environment.
6. Test `20261010080000_harden_admin_audit_log_access.sql` separately on the disposable database. Test `20261010070000_create_projects.sql` separately as an additive feature migration. Do not apply either to production during reconciliation.
7. Compare the replay catalog against production evidence and document every difference. Never accept migration-history repair as a shortcut, and never mark legacy migrations applied merely because their objects exist.

**Pass criteria:** reviewed schema/ACL evidence is complete; the PostgreSQL-only replay succeeds from an empty database with documented compatibility shims; regression checks pass; every remote history entry and legacy migration has an explicit reviewed disposition; no unexplained drift remains. This PostgreSQL-only test does not prove Supabase Auth/provider configuration or platform-specific behavior.

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
3. Apply the legacy migrations in order, then run the projects migration and audit-log hardening migration in separate test runs. Capture the first failure exactly; fix the root cause on `backend`, not by editing production or repairing its ledger.
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
- [ ] Verify standalone submitted projects remain editable and legacy hackathon blueprint submission locking is unchanged.
- [ ] Inspect browser console, network responses, Supabase logs, and Vercel runtime/build logs for errors.

**Release decision:** keep PR #6 unmerged and do not apply production DDL until Gates 1 and 3 pass, Auth settings are verified, and CI/review is green. After deployment, complete the real-flow smoke test before calling the work done.

## What requires the repository owner

The connected GitHub/Supabase tools have already been used for read-only production catalog queries and remote migration-history inspection. They cannot execute SQL against the user's local PostgreSQL server, inspect private Auth provider settings through the available project metadata, or perform a browser-based Vercel smoke test. Those remaining environment-bound checks require the local PostgreSQL connection or Dashboard/browser evidence; no Docker use is required.
