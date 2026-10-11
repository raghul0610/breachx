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

- [ ] Email provider enabled.
- [ ] Email confirmation policy matches the intended onboarding flow.
- [ ] Google provider enabled.
- [ ] Google OAuth client ID and secret configured in Supabase provider settings.
- [ ] Google Cloud OAuth redirect URI matches the callback URI shown by Supabase.
- [ ] Site URL set to the intended production origin: `https://breachx-ashy.vercel.app`.
- [ ] Exact local development origin allowlisted (normally `http://localhost:5173/**` when using Vite's default port).
- [ ] Production origin and app redirect paths allowlisted.
- [ ] Email confirmation and password-reset links return to the app.
- [ ] No service-role key or OAuth client secret is present in any `VITE_*` variable.
- [ ] Enable leaked-password protection after reviewing the expected sign-in UX. The live Supabase Security Advisor reported this protection as disabled on 2026-10-11; this setting has not been changed.

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

These checks require the actual Supabase Dashboard and deployed app session. Do not mark them complete based on source inspection or the `auth.users` row count.


## Live security-advisor findings (read-only, 2026-10-11)

The Supabase Security Advisor returned two findings:

- **WARN — Leaked Password Protection Disabled:** compromised-password checking against HaveIBeenPwned.org is disabled. Review and enable this in Auth password-security settings as a separate configuration change; no setting was changed during this review.
- **INFO — RLS Enabled No Policy:** `public.admin_audit_logs` has RLS enabled and no policies. This aligns with the documented intention that browser clients cannot read or write audit logs. Verify the trusted server-side write path separately; do not add a broad client policy merely to silence the advisory.

The advisor output does not expose the Email/Google provider credentials or URL configuration. Those still require a Dashboard review. This finding is not proof that sign-in flows work.
