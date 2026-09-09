create schema if not exists private;

alter function public.is_manager() set schema private;
alter function public.is_reservation_staff() set schema private;
alter function public.can_access_task(uuid, uuid) set schema private;
alter function public.can_start_task(uuid, date) set schema private;
alter function public.prevent_profile_privilege_escalation() set schema private;
alter function public.rls_auto_enable() set schema private;

create or replace function private.can_start_task(task_uuid uuid, execution_day date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tasks
    where id = task_uuid
      and (is_daily or target_date = execution_day)
      and private.can_access_task(assigned_employee_id, assigned_role_id)
  );
$$;

revoke all on function private.is_manager() from public, anon, authenticated;
revoke all on function private.is_reservation_staff() from public, anon, authenticated;
revoke all on function private.can_access_task(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_start_task(uuid, date) from public, anon, authenticated;
revoke all on function private.prevent_profile_privilege_escalation() from public, anon, authenticated;
revoke all on function private.rls_auto_enable() from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.is_reservation_staff() to authenticated;
grant execute on function private.can_access_task(uuid, uuid) to authenticated;
grant execute on function private.can_start_task(uuid, date) to authenticated;
