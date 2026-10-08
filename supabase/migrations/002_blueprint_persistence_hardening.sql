-- Blueprint persistence hardening.
-- Applied to Breach X production during implementation; keep this file for reproducibility.

create policy "blueprint_versions_team_insert"
on public.blueprint_versions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.blueprints b
    join public.team_members tm on tm.team_id = b.team_id
    where b.id = blueprint_versions.blueprint_id
      and tm.user_id = (select auth.uid())
  )
);

create policy "activity_team_insert"
on public.activity_logs
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from public.team_members tm
    where tm.team_id = activity_logs.team_id
      and tm.user_id = (select auth.uid())
  )
);

create or replace function public.enforce_blueprint_submission_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'SUBMITTED'::blueprint_status then
    raise exception 'Blueprint is already submitted and locked';
  end if;

  if new.event_id <> old.event_id
     or new.team_id <> old.team_id
     or new.problem_assignment_id <> old.problem_assignment_id then
    raise exception 'Blueprint ownership and assignment are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists blueprint_submission_lock on public.blueprints;

create trigger blueprint_submission_lock
before update on public.blueprints
for each row
execute function public.enforce_blueprint_submission_lock();
