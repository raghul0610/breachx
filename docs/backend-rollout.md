# ANCHON backend rollout

## Application changes on `backend`

- Email/password sign-up and sign-in, password-reset request, Google OAuth initiation, session handling, and sign-out are wired through Supabase Auth.
- The app requires an authenticated session before opening the workspace.
- Project rows are loaded from `public.projects` and merged into the local-first cache. On a first sign-in, anonymous local projects are migrated to that account; when switching between known accounts, the previous account's local cache is replaced before syncing to prevent cross-account leakage.
- Local project changes are synchronized to the owner-scoped `projects` table. Unchanged project payloads are skipped so unrelated rows' `updated_at` values are not continually refreshed.
- Project deletion is sent to Supabase before removing the local cache entry.
- Submitted standalone projects remain editable and keep their `submitted` status when edited. This does not change the separate legacy hackathon `blueprints` submission-lock behavior.

## Required Supabase configuration

The UI cannot enable hosted auth providers itself. In Supabase Dashboard → Authentication:

1. Enable Email and decide whether email confirmation is required.
2. Enable Google and configure the OAuth client in Supabase provider settings.
3. Set the production Site URL and allow the local development origin and production Vercel origin in redirect URLs.
4. Confirm that email confirmation, Google OAuth, and password-reset links return to the app.

Only the publishable key belongs in `VITE_SUPABASE_PUBLISHABLE_KEY`. Never expose a service-role key, database password, or Google OAuth client secret to browser code.

## Required environment variables

Configure these in the local ignored `.env.local` and the Vercel project environment settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the actual URL and publishable key from the target Supabase project. Do not commit real credentials.

## Regression gates

Before considering this rollout ready:

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Local migration sequence passes from a clean disposable database.
- [ ] SQL catalog assertions pass.
- [ ] Two-user RLS isolation passes.
- [ ] Email sign-up/confirmation/sign-in/sign-out works.
- [ ] Google OAuth works with configured redirect URLs.
- [ ] Password-reset email returns to the app.
- [ ] Existing local projects are migrated on first sign-in.
- [ ] Projects load after signing in on a second browser/device.
- [ ] Account switching never exposes the previous account's local project cache.
- [ ] Create, rename, duplicate, autosave, edit-submitted, and delete all persist in the cloud.
- [ ] Existing hackathon team/blueprint flows still behave as before.
- [ ] Production schema changes are reviewed and deployed separately.

Cloud persistence requires the `public.projects` migration to exist in the connected Supabase project. Until that migration is applied in a reviewed deployment, the new signed-in app cannot load project rows from a production database that lacks this table.
