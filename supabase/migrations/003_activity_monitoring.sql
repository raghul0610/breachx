-- Activity monitoring hardening
-- Applied to Breach X project before committing this migration.

drop policy if exists activity_team_select on public.activity_logs;

create policy activity_participant_or_admin_select
on public.activity_logs
for select
to authenticated
using (
  actor_id = (select auth.uid())
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = activity_logs.team_id
      and tm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ADMIN'::public.user_role
  )
);

alter publication supabase_realtime add table public.activity_logs;
