-- Breach X backend foundation
-- Authentication is intentionally NOT implemented here.
-- All user references are prepared for Supabase Auth via auth.users.

create extension if not exists pgcrypto;

create type public.user_role as enum ('PARTICIPANT', 'ADMIN', 'JUDGE');
create type public.event_status as enum ('DRAFT', 'READY', 'LIVE', 'PAUSED', 'ENDED');
create type public.blueprint_status as enum ('DRAFT', 'SUBMITTED');
create type public.judging_status as enum ('DRAFT', 'FINAL');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'PARTICIPANT',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.event_status not null default 'DRAFT',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_config (
  event_id uuid primary key references public.events(id) on delete cascade,
  blueprint_submission_deadline timestamptz,
  min_nodes integer not null default 3 check (min_nodes >= 0),
  min_edges integer not null default 2 check (min_edges >= 0),
  allow_resubmission boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(event_id, slug)
);

create table public.problem_statements (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  title text not null,
  statement text not null,
  difficulty text not null default 'ADVANCED',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(event_id, name)
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(team_id, user_id)
);

create table public.problem_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete restrict,
  problem_statement_id uuid not null references public.problem_statements(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique(event_id, team_id)
);

create table public.blueprints (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  problem_assignment_id uuid not null references public.problem_assignments(id) on delete restrict,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb not null default '{}'::jsonb,
  notes text not null default '',
  status public.blueprint_status not null default 'DRAFT',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, team_id)
);

create table public.blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.blueprints(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  nodes jsonb not null,
  edges jsonb not null,
  viewport jsonb not null default '{}'::jsonb,
  notes text not null default '',
  status public.blueprint_status not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(blueprint_id, version_number)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.judging_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  blueprint_id uuid not null references public.blueprints(id) on delete cascade,
  judge_id uuid not null references auth.users(id) on delete cascade,
  security_architecture numeric(5,2) not null default 0 check (security_architecture between 0 and 30),
  threat_modeling numeric(5,2) not null default 0 check (threat_modeling between 0 and 20),
  scalability numeric(5,2) not null default 0 check (scalability between 0 and 15),
  reliability numeric(5,2) not null default 0 check (reliability between 0 and 15),
  architecture_quality numeric(5,2) not null default 0 check (architecture_quality between 0 and 10),
  innovation numeric(5,2) not null default 0 check (innovation between 0 and 10),
  comments text not null default '',
  status public.judging_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(blueprint_id, judge_id)
);

create index idx_tracks_event on public.tracks(event_id);
create index idx_problems_track on public.problem_statements(track_id);
create index idx_teams_event on public.teams(event_id);
create index idx_team_members_user on public.team_members(user_id);
create index idx_assignments_team on public.problem_assignments(team_id);
create index idx_blueprints_event on public.blueprints(event_id);
create index idx_activity_event_created on public.activity_logs(event_id, created_at desc);
create index idx_audit_event_created on public.admin_audit_logs(event_id, created_at desc);
create index idx_scores_blueprint on public.judging_scores(blueprint_id);

-- RLS: every exposed table is protected.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.event_config enable row level security;
alter table public.tracks enable row level security;
alter table public.problem_statements enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.problem_assignments enable row level security;
alter table public.blueprints enable row level security;
alter table public.blueprint_versions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.judging_scores enable row level security;

-- Profile / role self-read. Admin-wide policies are added when authentication is integrated.
create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "roles_self_select" on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Participants can read event configuration needed for the client, but writes are backend-controlled.
create policy "events_authenticated_select" on public.events
  for select to authenticated
  using (true);

create policy "event_config_authenticated_select" on public.event_config
  for select to authenticated
  using (true);

create policy "tracks_authenticated_select" on public.tracks
  for select to authenticated
  using (true);

create policy "problems_authenticated_select" on public.problem_statements
  for select to authenticated
  using (is_active = true);

-- Team membership is private to the member.
create policy "team_members_self_select" on public.team_members
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "teams_member_select" on public.teams
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "assignments_team_select" on public.problem_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = problem_assignments.team_id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "blueprints_team_select" on public.blueprints
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = blueprints.team_id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "blueprints_team_insert" on public.blueprints
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = blueprints.team_id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "blueprints_team_update" on public.blueprints
  for update to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = blueprints.team_id
        and tm.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = blueprints.team_id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "blueprint_versions_team_select" on public.blueprint_versions
  for select to authenticated
  using (
    exists (
      select 1
      from public.blueprints b
      join public.team_members tm on tm.team_id = b.team_id
      where b.id = blueprint_versions.blueprint_id
        and tm.user_id = (select auth.uid())
    )
  );

create policy "activity_team_select" on public.activity_logs
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = activity_logs.team_id
        and tm.user_id = (select auth.uid())
    )
  );

-- Judges can only see and score submitted blueprints; admin-wide policies are added with admin integration.
create policy "judge_scores_self_select" on public.judging_scores
  for select to authenticated
  using ((select auth.uid()) = judge_id);

create policy "judge_scores_self_insert" on public.judging_scores
  for insert to authenticated
  with check ((select auth.uid()) = judge_id);

create policy "judge_scores_self_update" on public.judging_scores
  for update to authenticated
  using ((select auth.uid()) = judge_id)
  with check ((select auth.uid()) = judge_id);

-- Audit logs are intentionally not client-writable. Sensitive writes belong in trusted backend operations.


-- Prototype phase: public read-only event catalog.
-- Event mutation and participant-owned data remain authenticated-only.
grant select on public.events to anon;
grant select on public.event_config to anon;
grant select on public.tracks to anon;
grant select on public.problem_statements to anon;

create policy "events_anon_select" on public.events
  for select to anon using (true);

create policy "event_config_anon_select" on public.event_config
  for select to anon using (true);

create policy "tracks_anon_select" on public.tracks
  for select to anon using (true);

create policy "problems_anon_select" on public.problem_statements
  for select to anon using (is_active = true);


-- Security hardening: this internal SECURITY DEFINER helper must not be callable through the public API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
