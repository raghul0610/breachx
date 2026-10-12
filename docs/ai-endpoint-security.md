# AI endpoint security configuration

Both serverless AI endpoints require an authenticated Supabase user and apply server-side input limits.

## Required production environment variables

Configure these in the Vercel project settings for the deployment environment:

- `OPENROUTER_API_KEY`: OpenRouter credential. Server-side only; never prefix it with `VITE_`.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable key (or legacy anon key). Do not use `service_role` for token verification.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST endpoint and token used by the atomic shared rate limiter.
- `OPENROUTER_MODEL`: optional model override.
- `APP_URL`: optional OpenRouter HTTP-Referer.

The Supabase verifier also accepts the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` aliases. Prefer the server-only names above to make the trust boundary clear.

**Production fails closed** if the shared Redis limiter is missing or unavailable. Configure and test Upstash before deploying this branch; otherwise AI requests return HTTP 503 instead of calling the paid provider without shared rate limiting. Local development can use the process-local fallback, which is not suitable for production.

## Controls implemented

- Both endpoints accept POST only.
- A valid Supabase access token is required in `Authorization: Bearer <access-token>`. The server calls Supabase Auth `getUser(token)`; it does not trust a user ID supplied in the request.
- Evaluation payloads are limited to 64 KiB, 100 nodes, 200 edges, bounded text fields, unique node IDs, and edges whose endpoints exist in the submitted graph.
- Generation payloads are limited to 16 KiB; names are at most 120 characters and requirements at most 8,000 characters.
- A shared atomic Redis sliding-window counter enforces at most 8 AI requests per user per minute and 20 per IP per minute across both endpoints. A 429 response includes `Retry-After`.
- Supabase verification and provider requests have timeouts. Provider errors are returned generically without echoing upstream error bodies.
- The OpenRouter key is read only from server-side `process.env`. It is never included in browser requests or responses.

## Release checklist

1. Set the required server-side variables in Vercel Preview before testing.
2. Verify anonymous requests and invalid/expired tokens receive 401.
3. Verify malformed payloads receive 400 and oversized requests receive 413.
4. Verify repeated requests receive 429 and a `Retry-After` header.
5. Verify provider failures return 502 without upstream response details.
6. Verify both AI actions work for a signed-in account and fail closed if Redis configuration is removed in a non-production test deployment.
7. Do not merge or deploy until CI passes and the Vercel Preview behavior is checked.

This change does not modify Supabase schema, production data, migration history, or Supabase Auth provider settings.
