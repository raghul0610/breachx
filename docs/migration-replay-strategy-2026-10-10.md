# Migration replay strategy and isolated validation plan

Date: 2026-10-10
Branch: `backend`
Status: **proposal only; production migration ledger and schema must not be changed by this plan**

## Decision

Do not repair the production migration ledger yet. Do not rename the legacy files `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, or `003_activity_monitoring.sql` to timestamped files and do not mark them applied merely because catalog objects look similar.

The only safe next step is to establish a reproducible, disposable local replay and compare its resulting schema with the read-only production dump. A production baseline or history reconciliation requires an explicit reviewed plan after that evidence exists.

## Evidence currently established

- Production has the 14 legacy public tables, four application enums, the nine named secondary indexes from migration 001, RLS enabled on all 14 tables, the activity read-policy replacement from migration 003, the blueprint submission-lock trigger from migration 002, and activity_logs in supabase_realtime.
- The remote ledger has versions `20261008050118`, `20261008050230`, and `20261008050245`, whose names describe public catalog access and SECURITY DEFINER execute hardening. Historical versions of migration 001 show these were developed as incremental edits to that legacy file. This is a likely mapping, not proof that versions 001–003 are recorded remotely.
- `public.projects` is absent from production. Keep `20261010070000_create_projects.sql` out of production until separately approved.
- `20261010080000_harden_admin_audit_log_access.sql` is a proposed additive security migration. It must be tested and reviewed separately; it is not evidence that production has already applied it.
- Catalog inspection found broad table privilege grants (98 privilege rows per each of anon, authenticated, and service_role across 14 public tables). RLS is not a substitute for least-privilege table grants. `admin_audit_logs` currently has no permitting policy, but the broad grants still require correction via a reviewed migration.
- The schema dump at `artifacts/schema-audit/production-public-schema.sql` is local-only and has not been committed. Its existence and size were checked in the user's PowerShell session, but a line-by-line normalized dump diff has not yet been recorded in Git.

## Differences and uncertainties that remain

1. **Migration ledger versus repository filenames:** remote ledger versions do not equal local filenames 001–003. Object similarity does not prove migration-history equivalence.
2. **Complete schema diff is pending:** column attributes, defaults, constraints, function definitions and ownership, grants/default privileges, comments, extensions, event triggers, publications, and index definitions still need an automated normalized comparison against the complete dump. The catalog spot-check is not a substitute.
3. **Privilege drift:** live table grants are broader than the explicit grants in the legacy foundation migration.
4. **Admin audit access:** production has no permitting policy on `admin_audit_logs`, but broad browser-role table grants remain. Test the proposed hardening migration and verify browser roles cannot access the table while trusted server access remains functional.
5. **Auth settings:** provider enablement and redirect/URL settings have not been independently verified.
6. **Projects migration:** `public.projects` is absent in production; the additive projects migration is not part of the legacy baseline and must be tested separately.

## Replay-safe strategy

### Phase A — local-only baseline test

1. Synchronize the local checkout to the reviewed `origin/backend` without deleting untracked artifacts.
2. Inspect `git status` and confirm the local schema dump remains present.
3. Use the existing local PostgreSQL 17 server to create a disposable empty database. No Docker is used. Bootstrap only the compatibility objects the SQL needs (roles, `auth.users`, `auth.uid()`, and `supabase_realtime` publication if supported); keep the bootstrap separate from application migrations and document that it is not a full Supabase environment. Never point test commands at the linked production project.
4. Replay migrations 001, 002, and 003 in order against the empty disposable database. Treat any failure as a blocker; do not use `IF NOT EXISTS` wrappers or manual catalog edits to hide ordering errors.
5. Capture the local PostgreSQL catalog and normalized schema dump, then compare it with production evidence. Record each difference with object name, production definition, replay definition, and disposition (expected drift, unexplained drift, or proposed fix). Note that the uploaded production dump omitted ACLs, event-trigger definitions, publication membership, and extension inventory; separate read-only catalog queries have now confirmed live `ensure_rls` and `activity_logs` publication membership.
6. Test `20261010080000_harden_admin_audit_log_access.sql` separately on a copy of the replayed database. Assert browser roles have no table privileges and cannot read or write audit rows, and service_role retains the required trusted-server access.
7. Test `20261010070000_create_projects.sql` only as a separate additive feature migration. Do not include it in the canonical legacy baseline comparison.

### Phase B — history reconciliation proposal

1. Obtain an authoritative export of the remote migration ledger and retain it as evidence.
2. Map each remote timestamped version to the exact historical SQL content that was actually executed, using reviewed commits and deployment records. The three known versions appear to represent incremental edits to migration 001; verify their exact SQL bodies before proposing any repair.
3. Do not mark 001, 002, or 003 as applied until there is documentary evidence of their complete effects and the mapping is reviewed. In particular, 002 and 003 include distinct policy/trigger/publication changes that must be accounted for.
4. Prefer a forward-only, timestamped reconciliation migration for any genuine remaining schema correction. It should be independently replay-tested and idempotent where safe, with explicit preconditions that fail loudly if the live schema is not as expected.
5. Any migration-ledger repair must be a separate, reviewed operational decision after comparing exact SQL history and live catalog state. Do not combine it with schema DDL, and do not infer success from a matching object name.
6. Only after approval, schedule production deployment with a fresh backup, preflight checks, post-deployment catalog assertions, and a rollback/forward-fix plan.

## Safety invariants

- Never run `supabase db push`, `supabase migration repair`, or a linked reset against production during reconciliation.
- Never edit the production schema merely to make it match a guessed migration history.
- Never mark a migration applied without verified evidence of its complete effects.
- Never run destructive reset commands against a database unless the target is positively confirmed disposable and local.
- Keep the production dump, connection strings, access tokens, and credentials out of Git.
- Preserve the live `blueprint_submission_lock` behavior and the SECURITY DEFINER function's restricted execution grants.

## Local validation commands

Run from the repository root after synchronization:

```powershell
git status -sb
git log -1 --oneline
Get-Item artifacts/schema-audit/production-public-schema.sql | Select-Object FullName,Length
supabase --version
supabase status
```

The user uses PostgreSQL 17 directly and does not use Docker. The reviewed branch has no checked-in `supabase/config.toml`, so do not assume a Supabase CLI stack can be started. Use a disposable local PostgreSQL database with a documented compatibility bootstrap, and label the result PostgreSQL-only validation—not a full Supabase-stack replay. Do not invent a config file or run `supabase init` over existing files blindly.

## Exit criteria for Gate 1

- Local branch equals reviewed `origin/backend` and local untracked audit artifacts are preserved.
- Complete normalized schema diff is committed with no unexplained differences.
- PostgreSQL-only replay of 001–003 succeeds from empty state with the compatibility bootstrap documented; this is not claimed to be a full Supabase-stack test.
- Proposed hardening migration passes explicit grants/RLS assertions on the isolated database.
- Remote migration-history mapping is reviewed and the final strategy explicitly distinguishes verified historical changes from unresolved entries.
- Supabase Auth provider and redirect settings are independently verified.

## Results from the uploaded production dump review

The complete uploaded PostgreSQL dump was inspected against migrations 001, 002, 003, `20261010070000_create_projects.sql`, and `20261010080000_harden_admin_audit_log_access.sql`. Detailed object-level findings are recorded in `docs/schema-migration-reconciliation-2026-10-10.md`.

The dump corroborates the 14 legacy tables, four enums, legacy constraints/indexes, RLS and current policy definitions, the blueprint submission-lock function/trigger, and the activity-policy replacement. It does **not** contain GRANT/REVOKE/default-privilege statements, the `ensure_rls` event trigger, publication membership, or extension inventory. These are evidence-coverage gaps, not proof that those production objects are absent. A separate ACL/event-trigger/publication/extension export is required before the baseline can be considered complete.

The proposed audit hardening migration is absent from the live dump as expected. The projects migration is absent as expected. Neither should be silently folded into the legacy baseline.

## Current execution status

- Repository-side comparison findings: documented on `backend`.
- Local checkout synchronization: user confirmed local `backend` and `origin/backend` point to commit `ff5bc6e`; the local dump exists and is 31,492 bytes.
- Exact normalized production-versus-replay diff: **not run**; no replayed local schema dump is available yet.
- PostgreSQL-only replay: **not run yet** from this assistant environment because the user's local PostgreSQL server is not remotely executable through the connected tools. The user does not use Docker; no Docker steps should be requested. A local disposable PostgreSQL replay can be driven by the owner using the existing PostgreSQL 17 installation, while repository-side CI remains separate evidence.
- Production schema and migration ledger: unchanged by this work.

