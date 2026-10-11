begin;

-- Keep the privilege-escalation guard in place while permitting this
-- reviewed, one-time bootstrap from the privileged migration connection.
create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approved_finance_role_assignment boolean;
begin
  approved_finance_role_assignment :=
    session_user in ('postgres', 'supabase_admin')
    and old.role = 'admin'
    and lower(old.email) = lower(new.email)
    and (
      (lower(new.email) = 'duna@admin.com' and new.role = 'dono')
      or (lower(new.email) = 'heruzneuhauz@gmail.com' and new.role = 'gerente')
    );

  if new.role is distinct from old.role
     and (auth.uid() = old.id or new.role = 'dono' or old.role = 'dono')
     and not approved_finance_role_assignment then
    raise exception 'OWNER_ROLE_CHANGE_REQUIRES_APPROVED_PROCEDURE';
  end if;

  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.job_role_id is distinct from old.job_role_id
  ) then
    raise exception 'You cannot change your role or job assignment';
  end if;

  return new;
end;
$$;

-- Only update identities where both the profile and Supabase Auth email agree.
-- If an account is absent or mismatched, leave it untouched for manual review.
update public.profiles as profile
set role = case lower(auth_user.email)
  when 'duna@admin.com' then 'dono'
  when 'heruzneuhauz@gmail.com' then 'gerente'
end,
updated_at = now()
from auth.users as auth_user
where auth_user.id = profile.id
  and lower(auth_user.email) = lower(profile.email)
  and lower(auth_user.email) in ('duna@admin.com', 'heruzneuhauz@gmail.com')
  and profile.role = 'admin';

commit;
