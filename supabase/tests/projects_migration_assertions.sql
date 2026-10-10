-- Run only on a local/disposable Supabase database after applying migrations.
-- Catalog-level assertions; behavioral RLS tests are documented in docs/backend-production-baseline.md.

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'FAIL: public.projects does not exist';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.projects'::regclass) then
    raise exception 'FAIL: RLS is not enabled';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'projects') <> 4 then
    raise exception 'FAIL: expected four owner-scoped policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects'
      and policyname = 'projects_update_own'
      and qual like '%auth.uid()%owner_id%'
      and with_check like '%auth.uid()%owner_id%'
  ) then
    raise exception 'FAIL: UPDATE policy must validate both current and resulting ownership';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.projects'::regclass
      and tgname = 'projects_set_updated_at'
      and not tgisinternal
  ) then
    raise exception 'FAIL: updated_at trigger is missing';
  end if;

  if not has_table_privilege('authenticated', 'public.projects', 'SELECT')
     or not has_table_privilege('authenticated', 'public.projects', 'INSERT')
     or not has_table_privilege('authenticated', 'public.projects', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.projects', 'DELETE') then
    raise exception 'FAIL: authenticated CRUD grants are incomplete';
  end if;

  if has_table_privilege('anon', 'public.projects', 'SELECT')
     or has_table_privilege('anon', 'public.projects', 'INSERT')
     or has_table_privilege('anon', 'public.projects', 'UPDATE')
     or has_table_privilege('anon', 'public.projects', 'DELETE') then
    raise exception 'FAIL: anonymous table privileges were not revoked';
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.projects'::regclass
      and not tgisinternal
      and pg_get_triggerdef(oid) ilike '%submitted%'
  ) then
    raise exception 'FAIL: submitted projects must not be locked';
  end if;

  if to_regclass('public.blueprints') is null then
    raise exception 'FAIL: legacy public.blueprints table unexpectedly missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.blueprints'::regclass
      and tgname = 'blueprint_submission_lock'
      and not tgisinternal
  ) then
    raise exception 'FAIL: legacy blueprint submission lock was altered or removed';
  end if;

  raise notice 'PASS: projects schema, RLS, timestamp trigger, and legacy blueprint lock';
end
$$;

rollback;
