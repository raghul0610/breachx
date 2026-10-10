-- Run only against an isolated local/CI database after the hardening migration.
begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.admin_audit_logs'::regclass) then
    raise exception 'FAIL: admin_audit_logs RLS must remain enabled';
  end if;

  if has_table_privilege('anon', 'public.admin_audit_logs', 'select')
     or has_table_privilege('anon', 'public.admin_audit_logs', 'insert')
     or has_table_privilege('anon', 'public.admin_audit_logs', 'update')
     or has_table_privilege('anon', 'public.admin_audit_logs', 'delete') then
    raise exception 'FAIL: anon retains table privileges on admin_audit_logs';
  end if;

  if has_table_privilege('authenticated', 'public.admin_audit_logs', 'select')
     or has_table_privilege('authenticated', 'public.admin_audit_logs', 'insert')
     or has_table_privilege('authenticated', 'public.admin_audit_logs', 'update')
     or has_table_privilege('authenticated', 'public.admin_audit_logs', 'delete') then
    raise exception 'FAIL: authenticated retains table privileges on admin_audit_logs';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'admin_audit_logs_deny_client_access'
      and cmd = 'ALL'
      and coalesce(qual, '') in ('false', '(false)')
      and coalesce(with_check, '') in ('false', '(false)')
      and roles @> array['anon']::name[]
      and roles @> array['authenticated']::name[]
  ) then
    raise exception 'FAIL: explicit deny policy for browser roles is missing';
  end if;

  raise notice 'PASS: admin_audit_logs is inaccessible to anon/authenticated roles';
end
$$;

rollback;
