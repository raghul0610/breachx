# ANCHON GitHub App integration

Phase 1 connects a signed-in ANCHON user to a GitHub App installation and lists repositories explicitly selected during installation. It does not yet ingest source code, analyse architecture, or modify repositories.

## GitHub App setup

Create a GitHub App and configure:
- App slug: used as `GITHUB_APP_SLUG`
- App ID: `GITHUB_APP_ID`
- Private key: `GITHUB_APP_PRIVATE_KEY`
- Setup URL/callback: `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/github-connect-callback`
- Repository permissions: **Contents: Read-only** and **Metadata: Read-only** for this phase.
- Install the app only on repositories the user chooses. Do not grant write access yet.

The user is sent to the GitHub App installation page. GitHub returns the signed state and installation ID to the configured Setup URL callback. The callback verifies state and the installation using a short-lived GitHub App JWT. The backend stores only the installation ID and account login, not an access token. A short-lived installation token is generated server-side when repositories are listed.

## Supabase secrets

Configure these Edge Function secrets:
- `GITHUB_APP_SLUG`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (PEM private key; preserve or replace escaped newline sequences)
- `GITHUB_OAUTH_STATE_SECRET` (long random signing secret)
- `ANCHON_APP_URL` (exact deployed ANCHON origin, no trailing slash)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never place the GitHub App private key or service-role key in frontend/Vite environment variables. Apply the migration and deploy `github-connect-start`, `github-connect-callback`, and `github-repositories`. Callback must have JWT verification disabled because GitHub calls it; the other functions require a valid Supabase user JWT.

## Security and current scope

- RLS allows users to read only their own connection metadata; clients cannot insert or update connections.
- The service role is used only in Edge Functions after validating the caller or signed OAuth state.
- State is HMAC-signed and expires after 10 minutes.
- The repository list endpoint returns up to 100 repositories in the selected installation.
- Disconnect/revoke, pagination, audit logging, webhook synchronization, source ingestion, and architecture analysis are follow-up tasks.
- Never execute repository scripts on the application server. Source analysis should run in an isolated worker/sandbox.
