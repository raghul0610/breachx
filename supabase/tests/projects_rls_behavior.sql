-- Integration-style RLS regression test for an isolated PostgreSQL database.
-- CI bootstraps a minimal Supabase-compatible auth schema.
-- This script rolls back all test data and must never be pointed at production.

begin;

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.projects
  (id, owner_id, application_name, application_description, nodes, edges, notes, status)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'User one', '', '[]', '[]', '', 'submitted'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'User two', '', '[]', '[]', '', 'draft')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count
  from public.projects
  where id = '20000000-0000-4000-8000-000000000002';
  if visible_count <> 0 then
    raise exception 'FAIL: user one can read user two project';
  end if;

  update public.projects
  set application_name = 'unauthorized overwrite'
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'FAIL: user one can update user two project';
  end if;

  delete from public.projects
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'FAIL: user one can delete user two project';
  end if;

  update public.projects
  set application_name = 'User one edited after submit'
  where id = '20000000-0000-4000-8000-000000000001'
    and status = 'submitted';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'FAIL: owner cannot edit their own submitted project';
  end if;

  begin
    insert into public.projects
      (owner_id, application_name, application_description, nodes, edges, notes, status)
    values
      ('10000000-0000-4000-8000-000000000001', 'Invalid status', '', '[]', '[]', '', 'invalid');
    raise exception 'FAIL: invalid project status was accepted';
  exception
    when check_violation then
      null; -- Expected status constraint rejection.
  end;

  begin
    insert into public.projects
      (owner_id, application_name, application_description, nodes, edges, notes, status)
    values
      ('10000000-0000-4000-8000-000000000001', 'Invalid nodes', '', '{}', '[]', '', 'draft');
    raise exception 'FAIL: invalid nodes JSON shape was accepted';
  exception
    when check_violation then
      null; -- Expected JSON shape constraint rejection.
  end;

  begin
    insert into public.projects
      (owner_id, application_name, application_description, nodes, edges, notes)
    values
      ('10000000-0000-4000-8000-000000000002', 'Spoofed owner', '', '[]', '[]', '');
    raise exception 'FAIL: user one inserted a project owned by user two';
  exception
    when insufficient_privilege then
      null; -- Expected RLS rejection.
  end;
end
$$;

reset role;

set local role anon;

do $$
declare
  denied boolean := false;
begin
  begin
    perform 1 from public.projects;
  exception
    when insufficient_privilege then
      denied := true;
  end;
  if not denied then
    raise exception 'FAIL: anonymous project read was allowed';
  end if;
end
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.projects
    where id = '20000000-0000-4000-8000-000000000002'
      and application_name = 'User two'
  ) then
    raise exception 'FAIL: user two project was changed or deleted';
  end if;
  if not exists (
    select 1 from public.projects
    where id = '20000000-0000-4000-8000-000000000001'
      and application_name = 'User one edited after submit'
      and status = 'submitted'
  ) then
    raise exception 'FAIL: submitted project edit was not preserved';
  end if;
end
$$;

rollback;

-- now() is stable within a transaction, so verify the timestamp trigger across commits.
create temp table projects_timestamp_baseline (updated_at timestamptz) on commit preserve rows;

begin;

insert into auth.users (id)
values ('10000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

insert into public.projects
  (id, owner_id, application_name, application_description, nodes, edges, notes, status)
values
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Timestamp check', '', '[]', '[]', '', 'draft');

commit;

begin;

insert into projects_timestamp_baseline (updated_at)
select updated_at
from public.projects
where id = '20000000-0000-4000-8000-000000000003';

commit;

select pg_sleep(0.01);

begin;

update public.projects
set notes = 'Timestamp update check'
where id = '20000000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
    select 1
    from public.projects p
    join projects_timestamp_baseline b on true
    where p.id = '20000000-0000-4000-8000-000000000003'
      and p.updated_at > b.updated_at
  ) then
    raise exception 'FAIL: updated_at did not advance after update';
  end if;
end
$$;

delete from public.projects
where id = '20000000-0000-4000-8000-000000000003';

delete from auth.users
where id = '10000000-0000-4000-8000-000000000003';

commit;
