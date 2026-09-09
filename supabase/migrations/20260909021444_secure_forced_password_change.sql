create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id
     and not private.is_manager()
     and (
       new.role is distinct from old.role
       or new.job_role_id is distinct from old.job_role_id
       or new.force_password_change is distinct from old.force_password_change
     ) then
    raise exception 'You cannot change your access privileges';
  end if;

  return new;
end;
$$;
