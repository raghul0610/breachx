begin;

create table public.project_shares (
  token text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index project_shares_project_idx on public.project_shares (project_id);
alter table public.project_shares enable row level security;
revoke all on table public.project_shares from anon, authenticated;
grant select, insert, update, delete on table public.project_shares to authenticated;

create policy project_shares_select
  on public.project_shares for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy project_shares_insert
  on public.project_shares for insert to authenticated
  with check ((select auth.uid()) = owner_id and exists (
    select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())
  ));

create policy project_shares_update_own
  on public.project_shares for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy project_shares_delete_own
  on public.project_shares for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.resolve_project_share(share_token text)
returns table (
  id uuid,
  owner_id uuid,
  application_name text,
  application_description text,
  nodes jsonb,
  edges jsonb,
  notes text,
  workload jsonb,
  viewport jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.owner_id, p.application_name, p.application_description,
         p.nodes, p.edges, p.notes, p.workload, p.viewport, p.status,
         p.created_at, p.updated_at
  from public.project_shares s
  join public.projects p on p.id = s.project_id
  where s.token = share_token and s.revoked = false;
$$;

revoke all on function public.resolve_project_share(text) from public, anon, authenticated;
grant execute on function public.resolve_project_share(text) to authenticated;

commit;