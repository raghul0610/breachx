create table if not exists public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_login text not null,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.github_connections enable row level security;

-- Browser clients may see connection metadata, never the encrypted token.
create policy "Users can read their GitHub connection metadata"
  on public.github_connections for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.github_connections from anon, authenticated;
grant select on public.github_connections to authenticated;

create table if not exists public.github_oauth_states (
  nonce text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.github_oauth_states enable row level security;
revoke all on public.github_oauth_states from anon, authenticated;
