# AI endpoint security

The serverless AI routes `/api/evaluate` and `/api/generate-architecture` require an authenticated Supabase session and share the controls in `api/_shared/security.ts`.

## Required server-side configuration

Set these in Vercel Preview and Production project settings. Do not prefix server secrets with `VITE_`.

- `OPENROUTER_API_KEY`: provider credential.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: validate bearer access tokens. Never use a Supabase `service_role` key here.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: shared atomic rate limiter.
- `OPENROUTER_MODEL` is optional; the generator defaults to `openai/gpt-5-mini`. A configured `openrouter/free` value is ignored by the generator. Set `OPENROUTER_MODEL=openai/gpt-5-mini` explicitly in Vercel Preview and Production.
- `APP_URL` is optional.

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
- Supabase Auth and Redis calls have bounded timeouts. Architecture generation has an 18-second total OpenRouter budget within a 30-second Vercel function limit: the initial attempt is capped at 12 seconds and one correction attempt at 6 seconds, sharing the same deadline.
- Generator logs are structured JSON and record model, attempt, provider HTTP status, latency, timeout classification, and safe request ID metadata. They never include API keys, bearer tokens, prompts, requirements, user IDs, or provider response bodies.
- API routes, tests, and ambient server types are included in TypeScript build checking and CI.

## Database boundary

The `projects` table uses RLS with owner-scoped SELECT/INSERT/UPDATE/DELETE policies and browser access limited to the authenticated role. The `admin_audit_logs` hardening migration revokes browser-role grants and adds deny policies. These SQL protections are separate from API rate limiting and should be validated against the actual Supabase project before applying migrations.

## Release checklist

1. Configure all required server-side variables in both Vercel Preview and Production. Confirm `OPENROUTER_MODEL=openai/gpt-5-mini` and that the deployed Vercel plan supports the route's 30-second `maxDuration`.
2. Verify anonymous and invalid-token requests return 401.
3. Verify oversized bodies return 413, invalid payloads return 400, non-JSON requests return 415, and non-POST requests return 405.
4. Verify bursts return 429 with `Retry-After`.
5. Verify Redis outage returns 503 without calling OpenRouter.
6. Verify provider timeout returns 504 and upstream failure bodies/secrets are not exposed.
7. Verify project RLS using two separate authenticated users in a disposable Supabase-compatible database.
8. Do not apply database migrations to production as part of this API hardening change.
