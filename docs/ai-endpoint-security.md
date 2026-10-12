# AI endpoint security configuration

Both serverless AI endpoints (`api/evaluate.ts`, `api/generate-architecture.ts`) require an
authenticated Supabase user and apply server-side input limits and abuse controls. All shared
controls live in `api/_shared/security.ts` and are applied by a single call at the top of each
handler, so the two endpoints cannot drift apart.

## Required server-side environment variables

Configure these in the Vercel project settings for each deployment environment (Production and
Preview). None of them may be prefixed with `VITE_`, because Vite inlines `VITE_*` values into the
browser bundle.

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | OpenRouter credential. Server-side only. |
| `SUPABASE_URL` | yes | Supabase project URL used to verify access tokens. |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable key (or legacy anon key). **Never use `service_role` here.** |
| `UPSTASH_REDIS_REST_URL` | yes in deployed envs | Upstash Redis REST endpoint for the shared rate limiter. |
| `UPSTASH_REDIS_REST_TOKEN` | yes in deployed envs | Upstash Redis REST token. |
| `OPENROUTER_MODEL` | no | Model override; defaults to `openrouter/free`. |
| `APP_URL` | no | Value sent as the OpenRouter `HTTP-Referer`. |

The token verifier also accepts the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
aliases so an existing Preview project keeps working. Prefer the server-only names above to keep the
trust boundary explicit. Both of those values are public by design; no secret is read from a `VITE_*`
variable.

### Preview configuration

Preview deployments run with `VERCEL=1`, so **they fail closed exactly like Production**: if
`UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing or the store is unreachable, AI
requests return `503` instead of calling the paid provider without shared abuse controls. Set the
Upstash variables for the Preview environment before testing a PR, or both AI features will return
`503` by design.

Only local development (no `VERCEL`, `NODE_ENV` not `production`) falls back to a process-local
in-memory counter. That fallback is per-instance and is not suitable for any deployed environment.

## Controls implemented

Checks run in this order, so the cheapest rejections happen before any network call:

1. **Method** — anything other than `POST` returns `405` with an `Allow: POST` header.
2. **Content type** — a missing or non-JSON `Content-Type` returns `415`. This runs before body
   inspection so a non-JSON request is not misreported as a malformed body.
3. **Request size** — an oversized declared `Content-Length` returns `413`; the parsed body is then
   re-measured by UTF-8 byte length so a request that omits `Content-Length` is still bounded.
   Limits: 64 KiB for evaluation, 16 KiB for generation.
4. **Body shape** — a non-object, array, string, `null` or unserialisable body returns `400`.
5. **Per-IP rate limit** — 20 requests/minute per IP, enforced *before* token verification so an
   unauthenticated flood cannot amplify into unbounded Supabase Auth requests.
6. **Authentication** — a valid Supabase access token is required in
   `Authorization: Bearer <access-token>`. The server calls Supabase Auth `getUser(token)` with a
   5-second timeout. A user ID supplied in the request body is never trusted.
7. **Per-user rate limit** — 8 requests/minute per authenticated user, shared across both endpoints.
8. **Payload validation** — required fields, types, string lengths, array sizes, unique node IDs and
   edges whose endpoints exist in the submitted graph.

Rate limiting uses an atomic Redis fixed-window counter (`INCR` + `EXPIRE` in a single Lua `EVAL`),
so concurrent serverless instances share one count. A `429` response includes `Retry-After`.

Provider handling:

- Requests to OpenRouter carry a 20-second timeout.
- A timeout returns `504`; any other provider or parsing failure returns `502`.
- Upstream response bodies, stack traces and credentials are never echoed to the client. The
  previous `details: errorText` field has been removed.
- `OPENROUTER_API_KEY` is read only from `process.env` inside the function, is sent only in the
  `Authorization` header of the outbound provider request, and never appears in a response body,
  response header or log line.

### Why `maxDuration` and not `bodyParser`

Each handler exports `config = { maxDuration: 30 }`. The `api: { bodyParser: { sizeLimit } }` form is
a **Next.js**-only option and is not honoured by the standalone Vercel Node runtime used here, so
relying on it would have given a false sense of protection. The authoritative size limit is the
in-handler byte check described above.

## Type and test coverage

`api/` and `tests/` were previously outside every `tsconfig` project, so `npm run build` typechecked
neither. A corrupted line in `api/evaluate.ts` (literal `\n` escapes instead of newlines) shipped to
the `backend` branch undetected as a result. `tsconfig.api.json` now covers `api`, `tests` and
`types`, and is referenced from `tsconfig.json`, so `tsc -b` — and therefore `npm run build` and CI
— fail on that class of defect.

`tests/aiEndpointSecurity.test.ts` exercises the handlers directly with a mocked Supabase client and
a mocked `fetch`. It never calls a real AI provider and needs no production credentials.

## Release checklist

1. Set the required server-side variables in Vercel Preview before testing, including Upstash.
2. Verify anonymous requests, malformed `Authorization` headers, and invalid/expired tokens get `401`.
3. Verify malformed payloads get `400`, oversized requests `413`, non-JSON content types `415`, and
   non-`POST` methods `405` with `Allow: POST`.
4. Verify repeated requests get `429` with a `Retry-After` header.
5. Verify provider failures return `502` (timeouts `504`) with no upstream response details.
6. Verify both AI actions work for a signed-in account, and that removing the Upstash variables in a
   throwaway Preview deployment makes them fail closed with `503`.
7. Do not merge or deploy until CI passes and the Vercel Preview behaviour is checked.

This change does not modify Supabase schema, production data, migration history, Supabase Auth
provider settings, or any row-level security policy.
