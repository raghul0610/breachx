-- Assert browser roles cannot mutate GitHub installation bindings.
do $$
declare
  rls_enabled boolean;
  owner_read_policy boolean;
begin
  select c.relrowsecurity into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'github_connections';

  if rls_enabled is distinct from true then
    raise exception 'RLS must be enabled on public.github_connections';
  end if;

  if has_table_privilege('anon', 'public.github_connections', 'SELECT')
     or has_table_privilege('anon', 'public.github_connections', 'INSERT')
     or has_table_privilege('anon', 'public.github_connections', 'UPDATE')
     or has_table_privilege('anon', 'public.github_connections', 'DELETE') then
    raise exception 'anon must have no privileges on public.github_connections';
  end if;

  if not has_table_privilege('authenticated', 'public.github_connections', 'SELECT') then
    raise exception 'authenticated must be able to read own GitHub connection metadata';
  end if;

  if has_table_privilege('authenticated', 'public.github_connections', 'INSERT')
     or has_table_privilege('authenticated', 'public.github_connections', 'UPDATE')
     or has_table_privilege('authenticated', 'public.github_connections', 'DELETE') then
    raise exception 'authenticated must not mutate public.github_connections';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'github_connections'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and qual ilike '%auth.uid()%'
  ) into owner_read_policy;

  if not owner_read_policy then
    raise exception 'Owner-scoped authenticated SELECT policy is missing';
  end if;
end $$;
