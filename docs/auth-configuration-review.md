# Authentication configuration review

## Code findings (repository inspection)

- The Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- The existing data helper calls `supabase.auth.getUser()`; this checks for a current user but is not a sign-in flow.
- No sign-in/sign-up implementation, Google OAuth initiation, or auth-state subscription was found in the inspected app files.
- The inspected production database had zero rows in `auth.users` at capture time. This does not establish which providers are enabled.

## Required dashboard verification

Open Supabase Dashboard > Authentication > Sign In / Providers and URL Configuration.

- [ ] Email provider enabled.
- [ ] Email confirmation policy matches desired onboarding.
- [ ] Google provider enabled.
- [ ] Google OAuth client ID and secret configured in Supabase provider settings.
- [ ] Site URL set to production URL.
- [ ] Local redirect URL allowlisted for development.
- [ ] Production callback/redirect URL allowlisted.
- [ ] Password reset and OAuth callback return paths verified.
- [ ] No service-role key or OAuth client secret is present in frontend/Vite variables.

Provider configuration is managed outside SQL migrations. This repository review cannot truthfully mark those dashboard checks as verified.
