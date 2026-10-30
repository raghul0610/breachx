# AI endpoint security

The serverless AI routes `/api/evaluate` and `/api/generate-architecture` require an authenticated Supabase session and share the controls in `api/_shared/security.ts`.

## Required server-side configuration

Set these in Vercel Preview and Production project settings. Do not prefix server secrets with `VITE_`.

- `OPENROUTER_API_KEY`: provider credential.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: validate bearer access tokens. Never use a Supabase `service_role` key here.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: shared atomic rate limiter.
- `OPENROUTER_MODEL` and `APP_URL` are optional.

The verifier accepts existing public Supabase `VITE_*` aliases for migration compatibility. Prefer server-side names. Vercel deployments fail closed with HTTP 503 if shared Redis limiting is not configured or unavailable; only local development uses process-local counters.

## Controls

- POST only; JSON content type required.
- Enforce request byte limits before AI-provider calls.
- IP limit: 20 AI requests per minute.
- Authenticated-user limit: 8 AI requests per minute, shared across both endpoints.
- Supabase access tokens are verified with Auth `getUser(token)`; client-supplied user IDs are not trusted.
- Evaluation payloads have bounded node/edge counts, unique node IDs, valid edge endpoints, and field-size limits.
- Generator/edit requests validate application name, requirements, instruction size, and graph collection bounds.
- Upstash uses an atomic Redis Lua script (`INCR` + `EXPIRE`) so limits are shared across serverless instances. HTTP 429 includes `Retry-After`.
- Supabase Auth, Redis, and OpenRouter calls have timeouts. Provider error bodies are never returned to the client.
- API routes, tests, and ambient server types are included in TypeScript build checking and CI.

## Database boundary

The `projects` table uses RLS with owner-scoped SELECT/INSERT/UPDATE/DELETE policies and browser access limited to the authenticated role. The `admin_audit_logs` hardening migration revokes browser-role grants and adds deny policies. These SQL protections are separate from API rate limiting and should be validated against the actual Supabase project before applying migrations.

## Release checklist

1. Configure all required server-side variables in both Vercel Preview and Production.
2. Verify anonymous and invalid-token requests return 401.
3. Verify oversized bodies return 413, invalid payloads return 400, non-JSON requests return 415, and non-POST requests return 405.
4. Verify bursts return 429 with `Retry-After`.
5. Verify Redis outage returns 503 without calling OpenRouter.
6. Verify provider timeout returns 504 and upstream failure bodies/secrets are not exposed.
7. Verify project RLS using two separate authenticated users in a disposable Supabase-compatible database.
8. Do not apply database migrations to production as part of this API hardening change.
