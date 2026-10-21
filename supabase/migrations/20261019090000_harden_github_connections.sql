-- Harden GitHub connection metadata against default/public table grants.
-- OAuth installation identifiers and account metadata are readable only by the owning user.
-- Mutations remain trusted-server-only through the Supabase service role in Edge Functions.

begin;

alter table public.github_connections enable row level security;

revoke all on table public.github_connections from public, anon, authenticated;
grant select on table public.github_connections to authenticated;

drop policy if exists "Users can read their GitHub connection metadata" on public.github_connections;
create policy "Users can read their GitHub connection metadata"
  on public.github_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.github_connections is
  'GitHub App installation metadata. Owners may read their own connection; writes are server-only.';

commit;
