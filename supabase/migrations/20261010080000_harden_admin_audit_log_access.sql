-- Keep administrative audit records inaccessible to browser roles.
-- RLS remains enabled and service_role retains its trusted-server access.
-- This is additive hardening; review migration history before applying to production.

begin;

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from public, anon, authenticated;

drop policy if exists admin_audit_logs_deny_client_access on public.admin_audit_logs;
create policy admin_audit_logs_deny_client_access
  on public.admin_audit_logs
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.admin_audit_logs is
  'Trusted-server-only administrative audit records. Browser roles have no table privileges; RLS also denies anon/authenticated access.';

commit;
