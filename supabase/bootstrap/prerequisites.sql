-- LOCAL BOOTSTRAP ONLY. Not a production migration.
-- Sources: pg_catalog + schema_migrations inspected read-only on 2026-10-03.
-- Reconstructs prerequisites of the versioned September migrations, not a
-- byte-for-byte historical dump. No customer records or identity seeds.
begin;
create extension if not exists moddatetime with schema public;

-- Observed platform event function, originally public, moved by September SQL.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
      and cmd.schema_name not in ('pg_catalog','information_schema')
      and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;
-- Supabase versions may already install this event trigger.
drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- Match the observed grants of legacy tables; September restricts future defaults.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

create table public.employee_roles (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, whatsapp text, email text,
  role text default 'customer' check (role in ('dono','gerente','portaria','admin','customer','employee','receptionist')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  job_role_id uuid references public.employee_roles(id), force_password_change boolean default false
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  name text not null, email text not null, whatsapp text not null,
  reservation_date date not null, reservation_time time not null,
  num_guests integer not null check (num_guests > 0), notes text,
  status text default 'pending' check (status in ('pending','confirmed','cancelled','completed','pendente','confirmado','cancelado','concluido')),
  payment_status text default 'not_required' check (payment_status in ('not_required','pending','paid')),
  payment_amount numeric default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  cpf text, birth_date date, type text default 'mesa', location_id text,
  check_in_status text default 'pending', expires_at timestamptz
);
create table public.blacklist (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default timezone('utc', now()),
  cpf text not null unique, name text not null, reason text,
  start_date date default current_date, end_date date not null, blocked_by uuid references auth.users(id)
);
create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(), date date not null unique, reason text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.special_dates (
  id uuid primary key default gen_random_uuid(), date date not null,
  requires_fee boolean default false, fee_amount numeric default 0, description text,
  created_at timestamptz default now(), updated_at timestamptz default now(), included_guests integer
);
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(), title text not null, content text not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.task_categories (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.task_categories(id) on delete cascade,
  title text not null, description text, scheduled_time time, time_estimate_minutes integer not null,
  assigned_employee_id uuid references public.profiles(id), assigned_role_id uuid references public.employee_roles(id),
  is_daily boolean default false, target_date date, created_at timestamptz default now()
);
create table public.task_completions (
  id uuid primary key default gen_random_uuid(), task_id uuid references public.tasks(id) on delete cascade,
  employee_id uuid references public.profiles(id), execution_date date not null,
  status text not null check (status in ('in_progress','awaiting_review','approved')),
  started_at timestamptz, completed_at timestamptz, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz
);

create trigger handle_updated_at_profiles before update on public.profiles
  for each row execute function public.moddatetime('updated_at');
create trigger handle_updated_at_reservations before update on public.reservations
  for each row execute function public.moddatetime('updated_at');
create function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, 'customer');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create function public.auto_confirm_users() returns trigger language plpgsql security definer as $$
begin
  new.email_confirmed_at = now();
  return new;
end;
$$;
create trigger auto_confirm_users_trigger before insert on auth.users
  for each row execute function public.auto_confirm_users();

-- Definition from applied migration 20260508150510; replaced by stabilization.
create function public.check_daily_capacity() returns trigger language plpgsql as $$
declare current_total integer; v_status text;
begin
  v_status := lower(coalesce(new.status, 'pending'));
  if v_status in ('cancelled','cancelado') then return new; end if;
  select coalesce(sum(num_guests),0) into current_total from reservations
  where reservation_date = new.reservation_date
    and lower(coalesce(status,'pending')) not in ('cancelled','cancelado')
    and id != coalesce(new.id,'00000000-0000-0000-0000-000000000000');
  if current_total + new.num_guests > 80 then
    raise exception 'CAPACITY_EXCEEDED: Limite de 80 pessoas atingido. (Ocupado: %, Tentativa: %)', current_total, new.num_guests;
  end if;
  if new.status is null then new.status := 'pending'; end if;
  return new;
end;
$$;
create trigger enforce_daily_capacity before insert or update on public.reservations
  for each row execute function public.check_daily_capacity();
create function public.get_customer_reservations(phone_param text)
returns setof public.reservations language sql security definer as $$
  select * from reservations where whatsapp = phone_param
    or replace(replace(replace(replace(whatsapp,' ',''),'-',''),'(',''),')','') =
       replace(replace(replace(replace(phone_param,' ',''),'-',''),'(',''),')','')
  order by reservation_date desc;
$$;
-- Observed current definition. Do not schedule or invoke on production.
create function public.release_expired_reservations() returns void language plpgsql as $$
begin
  update public.reservations
  set status = 'cancelled', notes = coalesce(notes,'') || ' [Auto-cancelado: limite de 23:30 excedido]'
  where status = 'pending' and check_in_status = 'pending' and type in ('mesa','camarote')
    and (reservation_date || ' 23:30:00')::timestamp < now();
end;
$$;
-- No historical permissive policies are restored: RLS denies until the existing
-- hardening migrations install the observed final policies. No cron job is started.
commit;
