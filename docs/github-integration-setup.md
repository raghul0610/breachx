# ANCHON GitHub repository connection

This feature connects a signed-in ANCHON user to GitHub and lists repositories available to the authorized GitHub identity. It does not yet clone, inspect source files, or modify repositories.

## 1. Create/configure the GitHub App

Create a GitHub App under the account that will own ANCHON's integration. Set the user authorization callback URL to the deployed Supabase Edge Function URL:

`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/github-connect-callback`

Use the GitHub App client ID and client secret. Configure the minimum repository permissions needed for metadata and contents read. Install the app only on repositories the user wants ANCHON to access. Avoid write permissions in this phase.

## 2. Configure Supabase Edge Function secrets

Set these secrets in the Supabase project before deploying the functions:

- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` (same callback URL configured on GitHub)
- `GITHUB_OAUTH_STATE_SECRET` (long random secret used to sign OAuth state)
- `GITHUB_TOKEN_ENCRYPTION_KEY` (base64-encoded 32 random bytes for AES-256-GCM)
- `ANCHON_APP_URL` (the exact deployed ANCHON origin, no trailing slash)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never put the GitHub client secret, encryption key, or service-role key in Vite environment variables or frontend code. Generate the encryption key with a trusted local cryptographic tool, e.g. Node: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## 3. Deploy

Apply the migration, then deploy all three functions:

- `github-connect-start`
- `github-connect-callback`
- `github-repositories`

The browser invokes `github-connect-start` and `github-repositories` using the signed-in user's Supabase session. The callback verifies a signed, time-limited state, exchanges the one-time authorization code server-side, encrypts the access token with AES-GCM, and stores it in a table that authenticated browser users cannot write to. Only the backend service role can read token ciphertext.

## 4. Security and limitations

- The browser never receives the GitHub access token.
- Do not enable broad write permissions for this read-only phase.
- Review the GitHub App's actual permission model and installation scope before production rollout. Repository visibility is constrained by the GitHub identity and app installation/permissions.
- OAuth state is signed and expires after 10 minutes. Consider adding a single-use nonce table/check before production if replay resistance beyond the one-time GitHub code is required.
- Repository listing is capped at the first 100 entries in this initial version; pagination can be added.
- Disconnect/revoke, installation webhooks, token rotation/revocation, audit logging, source-code ingestion, and architecture analysis are follow-up work.
- Do not process source code or execute project scripts on the application server. Source analysis should run in an isolated worker/sandbox.
