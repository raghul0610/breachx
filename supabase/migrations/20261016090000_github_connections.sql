create table if not exists public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_login text not null,
  installation_id bigint not null unique,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.github_connections enable row level security;
create policy "Users can read their GitHub connection metadata"
  on public.github_connections for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.github_connections from anon, authenticated;
grant select on public.github_connections to authenticated;
