# Migration history reconciliation

## Current verified state

The production Supabase project is `wjxenruxeudkgqinbodv`. Its remote migration history currently contains only these versions:

- `20261008050118` — `allow_public_event_catalog_reads`
- `20261008050230` — `harden_public_security_definer`
- `20261008050245` — `remove_public_security_definer_execute`

The repository also contains legacy files named `001_breachx_backend_foundation.sql`, `002_blueprint_persistence_hardening.sql`, and `003_activity_monitoring.sql`, whose filenames do not match those remote versions. A timestamped `20261010070000_create_projects.sql` is the new additive migration. The cause of the mismatch has not been established.

**Do not run `supabase db push`, `supabase migration repair`, or `supabase db reset --linked` to make the lists appear aligned.** A repair changes migration-history metadata; a push can execute every local migration the CLI considers pending; a linked reset is destructive.

## Safe operator procedure

Run from the repository root in PowerShell. These commands are intentionally staged.

1. Confirm the working tree is clean and the current branch is `backend`.
2. Install/use the Supabase CLI and initialize its local configuration if missing:

   ```powershell
   npx supabase --version
   npx supabase init
   npx supabase login
   npx supabase link --project-ref wjxenruxeudkgqinbodv
   ```

   `link` associates this local folder with the project; it does not apply a schema migration. Do not put an access token, database password, service-role key, or OAuth client secret in a committed file.

3. Compare local and remote history:

   ```powershell
   npx supabase migration list
   ```

   Save the full output. If local versions `001`, `002`, or `003` are shown as pending, stop; do not push them.

4. Capture a canonical remote schema migration using `npx supabase db pull`. Review the generated SQL before accepting any prompt to update remote migration history. That prompt affects migration metadata even though it does not apply the generated schema SQL. Do not accept it until the generated file and the history diff have been reviewed.

5. Compare the canonical schema with the three legacy migration files and with `docs/backend-production-baseline.md`. Determine whether each old migration's changes are represented in the canonical schema. Preserve the original files in Git history; do not delete or rewrite them until an explicit, reviewed baseline strategy has been chosen. The desired result is a reproducible local migration sequence that does not re-create objects already present in the canonical baseline.

6. Only after the local history and baseline strategy are reviewed, run `npx supabase start` and test the migration sequence against the local database. Never use `db reset --linked` for this.

7. Run `supabase/tests/projects_migration_assertions.sql` against the disposable/local database. Then test two-user RLS isolation with separate authenticated test accounts. Test that a user cannot read, update, or delete another user's project, cannot insert a row owned by another user, and can continue editing their own submitted project.

8. Record the exact CLI output, test results, and final migration-list output in the pull request. Production deployment is a separate reviewed step.

## What has and has not been done

The branch includes the additive projects migration and SQL catalog assertions. The remote migration list was inspected read-only. No production migration, migration repair, or production schema change has been run. No disposable Supabase branch was created; branch creation may incur cost and requires explicit cost confirmation. Therefore, migration-history reconciliation and live database tests remain **blocked pending a local CLI run or an explicitly approved disposable database**.
