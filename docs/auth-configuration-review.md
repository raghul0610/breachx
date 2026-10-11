# Authentication configuration review

## Repository findings

The `backend` branch contains the authentication UI in `src/components/AuthGate.tsx`:

- Email/password sign-up and sign-in.
- Google OAuth initiation.
- Password-reset email request.
- Session gating and an auth-state subscription.
- Owner-scoped cloud project synchronization through `src/lib/projectsRepository.ts`.

The Supabase browser client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the environment. This confirms the client-side integration only; it does not prove that the provider configuration is enabled in Supabase. The live Supabase project is `ACTIVE_HEALTHY` on PostgreSQL 17.11.0.003.

## Required Supabase Dashboard verification

Open the BreachX project (`wjxenruxeudkgqinbodv`) and inspect Authentication → Sign In / Providers and URL Configuration.

- [x] Email provider and Google OAuth settings verified by the operator in the Supabase Dashboard (2026-10-11).
- [x] Site URL and allowed redirect URLs saved and verified by the operator (2026-10-11).
- [x] Google provider enabled (operator-confirmed; 2026-10-11).
- [x] Google OAuth client configuration saved in Supabase provider settings (operator-confirmed; 2026-10-11).
- [ ] Verify email confirmation, password-reset, and Google callback behavior with real accounts.
- [x] Site URL and allowed redirect URLs saved (operator-confirmed; 2026-10-11).
- [ ] Confirm the local development origin is allowlisted if local auth testing is required.
- [x] Production origin and redirect allowlist saved (operator-confirmed; 2026-10-11).
- [ ] Email confirmation and password-reset links return to the app.
- [ ] No service-role key or OAuth client secret is present in any `VITE_*` variable.
- [x] Leaked-password protection recorded as a known plan limitation: the operator confirms it requires Supabase Pro. Leave disabled on the current plan; it is not a release gate for this deployment.

The app currently sets sign-up, password-reset, and Google OAuth redirect targets to `window.location.origin`. Keep the Site URL and allowed redirect URLs aligned with that behavior; if client-side routes are introduced, update the target and allowlist together.

## Required real-flow verification

- [ ] Create a new email account and complete confirmation if enabled.
- [ ] Sign in and sign out.
- [ ] Complete Google OAuth.
- [ ] Request and complete password reset.
- [ ] Sign in as User A, create/edit a project, refresh, and confirm cloud persistence.
- [ ] Sign in as User B and confirm User A's projects are neither visible nor mutable.
- [ ] Switch back to User A and confirm the original project remains.
- [ ] Check browser console, network responses, and Supabase logs for errors.

Provider and redirect settings above are operator-confirmed, not independently read through the connector. Real-flow checks still require the deployed app session; do not mark them complete based on source inspection or the `auth.users` row count.


## Live security-advisor findings (read-only, 2026-10-11)

The Supabase Security Advisor returned two findings:

- **WARN — Leaked Password Protection Disabled:** compromised-password checking against HaveIBeenPwned.org is disabled. Review and enable this in Auth password-security settings as a separate configuration change; no setting was changed during this review.
- **INFO — RLS Enabled No Policy:** `public.admin_audit_logs` has RLS enabled and no policies. This aligns with the documented intention that browser clients cannot read or write audit logs. Verify the trusted server-side write path separately; do not add a broad client policy merely to silence the advisory.

The advisor output does not expose Email/Google provider credentials or URL configuration; the operator subsequently confirmed that providers and redirect URLs were saved. This does not prove that the end-to-end flows or project persistence work.
