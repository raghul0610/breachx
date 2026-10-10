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


## Authentication integration status

The `backend` branch now contains the email/password and Google OAuth UI, session gate, password-reset request, and owner-scoped cloud project sync. The UI code does not enable providers in Supabase automatically.

Before testing sign-in, open Supabase Dashboard → Authentication → Sign In / Providers:
- [ ] Enable Email; choose whether email confirmation is required.
- [ ] Enable Google and configure its client ID and client secret in Supabase's provider settings (never in `VITE_*` frontend variables).
- [ ] In Authentication → URL Configuration, set the production Site URL and add exact local and production redirect URLs, including the deployed Vercel origin.
- [ ] Confirm email confirmation and password-reset links return to the app.
- [ ] Test a new account, sign-in, sign-out, Google OAuth, and password-reset flow.

The current auth UI redirects to `window.location.origin`. If the app later adds client-side routes, update the redirect target and allowed URLs together.
