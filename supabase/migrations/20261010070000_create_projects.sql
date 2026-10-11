-- ANCHON standalone project persistence.
-- Additive only: intentionally separate from the legacy hackathon events/teams/blueprints model.
-- This migration is not approved for production until local/disposable testing passes and
-- the existing production migration-history discrepancy is reconciled.

begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  application_name text not null,
  application_description text not null default '',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  notes text not null default '',
  workload jsonb,
  viewport jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_status_check
    check (status in ('draft', 'submitted')),
  constraint projects_application_name_nonempty
    check (length(btrim(application_name)) > 0),
  constraint projects_nodes_array_check
    check (jsonb_typeof(nodes) = 'array'),
  constraint projects_edges_array_check
    check (jsonb_typeof(edges) = 'array'),
  constraint projects_workload_object_check
    check (workload is null or jsonb_typeof(workload) = 'object'),
  constraint projects_viewport_object_check
    check (viewport is null or jsonb_typeof(viewport) = 'object')
);

create index projects_owner_updated_at_idx
  on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

revoke all on table public.projects from anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;

create policy projects_select_own
  on public.projects
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy projects_insert_own
  on public.projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy projects_update_own
  on public.projects
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy projects_delete_own
  on public.projects
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_projects_updated_at() from public, anon, authenticated;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

comment on table public.projects is
  'Standalone ANCHON architecture projects; independent of legacy hackathon blueprints.';
comment on column public.projects.owner_id is
  'Authenticated owner, enforced by RLS. Client input must not be trusted to change ownership.';
comment on column public.projects.status is
  'draft or submitted. Submitted projects remain editable by their owner.';

commit;
