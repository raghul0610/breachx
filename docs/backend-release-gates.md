# Backend release gates — BreachX

This checklist is the release contract for PR #6. It deliberately separates repository-verifiable checks from actions that require the linked Supabase Dashboard, local Docker/Supabase CLI, or Vercel access.

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

### Run locally from a clean working tree

1. Install/update the Supabase CLI and Docker Desktop. Confirm Docker is running.
2. Create a dedicated branch and ensure no unrelated local changes are present. Keep `.env.local` and other untracked files intact.
3. Authenticate and link to the intended project:
   ```powershell
   supabase --version
   supabase login
   supabase link --project-ref wjxenruxeudkgqinbodv
   supabase migration list
   ```
4. Capture the schema with the CLI, limiting the scope to application schema where supported:
   ```powershell
   supabase db pull --schema public
   ```
5. If the CLI prompts to repair migration history, stop and record the exact prompt. Do not accept a repair as a convenience step. Inspect the generated SQL and `git diff`; the pull must not be treated as approved merely because the command completed.
6. Compare the resulting dump against all three remote history entries and all three legacy SQL files. Identify which live objects each migration created/changed and which changes are absent from history. Keep legacy files until a reviewed baseline strategy explicitly says what to archive/rename.
7. Commit the reviewed canonical dump and a reconciliation note on the working branch. Do not include credentials, database URLs containing passwords, or production data.

**Pass criteria:** a CLI-generated, reviewed schema artifact exists; every remote history entry and legacy migration has a documented disposition; no unexplained schema drift remains. If the CLI cannot generate a dump without history repair, this gate stays blocked.

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

Record the observed values (never secrets) in the PR review. Do not infer provider status from frontend code or the number of rows in `auth.users`.

## 3. Full fresh local migration sequence

Do this only after Gate 1 has a reviewed outcome.

1. Inspect `supabase/config.toml` and the migration directory. The repository's legacy `001_*.sql`–`003_*.sql` files are not timestamp-prefixed in the same way as new migrations; verify CLI compatibility before changing filenames or history.
2. Use an isolated local Supabase stack, not the linked production database:
   ```powershell
   supabase start
   supabase db reset
   supabase migration list
   ```
   `db reset` destroys the local Supabase database's data. Confirm the target is local before running it.
3. If reset fails on legacy filenames, duplicate objects, extensions, publication setup, or migration ordering, capture the first error and fix the root cause on the branch. Do not paper over it with migration repair or by deleting old migrations.
4. Run repository tests and build:
   ```powershell
   npm ci
   npm test
   npm run build
   ```
5. Run the projects owner-isolation/RLS and admin-audit-log access regression tests against the fresh local database using the repo's documented test invocation. Verify that two distinct authenticated users cannot read, update, or delete each other's projects and that browser roles have no privileges on `admin_audit_logs`.
6. Repeat the reset from a clean local database and record the exact CLI version, command output, and pass/fail results.

**Pass criteria:** the entire migration directory applies in order to a fresh local Supabase stack; application tests/build pass; RLS and audit-log tests pass. Isolated PostgreSQL tests alone do not satisfy this gate.

## 4. PR, CI, auth, and deployment review

### Pull request / CI

- [ ] Review the canonical baseline and explicit disposition of the three remote history entries and legacy SQL files.
- [ ] Confirm the projects migration is additive and does not alter the legacy blueprint submission-lock behavior.
- [ ] Confirm the projects repository always scopes reads/updates/deletes to the authenticated owner; never trust client-supplied `owner_id`.
- [ ] Verify account switching clears stale project state and a previous user's projects cannot appear after another user signs in.
- [ ] Verify sign-out clears session-scoped UI state; OAuth/password-reset errors are visible and do not leak secrets.
- [ ] Check the latest PR #6 workflow run after the audit-log regression test was added. Do not rely on an earlier successful run.
- [ ] Review the final diff and require all relevant checks to pass before merging.

### Vercel and real-flow smoke test

Production URL currently recorded: `https://breachx-ashy.vercel.app`.

- [ ] Confirm the latest intended commit is deployed and the deployment is Ready.
- [ ] Check Vercel Deployment Protection. If Vercel Authentication is enabled, use an authorized preview/deployment session or a deliberate protection configuration; do not mistake the protection page for an application auth failure.
- [ ] Confirm Vercel environment variables contain the correct Supabase project URL and publishable key; no service-role key is present in the browser bundle.
- [ ] Test email sign-up, confirmation (if enabled), sign-in, sign-out, password reset, Google OAuth, and returning to the correct redirect URL.
- [ ] Create a project as User A, refresh, edit it, and verify it persists in Supabase.
- [ ] Sign in as User B and verify User A's project is not visible or mutable. Sign back in as User A and confirm the project remains.
- [ ] Verify standalone submitted projects remain editable and legacy hackathon blueprint submission locking is unchanged.
- [ ] Inspect browser console, network responses, Supabase logs, and Vercel runtime/build logs for errors.

**Release decision:** keep PR #6 unmerged and do not apply production DDL until Gates 1 and 3 pass, Auth settings are verified, and CI/review is green. After deployment, complete the real-flow smoke test before calling the work done.

## What requires the repository owner

The connected GitHub repository cannot produce a genuine `supabase db pull` artifact without an authenticated local CLI session, and it cannot verify private Dashboard settings or perform a browser-based Vercel smoke test. The repository owner must complete those environment-bound steps and attach the resulting evidence to PR #6.
