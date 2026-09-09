begin;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'dono', 'gerente')
  );
$$;

create or replace function public.is_reservation_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'dono', 'gerente', 'receptionist', 'portaria')
  );
$$;

create or replace function public.can_access_task(task_employee_id uuid, task_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select task_employee_id is null
         and task_role_id is null
      or task_employee_id = auth.uid()
      or exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and job_role_id = task_role_id
      );
$$;

create or replace function public.can_start_task(task_uuid uuid, execution_day date)
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
      and public.can_access_task(assigned_employee_id, assigned_role_id)
  );
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id
     and not public.is_manager()
     and (new.role is distinct from old.role or new.job_role_id is distinct from old.job_role_id) then
    raise exception 'You cannot change your role or job assignment';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

alter function public.auto_confirm_users() set search_path = public, pg_temp;
alter function public.check_daily_capacity() set search_path = public, pg_temp;
alter function public.get_customer_reservations(text) set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.release_expired_reservations() set search_path = public, pg_temp;

revoke all on function public.auto_confirm_users() from public, anon, authenticated;
revoke all on function public.check_daily_capacity() from public, anon, authenticated;
revoke all on function public.get_customer_reservations(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
grant execute on function public.auto_confirm_users() to service_role;
grant execute on function public.check_daily_capacity() to service_role;
grant execute on function public.get_customer_reservations(text) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.release_expired_reservations() to service_role;

revoke all on function public.is_manager() from public;
revoke all on function public.is_reservation_staff() from public;
revoke all on function public.can_access_task(uuid, uuid) from public;
revoke all on function public.can_start_task(uuid, date) from public;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_reservation_staff() to authenticated;
grant execute on function public.can_access_task(uuid, uuid) to authenticated;
grant execute on function public.can_start_task(uuid, date) to authenticated;

alter table public.employee_roles enable row level security;
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

drop policy if exists "Allow authenticated full access to blocked_dates" on public.blocked_dates;
drop policy if exists "Allow public read access to blocked_dates" on public.blocked_dates;
create policy "Public can read blocked dates"
on public.blocked_dates for select
using (true);
create policy "Managers can manage blocked dates"
on public.blocked_dates for all to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid());
create policy "Managers can manage profiles"
on public.profiles for all to authenticated
using (public.is_manager())
with check (public.is_manager());
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can view all reservations" on public.reservations;
drop policy if exists "Allow authenticated manage" on public.reservations;
drop policy if exists "Allow authenticated select" on public.reservations;
drop policy if exists "Allow public insert" on public.reservations;
drop policy if exists "Public can insert reservations" on public.reservations;
drop policy if exists "Users can update their own pending reservations" on public.reservations;
drop policy if exists "Users can view their own reservations" on public.reservations;
create policy "Reservation staff can read reservations"
on public.reservations for select to authenticated
using (public.is_reservation_staff());
create policy "Managers can manage reservations"
on public.reservations for all to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "Enable all access for authenticated users" on public.special_dates;
drop policy if exists "Enable read access for all users" on public.special_dates;
create policy "Public can read special dates"
on public.special_dates for select
using (true);
create policy "Managers can manage special dates"
on public.special_dates for all to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "Allow all access to authenticated users" on public.whatsapp_templates;
create policy "Managers can manage WhatsApp templates"
on public.whatsapp_templates for all to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "Allow authenticated full access to blacklist" on public.blacklist;
drop policy if exists "Allow authenticated manage blacklist" on public.blacklist;
drop policy if exists "Allow authenticated staff to manage blacklist" on public.blacklist;
create policy "Managers can manage blacklist"
on public.blacklist for all to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "Managers can manage employee roles"
on public.employee_roles for all to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "Managers can manage task categories"
on public.task_categories for all to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "Managers can manage tasks"
on public.tasks for all to authenticated
using (public.is_manager())
with check (public.is_manager());
create policy "Employees can read assigned tasks"
on public.tasks for select to authenticated
using (public.can_access_task(assigned_employee_id, assigned_role_id));

create policy "Managers can manage task completions"
on public.task_completions for all to authenticated
using (public.is_manager())
with check (public.is_manager());
create policy "Employees can read own task completions"
on public.task_completions for select to authenticated
using (employee_id = auth.uid());
create policy "Employees can start assigned tasks"
on public.task_completions for insert to authenticated
with check (
  employee_id = auth.uid()
  and status = 'in_progress'
  and public.can_start_task(task_id, execution_date)
);
create policy "Employees can complete own tasks"
on public.task_completions for update to authenticated
using (employee_id = auth.uid() and status = 'in_progress')
with check (
  employee_id = auth.uid()
  and status in ('in_progress', 'awaiting_review')
  and reviewed_by is null
  and reviewed_at is null
);

create unique index if not exists task_completions_task_execution_date_key
on public.task_completions (task_id, execution_date);
create index if not exists blacklist_blocked_by_idx on public.blacklist (blocked_by);
create index if not exists profiles_job_role_id_idx on public.profiles (job_role_id);
create index if not exists reservations_customer_id_idx on public.reservations (customer_id);
create index if not exists tasks_assigned_employee_id_idx on public.tasks (assigned_employee_id);
create index if not exists tasks_assigned_role_id_idx on public.tasks (assigned_role_id);
create index if not exists tasks_category_id_idx on public.tasks (category_id);
create index if not exists task_completions_employee_id_idx on public.task_completions (employee_id);
create index if not exists task_completions_reviewed_by_idx on public.task_completions (reviewed_by);

commit;
