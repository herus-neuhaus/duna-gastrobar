begin;

-- A commercial turn is independent from the start of a configured slot. A
-- schedule can therefore contain multiple lunch/dinner intervals without
-- creating extra capacity pools.
alter table public.reservation_schedule_slots
  add column if not exists commercial_turn text
    check (commercial_turn in ('lunch', 'dinner'));

alter table public.reservation_schedule_date_slots
  add column if not exists commercial_turn text
    check (commercial_turn in ('lunch', 'dinner'));

-- These are the only pre-existing slot identities approved by the schedule
-- already installed in this system. Other slots remain deliberately unset and
-- must be classified by the owner before accepting reservations.
update public.reservation_schedule_slots
set commercial_turn = case starts_at
  when '12:00'::time then 'lunch'
  when '18:00'::time then 'dinner'
end
where commercial_turn is null
  and starts_at in ('12:00'::time, '18:00'::time);

update public.reservation_schedule_date_slots
set commercial_turn = case starts_at
  when '12:00'::time then 'lunch'
  when '18:00'::time then 'dinner'
end
where commercial_turn is null
  and starts_at in ('12:00'::time, '18:00'::time);

create or replace function public.set_schedule_commercial_turn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.commercial_turn is null then
    new.commercial_turn := case new.starts_at
      when '12:00'::time then 'lunch'
      when '18:00'::time then 'dinner'
      else null
    end;
  end if;
  if new.active and new.commercial_turn is null then
    raise exception 'SCHEDULE_COMMERCIAL_TURN_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists set_weekly_schedule_commercial_turn on public.reservation_schedule_slots;
create trigger set_weekly_schedule_commercial_turn
  before insert or update of starts_at, commercial_turn, active on public.reservation_schedule_slots
  for each row execute function public.set_schedule_commercial_turn();
drop trigger if exists set_date_schedule_commercial_turn on public.reservation_schedule_date_slots;
create trigger set_date_schedule_commercial_turn
  before insert or update of starts_at, commercial_turn, active on public.reservation_schedule_date_slots
  for each row execute function public.set_schedule_commercial_turn();

alter table public.reservations
  add column if not exists commercial_turn text
    check (commercial_turn in ('lunch', 'dinner'));

create index if not exists reservations_capacity_commercial_turn_idx
  on public.reservations (reservation_date, commercial_turn)
  where lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
    and source <> 'walk_in';

create table if not exists public.reservation_capacity_permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  check ((revoked_by is null) = (revoked_at is null))
);

create table if not exists public.reservation_capacity_permission_audits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('granted', 'revoked')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.reservation_capacity_override_uses (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict deferrable initially deferred,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  operation text not null check (operation in ('create', 'increase', 'move')),
  previous_reservation_date date,
  previous_commercial_turn text check (previous_commercial_turn in ('lunch', 'dinner')),
  previous_num_guests integer check (previous_num_guests > 0),
  next_reservation_date date not null,
  next_commercial_turn text not null check (next_commercial_turn in ('lunch', 'dinner')),
  next_num_guests integer not null check (next_num_guests > 0),
  occupied_before integer,
  occupied_after integer,
  created_at timestamptz not null default now()
);

-- Transaction-scoped authorization tickets make each immutable use single-use,
-- even if an authenticated RPC performs later writes in the same transaction.
create table if not exists public.reservation_capacity_override_nonces (
  id uuid primary key references public.reservation_capacity_override_uses(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict deferrable initially deferred,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation in ('create', 'increase', 'move')),
  next_reservation_date date not null,
  next_commercial_turn text not null check (next_commercial_turn in ('lunch', 'dinner')),
  next_num_guests integer not null check (next_num_guests > 0),
  occupied_before integer not null,
  occupied_after integer not null
);

alter table public.reservation_override_audits
  drop constraint if exists reservation_override_audits_reservation_id_override_type_key;

create index if not exists reservation_capacity_override_uses_reservation_idx
  on public.reservation_capacity_override_uses (reservation_id, created_at);

alter table public.reservation_capacity_permissions enable row level security;
alter table public.reservation_capacity_permission_audits enable row level security;
alter table public.reservation_capacity_override_uses enable row level security;
alter table public.reservation_capacity_override_nonces enable row level security;

create policy "Owners can read capacity permissions"
  on public.reservation_capacity_permissions for select to authenticated
  using (public.is_reservation_owner());
create policy "Owners can read capacity permission audits"
  on public.reservation_capacity_permission_audits for select to authenticated
  using (public.is_reservation_owner());
create policy "Owners can read capacity override uses"
  on public.reservation_capacity_override_uses for select to authenticated
  using (public.is_reservation_owner());

create or replace function public.is_reservation_admin_or_owner()
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
      and role in ('admin', 'dono')
      and not coalesce(force_password_change, false)
  );
$$;

create or replace function public.can_override_reservation_capacity()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_reservation_owner()
    or exists (
      select 1
      from public.reservation_capacity_permissions permission
      join public.profiles profile on profile.id = permission.profile_id
      where permission.profile_id = auth.uid()
        and permission.revoked_at is null
        and profile.role in ('admin', 'gerente', 'receptionist', 'portaria')
        and not coalesce(profile.force_password_change, false)
    );
$$;

create or replace function public.set_reservation_capacity_permission(
  p_profile_id uuid,
  p_granted boolean,
  p_reason text
)
returns table (updated_profile_id uuid, granted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  change_reason text := nullif(btrim(p_reason), '');
  actor_id uuid := auth.uid();
  target_role text;
begin
  if not public.is_reservation_owner() then
    raise exception 'OWNER_REQUIRED';
  end if;
  if p_profile_id = actor_id then
    raise exception 'CAPACITY_PERMISSION_SELF_ASSIGNMENT_FORBIDDEN';
  end if;
  if change_reason is null or char_length(change_reason) not between 3 and 1000 then
    raise exception 'INVALID_CAPACITY_PERMISSION_REASON';
  end if;
  select role into target_role from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if target_role not in ('admin', 'dono', 'gerente', 'receptionist', 'portaria') then
    raise exception 'CAPACITY_PERMISSION_TARGET_NOT_PANEL_STAFF';
  end if;

  if p_granted then
    insert into public.reservation_capacity_permissions (
      profile_id, granted_by, granted_at, revoked_by, revoked_at
    ) values (p_profile_id, actor_id, now(), null, null)
    on conflict on constraint reservation_capacity_permissions_pkey do update
      set granted_by = excluded.granted_by,
          granted_at = excluded.granted_at,
          revoked_by = null,
          revoked_at = null;
  else
    update public.reservation_capacity_permissions as permission
       set revoked_by = actor_id,
           revoked_at = now()
     where permission.profile_id = p_profile_id
       and permission.revoked_at is null;
    if not found then raise exception 'CAPACITY_PERMISSION_NOT_ACTIVE'; end if;
  end if;

  insert into public.reservation_capacity_permission_audits (
    profile_id, actor_id, action, reason
  ) values (
    p_profile_id, actor_id,
    case when p_granted then 'granted' else 'revoked' end,
    change_reason
  );

  return query select p_profile_id, p_granted;
end;
$$;

create or replace function public.get_reservation_commercial_turn(
  p_reservation_date date,
  p_reservation_time time
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with has_date_override as (
    select exists (
      select 1 from public.reservation_schedule_date_slots
      where reservation_date = p_reservation_date
    ) as value
  ), slots as (
    select commercial_turn
    from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date
      and active
      and p_reservation_time between starts_at and ends_at

    union all

    select commercial_turn
    from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and p_reservation_time between starts_at and ends_at
      and not (select value from has_date_override)
  )
  select min(commercial_turn)
  from slots
  having count(*) filter (where commercial_turn is null) = 0
     and count(distinct commercial_turn) = 1;
$$;

create or replace function public.reservation_commercial_turn_is_available(
  p_reservation_date date,
  p_commercial_turn text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with has_date_override as (
    select exists (
      select 1 from public.reservation_schedule_date_slots
      where reservation_date = p_reservation_date
    ) as value
  )
  select p_commercial_turn in ('lunch', 'dinner') and exists (
    select 1 from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date
      and active
      and commercial_turn = p_commercial_turn

    union all

    select 1 from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and commercial_turn = p_commercial_turn
      and not (select value from has_date_override)
  );
$$;

create or replace function public.get_reservation_service_start_for_commercial_turn(
  p_reservation_date date,
  p_commercial_turn text
)
returns time
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with has_date_override as (
    select exists (
      select 1 from public.reservation_schedule_date_slots
      where reservation_date = p_reservation_date
    ) as value
  ), slots as (
    select starts_at
    from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date
      and active
      and commercial_turn = p_commercial_turn

    union all

    select starts_at
    from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and commercial_turn = p_commercial_turn
      and not (select value from has_date_override)
  )
  select min(starts_at) from slots;
$$;

create or replace function private.get_reservation_occupancy_window_for_slot(
  p_reservation_date date,
  p_reservation_time time,
  p_commercial_turn text
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  duration_minutes integer;
  buffer_minutes integer;
  occupancy_start timestamptz;
begin
  select slot.reservation_duration_minutes, slot.turnover_buffer_minutes
    into duration_minutes, buffer_minutes
  from (
    select date_slot.reservation_duration_minutes, date_slot.turnover_buffer_minutes, date_slot.starts_at
    from public.reservation_schedule_date_slots date_slot
    where date_slot.reservation_date = p_reservation_date
      and date_slot.active
      and p_reservation_time between date_slot.starts_at and date_slot.ends_at
      and date_slot.commercial_turn = p_commercial_turn
    union all
    select weekly_slot.reservation_duration_minutes, weekly_slot.turnover_buffer_minutes, weekly_slot.starts_at
    from public.reservation_schedule_slots weekly_slot
    where weekly_slot.day_of_week = extract(dow from p_reservation_date)::smallint
      and weekly_slot.active
      and p_reservation_time between weekly_slot.starts_at and weekly_slot.ends_at
      and weekly_slot.commercial_turn = p_commercial_turn
      and not exists (select 1 from public.reservation_schedule_date_slots where reservation_date=p_reservation_date)
    union all
    select date_slot.reservation_duration_minutes, date_slot.turnover_buffer_minutes, date_slot.starts_at
    from public.reservation_schedule_date_slots date_slot
    where date_slot.reservation_date = p_reservation_date
      and date_slot.active
      and date_slot.commercial_turn = p_commercial_turn
      and not exists (
        select 1 from public.reservation_schedule_date_slots matching
        where matching.reservation_date=p_reservation_date and matching.active
          and p_reservation_time between matching.starts_at and matching.ends_at
          and matching.commercial_turn=p_commercial_turn
      )
    union all
    select weekly_slot.reservation_duration_minutes, weekly_slot.turnover_buffer_minutes, weekly_slot.starts_at
    from public.reservation_schedule_slots weekly_slot
    where weekly_slot.day_of_week = extract(dow from p_reservation_date)::smallint
      and weekly_slot.active
      and weekly_slot.commercial_turn = p_commercial_turn
      and not exists (select 1 from public.reservation_schedule_date_slots where reservation_date=p_reservation_date)
      and not exists (
        select 1 from public.reservation_schedule_slots matching
        where matching.day_of_week=weekly_slot.day_of_week and matching.active
          and p_reservation_time between matching.starts_at and matching.ends_at
          and matching.commercial_turn=p_commercial_turn
      )
  ) slot
  order by slot.starts_at
  limit 1;

  if duration_minutes is null or p_commercial_turn not in ('lunch', 'dinner') then
    raise exception 'RESERVATION_SCHEDULE_NOT_FOUND';
  end if;
  occupancy_start := timezone('America/Porto_Velho', p_reservation_date + p_reservation_time);
  return query select occupancy_start, occupancy_start + make_interval(mins => duration_minutes + buffer_minutes);
end;
$$;

create or replace function public.get_reservation_occupancy_window(p_reservation_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
begin
  select * into reservation_row from public.reservations where reservations.id=p_reservation_id;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  return query select * from private.get_reservation_occupancy_window_for_slot(
    reservation_row.reservation_date, reservation_row.reservation_time, reservation_row.commercial_turn
  );
end;
$$;

create or replace function public.sync_reservation_table_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  occupancy record;
begin
  if new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time then
    perform pg_advisory_xact_lock(hashtext('restaurant-table:' || assignment.table_id::text))
    from (
      select table_id from public.reservation_table_assignments
      where reservation_id=new.id and released_at is null order by table_id
    ) assignment;
    select * into occupancy from private.get_reservation_occupancy_window_for_slot(
      new.reservation_date, new.reservation_time, new.commercial_turn
    );
    update public.reservation_table_assignments
       set starts_at=occupancy.starts_at, ends_at=occupancy.ends_at
     where reservation_id=new.id and released_at is null;
  end if;
  if new.num_guests is distinct from old.num_guests and exists (
    select 1 from public.reservation_table_assignments
    where reservation_id=new.id and released_at is null
  ) and new.num_guests > (
    select coalesce(sum(allocated_capacity),0) from public.reservation_table_assignments
    where reservation_id=new.id and released_at is null
  ) then raise exception 'TABLE_ASSIGNMENT_CAPACITY_INSUFFICIENT'; end if;
  return new;
end;
$$;

update public.reservations
set commercial_turn = public.get_reservation_commercial_turn(
  reservation_date,
  reservation_time
)
where commercial_turn is null
  and public.get_reservation_commercial_turn(reservation_date, reservation_time) is not null;

drop function if exists public.get_reservation_capacity_availability(date, date);
drop view public.reservation_turn_classification_issues;
create view public.reservation_turn_classification_issues
with (security_invoker = true)
as
  select id, reservation_date, reservation_time, num_guests, status, source, commercial_turn, created_at
  from public.reservations
  where lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
    and source <> 'walk_in'
    and commercial_turn is null;

create or replace function public.set_reservation_service_period()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  calculated_service_start time;
  calculated_commercial_turn text;
begin
  calculated_service_start := public.get_reservation_service_starts_at(
    new.reservation_date, new.reservation_time
  );
  calculated_commercial_turn := public.get_reservation_commercial_turn(
    new.reservation_date, new.reservation_time
  );

  if calculated_service_start is not null and calculated_commercial_turn is not null then
    new.service_starts_at := calculated_service_start;
    new.commercial_turn := calculated_commercial_turn;
  elsif current_setting('app.reservation_schedule_override', true) = 'enabled' then
    if not public.reservation_commercial_turn_is_available(new.reservation_date, new.commercial_turn) then
      raise exception 'RESERVATION_COMMERCIAL_TURN_REQUIRED';
    end if;
    new.service_starts_at := public.get_reservation_service_start_for_commercial_turn(
      new.reservation_date, new.commercial_turn
    );
  else
    raise exception 'RESERVATION_TIME_UNAVAILABLE';
  end if;
  return new;
end;
$$;

create or replace function public.protect_reservation_capacity_controls()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.source = 'walk_in'
       and current_setting('app.reservation_walk_in', true) is distinct from 'enabled' then
      raise exception 'WALK_IN_SOURCE_FORBIDDEN';
    end if;
    if new.capacity_override_reason is not null
       or new.capacity_override_authorized_by is not null
       or new.capacity_override_authorized_at is not null
       or new.schedule_override_reason is not null
       or new.schedule_override_authorized_by is not null
       or new.schedule_override_authorized_at is not null then
      raise exception 'RESERVATION_OVERRIDE_METADATA_FORBIDDEN';
    end if;
  else
    if new.source is distinct from old.source
       and current_setting('app.reservation_walk_in', true) is distinct from 'enabled' then
      raise exception 'RESERVATION_SOURCE_IMMUTABLE';
    end if;
    if (new.service_starts_at is distinct from old.service_starts_at
          or new.commercial_turn is distinct from old.commercial_turn)
       and new.reservation_date is not distinct from old.reservation_date
       and new.reservation_time is not distinct from old.reservation_time
       and current_setting('app.reservation_turn_classification', true) is distinct from 'enabled' then
      raise exception 'RESERVATION_TURN_IMMUTABLE';
    end if;
    if new.capacity_override_reason is distinct from old.capacity_override_reason
       or new.capacity_override_authorized_by is distinct from old.capacity_override_authorized_by
       or new.capacity_override_authorized_at is distinct from old.capacity_override_authorized_at
       or new.capacity_override_effect is distinct from old.capacity_override_effect
       or new.schedule_override_reason is distinct from old.schedule_override_reason
       or new.schedule_override_authorized_by is distinct from old.schedule_override_authorized_by
       or new.schedule_override_authorized_at is distinct from old.schedule_override_authorized_at then
      raise exception 'RESERVATION_OVERRIDE_METADATA_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists b_protect_reservation_capacity_controls on public.reservations;
create trigger b_protect_reservation_capacity_controls
  before insert or update on public.reservations
  for each row execute function public.protect_reservation_capacity_controls();

create or replace function public.check_daily_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_total integer;
  new_status text;
  old_status text;
  has_duplicate boolean;
  active_reservation boolean;
  old_contribution integer := 0;
  consumes_more boolean := false;
  override_use_id uuid;
  expected_operation text;
  override_use public.reservation_capacity_override_uses%rowtype;
  has_capacity_permission boolean := false;
begin
  new_status := lower(coalesce(new.status, 'pending'));
  old_status := lower(coalesce(old.status, 'pending'));
  if new.status is null then new.status := 'pending'; new_status := 'pending'; end if;

  if tg_op = 'UPDATE'
     and new.reservation_date is not distinct from old.reservation_date
     and new.reservation_time is not distinct from old.reservation_time
     and new.commercial_turn is not distinct from old.commercial_turn
     and new.num_guests is not distinct from old.num_guests
     and new.status is not distinct from old.status
     and new.source is not distinct from old.source
     and new.whatsapp is not distinct from old.whatsapp then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('reservation-capacity:' || lock_key))
  from (
    select distinct turns.reservation_date::text || ':' || turns.commercial_turn as lock_key
    from (
      select new.reservation_date, new.commercial_turn
      union all
      select old.reservation_date, old.commercial_turn where tg_op = 'UPDATE'
    ) turns
    where commercial_turn is not null
    order by 1
  ) locks;

  active_reservation := new_status not in ('cancelled', 'cancelado')
    and coalesce(new.source, 'website') <> 'walk_in';
  if active_reservation and new.commercial_turn is null then
    raise exception 'RESERVATION_TURN_UNCLASSIFIED';
  end if;
  if active_reservation and exists (
    select 1 from public.reservation_turn_classification_issues issue
    where issue.reservation_date = new.reservation_date and issue.id <> new.id
  ) and not (
    tg_op = 'UPDATE' and old.commercial_turn is null and new.commercial_turn is not null
  ) then raise exception 'RESERVATION_TURN_CLASSIFICATION_REQUIRED'; end if;

  if tg_op = 'INSERT'
     or new.reservation_date is distinct from old.reservation_date
     or regexp_replace(new.whatsapp, '\D', '', 'g') is distinct from regexp_replace(old.whatsapp, '\D', '', 'g')
     or old_status in ('cancelled', 'cancelado') then
    select exists (
      select 1 from public.reservations
      where reservation_date = new.reservation_date
        and regexp_replace(whatsapp, '\D', '', 'g') = regexp_replace(new.whatsapp, '\D', '', 'g')
        and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) into has_duplicate;
    if has_duplicate then raise exception 'ACTIVE_RESERVATION_EXISTS: Já existe uma reserva ativa para este WhatsApp nesta data.'; end if;
  end if;

  if not active_reservation then return new; end if;

  if tg_op = 'UPDATE'
     and old_status not in ('cancelled', 'cancelado')
     and old.source <> 'walk_in'
     and old.reservation_date = new.reservation_date
     and old.commercial_turn = new.commercial_turn then
    old_contribution := old.num_guests;
  end if;

  select coalesce(sum(reservations.num_guests), 0)
    into current_total
    from public.reservations
   where reservation_date = new.reservation_date
     and commercial_turn = new.commercial_turn
     and source <> 'walk_in'
     and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  consumes_more := new.num_guests > old_contribution;
  if current_total + new.num_guests > 80 and consumes_more then
    override_use_id := nullif(current_setting('app.reservation_capacity_override_use_id', true), '')::uuid;
    expected_operation := case
      when tg_op = 'INSERT' then 'create'
      when old_contribution = 0 then 'move'
      else 'increase'
    end;
    if override_use_id is null then
      raise exception 'CAPACITY_EXCEEDED: Limite de 80 pessoas atingido no turno. (Ocupado: %, Tentativa: %)', current_total, new.num_guests;
    end if;
    perform 1 from public.reservation_capacity_permissions permission
     where permission.profile_id = auth.uid()
       and permission.revoked_at is null
     for share;
    has_capacity_permission := found or public.is_reservation_owner();
    if not has_capacity_permission then raise exception 'CAPACITY_OVERRIDE_NOT_AUTHORIZED'; end if;
    select * into override_use
      from public.reservation_capacity_override_uses
     where id = override_use_id
       and reservation_id = new.id
       and actor_id = auth.uid()
       and operation = expected_operation;
    if not found
       or override_use.occupied_before is distinct from current_total
       or override_use.occupied_after is distinct from current_total + new.num_guests
       or override_use.next_reservation_date is distinct from new.reservation_date
       or override_use.next_commercial_turn is distinct from new.commercial_turn
       or override_use.next_num_guests is distinct from new.num_guests then
      raise exception 'CAPACITY_OVERRIDE_USE_REQUIRED';
    end if;
    perform 1 from public.reservation_capacity_override_nonces nonce
     where nonce.id=override_use_id
       and nonce.reservation_id=new.id
       and nonce.actor_id=auth.uid()
       and nonce.operation=expected_operation
       and nonce.next_reservation_date=new.reservation_date
       and nonce.next_commercial_turn=new.commercial_turn
       and nonce.next_num_guests=new.num_guests
       and nonce.occupied_before=current_total
       and nonce.occupied_after=current_total+new.num_guests
     for update;
    if not found then raise exception 'CAPACITY_OVERRIDE_USE_REQUIRED'; end if;
    delete from public.reservation_capacity_override_nonces where id=override_use_id;
  end if;
  return new;
end;
$$;

create or replace function public.create_reservation_with_authorized_overrides(
  p_name text, p_email text, p_whatsapp text, p_reservation_date date,
  p_reservation_time time, p_num_guests integer, p_notes text,
  p_special_date_id uuid, p_decoration_id uuid, p_cpf text,
  p_payment_status text, p_payment_amount numeric,
  p_reservation_access_token_hash text, p_capacity_override_reason text default null,
  p_schedule_override_reason text default null, p_commercial_turn text default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  capacity_reason text := nullif(btrim(p_capacity_override_reason), '');
  schedule_reason text := nullif(btrim(p_schedule_override_reason), '');
  reservation_id uuid := gen_random_uuid();
  override_use_id uuid;
  calculated_turn text;
  occupied_before integer;
begin
  if capacity_reason is null and schedule_reason is null then raise exception 'RESERVATION_OVERRIDE_REQUIRED'; end if;
  if capacity_reason is not null and (not public.can_override_reservation_capacity() or char_length(capacity_reason) not between 3 and 1000) then
    raise exception 'CAPACITY_OVERRIDE_NOT_AUTHORIZED';
  end if;
  if schedule_reason is not null then
    if not public.is_reservation_admin_or_owner() then raise exception 'SCHEDULE_OVERRIDE_NOT_AUTHORIZED'; end if;
    if char_length(schedule_reason) not between 3 and 1000 then raise exception 'INVALID_SCHEDULE_OVERRIDE_REASON'; end if;
    if public.reservation_time_is_available(p_reservation_date, p_reservation_time) then raise exception 'SCHEDULE_OVERRIDE_NOT_NEEDED'; end if;
    if p_commercial_turn not in ('lunch', 'dinner') or not public.reservation_commercial_turn_is_available(p_reservation_date, p_commercial_turn) then
      raise exception 'RESERVATION_COMMERCIAL_TURN_REQUIRED';
    end if;
    perform set_config('app.reservation_schedule_override', 'enabled', true);
  end if;

  calculated_turn := coalesce(public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time), p_commercial_turn);
  if calculated_turn is null then raise exception 'RESERVATION_COMMERCIAL_TURN_REQUIRED'; end if;
  if capacity_reason is not null then
    perform pg_advisory_xact_lock(hashtext('reservation-capacity:' || p_reservation_date::text || ':' || calculated_turn));
    select coalesce(sum(num_guests), 0) into occupied_before
      from public.reservations
     where reservation_date = p_reservation_date and commercial_turn = calculated_turn
       and source <> 'walk_in'
       and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado');
  end if;
  if capacity_reason is not null and occupied_before + p_num_guests > 80 then
    override_use_id := gen_random_uuid();
    insert into public.reservation_capacity_override_uses (
      id, reservation_id, actor_id, reason, operation, next_reservation_date,
      next_commercial_turn, next_num_guests, occupied_before, occupied_after
    ) values (
      override_use_id, reservation_id, actor_id, capacity_reason, 'create',
      p_reservation_date, calculated_turn, p_num_guests, occupied_before, occupied_before + p_num_guests
    );
    insert into public.reservation_capacity_override_nonces (
      id,reservation_id,actor_id,operation,next_reservation_date,next_commercial_turn,
      next_num_guests,occupied_before,occupied_after
    ) values (
      override_use_id,reservation_id,actor_id,'create',p_reservation_date,calculated_turn,
      p_num_guests,occupied_before,occupied_before+p_num_guests
    );
    perform set_config('app.reservation_capacity_override_use_id', override_use_id::text, true);
  end if;

  return query
  insert into public.reservations (
    id, name, email, whatsapp, reservation_date, reservation_time, num_guests,
    notes, special_date_id, decoration_id, cpf, payment_status, payment_amount,
    reservation_access_token_hash, status, source, commercial_turn
  ) values (
    reservation_id, p_name, p_email, p_whatsapp, p_reservation_date,
    p_reservation_time, p_num_guests, p_notes, p_special_date_id, p_decoration_id,
    p_cpf, p_payment_status, p_payment_amount, p_reservation_access_token_hash,
    'pending', 'admin', p_commercial_turn
  ) returning reservations.id;
  if schedule_reason is not null then
    insert into public.reservation_override_audits (
      reservation_id, override_type, authorized_by, reason,
      reservation_date, service_starts_at, effect
    ) values (
      reservation_id, 'schedule', actor_id, schedule_reason,
      p_reservation_date,
      coalesce(public.get_reservation_service_start_for_commercial_turn(p_reservation_date, calculated_turn), p_reservation_time),
      jsonb_build_object('operation', 'create', 'reservation_time', p_reservation_time,
        'commercial_turn', calculated_turn, 'outside_schedule', true)
    );
  end if;
  perform set_config('app.reservation_capacity_override_use_id','',true);
  perform set_config('app.reservation_schedule_override','',true);
end;
$$;

revoke all on function public.create_reservation_with_owner_overrides(text, text, text, date, time, integer, text, uuid, uuid, text, text, numeric, text, text, text, time) from public, anon, authenticated;
revoke all on function public.classify_reservation_service_period(uuid, time, text) from public, anon, authenticated;

create or replace function public.update_reservation_with_capacity_override(
  p_reservation_id uuid,
  p_reservation_date date,
  p_reservation_time time,
  p_num_guests integer,
  p_reason text
)
returns table (id uuid, reservation_date date, reservation_time time, num_guests integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  reservation_row public.reservations%rowtype;
  next_turn text;
  operation_type text;
  use_id uuid;
  destination_total integer;
  reason text := nullif(btrim(p_reason), '');
begin
  if not public.can_override_reservation_capacity() then raise exception 'CAPACITY_OVERRIDE_NOT_AUTHORIZED'; end if;
  if reason is null or char_length(reason) not between 3 and 1000 then raise exception 'INVALID_CAPACITY_OVERRIDE_REASON'; end if;
  if p_num_guests not between 1 and 30 then raise exception 'INVALID_GUEST_COUNT'; end if;
  select * into reservation_row from public.reservations where reservations.id = p_reservation_id for update;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if lower(coalesce(reservation_row.status, 'pending')) in ('cancelled', 'cancelado') then raise exception 'RESERVATION_NOT_EDITABLE'; end if;
  next_turn := public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time);
  if next_turn is null then raise exception 'RESERVATION_TIME_UNAVAILABLE'; end if;
  operation_type := case
    when reservation_row.reservation_date <> p_reservation_date or reservation_row.commercial_turn <> next_turn then 'move'
    when p_num_guests > reservation_row.num_guests then 'increase'
    else null
  end;
  if operation_type is null then raise exception 'CAPACITY_OVERRIDE_NOT_NEEDED'; end if;
  perform pg_advisory_xact_lock(hashtext('reservation-capacity:' || lock_turn.lock_key))
  from (
    select distinct turns.reservation_date::text || ':' || turns.commercial_turn as lock_key
    from (
      select p_reservation_date as reservation_date, next_turn as commercial_turn
      union all
      select reservation_row.reservation_date, reservation_row.commercial_turn
    ) turns
    order by 1
  ) lock_turn;
   select coalesce(sum(reservations.num_guests), 0)
     into destination_total
    from public.reservations
   where reservations.reservation_date = p_reservation_date
     and reservations.commercial_turn = next_turn
     and reservations.source <> 'walk_in'
     and lower(coalesce(reservations.status, 'pending')) not in ('cancelled', 'cancelado')
     and reservations.id <> p_reservation_id;
  if destination_total + p_num_guests <= 80 then
    raise exception 'CAPACITY_OVERRIDE_NOT_NEEDED';
  end if;
  use_id := gen_random_uuid();
  insert into public.reservation_capacity_override_uses (
    id, reservation_id, actor_id, reason, operation,
    previous_reservation_date, previous_commercial_turn, previous_num_guests,
    next_reservation_date, next_commercial_turn, next_num_guests,
    occupied_before, occupied_after
  ) values (
    use_id, reservation_row.id, actor_id, reason, operation_type,
    reservation_row.reservation_date, reservation_row.commercial_turn, reservation_row.num_guests,
    p_reservation_date, next_turn, p_num_guests, destination_total, destination_total + p_num_guests
  );
  insert into public.reservation_capacity_override_nonces (
    id,reservation_id,actor_id,operation,next_reservation_date,next_commercial_turn,
    next_num_guests,occupied_before,occupied_after
  ) values (
    use_id,reservation_row.id,actor_id,operation_type,p_reservation_date,next_turn,
    p_num_guests,destination_total,destination_total+p_num_guests
  );
  perform set_config('app.reservation_capacity_override_use_id', use_id::text, true);
  return query update public.reservations
    set reservation_date = p_reservation_date,
        reservation_time = p_reservation_time,
        num_guests = p_num_guests
    where reservations.id = p_reservation_id
    returning reservations.id, reservations.reservation_date,
      reservations.reservation_time, reservations.num_guests;
  perform set_config('app.reservation_capacity_override_use_id','',true);
end;
$$;

create or replace function public.update_reservation_with_authorized_overrides(
  p_reservation_id uuid,
  p_reservation_date date,
  p_reservation_time time,
  p_num_guests integer,
  p_capacity_override_reason text default null,
  p_schedule_override_reason text default null,
  p_commercial_turn text default null
)
returns table (id uuid, reservation_date date, reservation_time time, num_guests integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  reservation_row public.reservations%rowtype;
  next_turn text;
  capacity_reason text := nullif(btrim(p_capacity_override_reason), '');
  schedule_reason text := nullif(btrim(p_schedule_override_reason), '');
  usage_id uuid;
  destination_total integer;
  operation_type text;
begin
  if capacity_reason is null and schedule_reason is null then raise exception 'RESERVATION_OVERRIDE_REQUIRED'; end if;
  if capacity_reason is not null and (not public.can_override_reservation_capacity() or char_length(capacity_reason) not between 3 and 1000) then
    raise exception 'CAPACITY_OVERRIDE_NOT_AUTHORIZED';
  end if;
  if schedule_reason is not null then
    if not public.is_reservation_admin_or_owner() then raise exception 'SCHEDULE_OVERRIDE_NOT_AUTHORIZED'; end if;
    if char_length(schedule_reason) not between 3 and 1000 then raise exception 'INVALID_SCHEDULE_OVERRIDE_REASON'; end if;
    if p_commercial_turn not in ('lunch', 'dinner')
       or not public.reservation_commercial_turn_is_available(p_reservation_date, p_commercial_turn) then
      raise exception 'RESERVATION_COMMERCIAL_TURN_REQUIRED';
    end if;
  end if;
  if p_num_guests not between 1 and 30 then raise exception 'INVALID_GUEST_COUNT'; end if;
  select * into reservation_row from public.reservations where reservations.id = p_reservation_id for update;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if lower(coalesce(reservation_row.status, 'pending')) in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show') then
    raise exception 'RESERVATION_NOT_EDITABLE';
  end if;
  next_turn := coalesce(public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time), p_commercial_turn);
  if next_turn is null then raise exception 'RESERVATION_TIME_UNAVAILABLE'; end if;
  operation_type := case
    when reservation_row.reservation_date <> p_reservation_date or reservation_row.commercial_turn <> next_turn then 'move'
    when p_num_guests > reservation_row.num_guests then 'increase'
    else null
  end;
  if capacity_reason is not null and operation_type is null then raise exception 'CAPACITY_OVERRIDE_NOT_NEEDED'; end if;

  perform pg_advisory_xact_lock(hashtext('reservation-capacity:' || lock_turn.lock_key))
  from (
    select distinct turns.reservation_date::text || ':' || turns.commercial_turn as lock_key
    from (
      select p_reservation_date as reservation_date, next_turn as commercial_turn
      union all
      select reservation_row.reservation_date, reservation_row.commercial_turn
    ) turns
    order by 1
  ) lock_turn;

  if capacity_reason is not null then
    select coalesce(sum(reservations.num_guests), 0) into destination_total
      from public.reservations
     where reservations.reservation_date = p_reservation_date
       and reservations.commercial_turn = next_turn
       and reservations.source <> 'walk_in'
       and lower(coalesce(reservations.status, 'pending')) not in ('cancelled', 'cancelado')
       and reservations.id <> p_reservation_id;
    if destination_total + p_num_guests <= 80 then raise exception 'CAPACITY_OVERRIDE_NOT_NEEDED'; end if;
    usage_id := gen_random_uuid();
    insert into public.reservation_capacity_override_uses (
      id, reservation_id, actor_id, reason, operation,
      previous_reservation_date, previous_commercial_turn, previous_num_guests,
      next_reservation_date, next_commercial_turn, next_num_guests,
      occupied_before, occupied_after
    ) values (
      usage_id, reservation_row.id, actor_id, capacity_reason, operation_type,
      reservation_row.reservation_date, reservation_row.commercial_turn, reservation_row.num_guests,
      p_reservation_date, next_turn, p_num_guests, destination_total, destination_total + p_num_guests
    );
    insert into public.reservation_capacity_override_nonces (
      id,reservation_id,actor_id,operation,next_reservation_date,next_commercial_turn,
      next_num_guests,occupied_before,occupied_after
    ) values (
      usage_id,reservation_row.id,actor_id,operation_type,p_reservation_date,next_turn,
      p_num_guests,destination_total,destination_total+p_num_guests
    );
    perform set_config('app.reservation_capacity_override_use_id', usage_id::text, true);
  end if;

  if schedule_reason is not null then perform set_config('app.reservation_schedule_override', 'enabled', true); end if;
  return query update public.reservations
    set reservation_date = p_reservation_date,
        reservation_time = p_reservation_time,
        num_guests = p_num_guests,
        commercial_turn = next_turn
    where reservations.id = p_reservation_id
    returning reservations.id, reservations.reservation_date,
      reservations.reservation_time, reservations.num_guests;

  if schedule_reason is not null then
    insert into public.reservation_override_audits (
      reservation_id, override_type, authorized_by, reason,
      reservation_date, service_starts_at, effect
    ) values (
      reservation_row.id, 'schedule', actor_id, schedule_reason,
      p_reservation_date,
      coalesce(public.get_reservation_service_start_for_commercial_turn(p_reservation_date, next_turn), p_reservation_time),
      jsonb_build_object('operation', 'move', 'from_date', reservation_row.reservation_date,
        'from_turn', reservation_row.commercial_turn, 'to_date', p_reservation_date,
        'to_turn', next_turn, 'reservation_time', p_reservation_time, 'outside_schedule', true)
    );
  end if;
  perform set_config('app.reservation_capacity_override_use_id','',true);
  perform set_config('app.reservation_schedule_override','',true);
end;
$$;

create or replace function public.create_walk_in_reservation(
  p_name text, p_email text, p_whatsapp text, p_reservation_date date,
  p_reservation_time time, p_num_guests integer, p_notes text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_reservation_staff() then raise exception 'RESERVATION_STAFF_REQUIRED'; end if;
  if p_reservation_date <> timezone('America/Porto_Velho', now())::date then raise exception 'WALK_IN_DATE_REQUIRED'; end if;
  if char_length(btrim(p_name)) not between 2 and 120
     or char_length(regexp_replace(p_whatsapp, '\D', '', 'g')) not between 10 and 13
     or p_num_guests not between 1 and 30 then raise exception 'INVALID_WALK_IN'; end if;
  perform set_config('app.reservation_walk_in', 'enabled', true);
  return query insert into public.reservations (
    name, email, whatsapp, reservation_date, reservation_time, num_guests,
    notes, status, source, arrived_at
  ) values (
    btrim(p_name), coalesce(nullif(btrim(p_email), ''), 'walkin@local.invalid'),
    p_whatsapp, p_reservation_date, p_reservation_time, p_num_guests,
    nullif(btrim(p_notes), ''), 'confirmed', 'walk_in', now()
  ) returning reservations.id;
end;
$$;

create or replace function public.classify_reservation_commercial_turn(
  p_reservation_id uuid, p_commercial_turn text, p_reason text
)
returns table (id uuid, commercial_turn text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_reservation_owner() then raise exception 'OWNER_REQUIRED'; end if;
  if reason is null or char_length(reason) not between 3 and 1000 then raise exception 'INVALID_TURN_CLASSIFICATION_REASON'; end if;
  if p_commercial_turn not in ('lunch', 'dinner') then raise exception 'INVALID_RESERVATION_COMMERCIAL_TURN'; end if;
  perform 1 from public.reservations
    where reservations.id = p_reservation_id and reservations.commercial_turn is null
      and lower(coalesce(reservations.status, 'pending')) not in ('cancelled', 'cancelado')
      and reservations.source <> 'walk_in'
    for update;
  if not found then raise exception 'RESERVATION_TURN_CLASSIFICATION_NOT_REQUIRED'; end if;
  if not public.reservation_commercial_turn_is_available(
    (select reservation_date from public.reservations where reservations.id = p_reservation_id), p_commercial_turn
  ) then raise exception 'INVALID_RESERVATION_COMMERCIAL_TURN'; end if;
  perform set_config('app.reservation_turn_classification', 'enabled', true);
  return query update public.reservations
    set commercial_turn = p_commercial_turn,
        service_starts_at = public.get_reservation_service_start_for_commercial_turn(reservation_date, p_commercial_turn)
    where reservations.id = p_reservation_id
    returning reservations.id, reservations.commercial_turn;
  insert into public.reservation_events (reservation_id, event_type, actor_type, metadata)
  values (p_reservation_id, 'updated', 'staff', jsonb_build_object(
    'commercial_turn_classification', true, 'commercial_turn', p_commercial_turn,
    'reason', reason, 'authorized_by', auth.uid()
  ));
end;
$$;

create or replace function public.record_reservation_override_audits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Compatibility for authorized historical schedule exceptions. Each event
  -- is appended; capacity usage has its own append-only ledger.
  if new.schedule_override_reason is not null
     and (tg_op = 'INSERT' or new.reservation_date is distinct from old.reservation_date
       or new.reservation_time is distinct from old.reservation_time) then
    insert into public.reservation_override_audits (
      reservation_id, override_type, authorized_by, reason,
      reservation_date, service_starts_at, effect
    ) values (
      new.id, 'schedule', new.schedule_override_authorized_by,
      new.schedule_override_reason, new.reservation_date,
      new.service_starts_at,
      jsonb_build_object('operation', case when tg_op = 'INSERT' then 'create' else 'move' end,
        'reservation_time', new.reservation_time, 'commercial_turn', new.commercial_turn,
        'outside_schedule', true)
    );
  end if;
  return new;
end;
$$;

create or replace function public.get_reservation_service_starts_at(
  p_reservation_date date,
  p_reservation_time time
)
returns time
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with has_date_override as (
    select exists (select 1 from public.reservation_schedule_date_slots where reservation_date = p_reservation_date) as value
  ), slots as (
    select starts_at from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date and active and p_reservation_time between starts_at and ends_at
    union all
    select starts_at from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active and p_reservation_time between starts_at and ends_at
      and not (select value from has_date_override)
  )
  select min(starts_at) from slots;
$$;

create or replace function public.validate_reservation_schedule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time then
    if not public.reservation_time_is_available(new.reservation_date, new.reservation_time)
       and current_setting('app.reservation_schedule_override', true) is distinct from 'enabled' then
      raise exception 'RESERVATION_TIME_UNAVAILABLE';
    end if;
    if coalesce(new.source, 'website') <> 'walk_in'
       and new.reservation_date::timestamp + new.reservation_time
         < timezone('America/Porto_Velho', now()) + interval '8 hours' then
      raise exception 'RESERVATION_LEAD_TIME_NOT_MET';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_reservation_decoration_service_period()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.decoration_id is null then
    new.decoration_service_starts_at := null;
    return new;
  end if;
  new.decoration_service_starts_at := public.get_reservation_service_starts_at(new.reservation_date, new.reservation_time);
  if new.decoration_service_starts_at is null
     and current_setting('app.reservation_schedule_override', true) = 'enabled' then
    new.decoration_service_starts_at := new.service_starts_at;
  end if;
  if new.decoration_service_starts_at is null then raise exception 'DECORATION_SERVICE_PERIOD_NOT_FOUND'; end if;
  return new;
end;
$$;

drop function if exists public.get_reservation_capacity_availability(date, date);
create function public.get_reservation_capacity_availability(
  p_from date, p_to date
)
returns table (
  reservation_date date, reservation_time time, service_starts_at time,
  commercial_turn text, occupied_guests integer, has_unclassified_reservation boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with slots as (
    select available.reservation_date, available.reservation_time,
      public.get_reservation_service_starts_at(available.reservation_date, available.reservation_time) as service_starts_at,
      public.get_reservation_commercial_turn(available.reservation_date, available.reservation_time) as commercial_turn
    from public.get_reservation_available_times(p_from, p_to) available
  ), unclassified as (
    select reservation_date from public.reservation_turn_classification_issues group by reservation_date
  )
  select slots.reservation_date, slots.reservation_time, slots.service_starts_at,
    slots.commercial_turn, coalesce(sum(reservations.num_guests), 0)::integer,
    unclassified.reservation_date is not null
  from slots
  left join public.reservations on reservations.reservation_date = slots.reservation_date
    and reservations.commercial_turn = slots.commercial_turn
    and reservations.source <> 'walk_in'
    and lower(coalesce(reservations.status, 'pending')) not in ('cancelled', 'cancelado')
  left join unclassified on unclassified.reservation_date = slots.reservation_date
  where slots.commercial_turn is not null
  group by slots.reservation_date, slots.reservation_time, slots.service_starts_at,
    slots.commercial_turn, unclassified.reservation_date
  order by slots.reservation_date, slots.reservation_time;
$$;

-- Authenticated clients can keep reading through existing policies but cannot
-- bypass the audited RPC/service boundary with table writes.
drop policy if exists "Managers can manage reservations" on public.reservations;
revoke insert, update, delete, truncate on public.reservations from public, anon, authenticated;

drop policy if exists "Managers can manage reservation schedule slots" on public.reservation_schedule_slots;
drop policy if exists "Managers can manage date schedule slots" on public.reservation_schedule_date_slots;
create policy "Owners can manage reservation schedule slots"
  on public.reservation_schedule_slots for all to authenticated
  using (public.is_reservation_owner()) with check (public.is_reservation_owner());
create policy "Owners can manage date schedule slots"
  on public.reservation_schedule_date_slots for all to authenticated
  using (public.is_reservation_owner()) with check (public.is_reservation_owner());

create or replace function public.reject_capacity_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'CAPACITY_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists reservation_capacity_permission_audit_immutable on public.reservation_capacity_permission_audits;
create trigger reservation_capacity_permission_audit_immutable
  before update or delete on public.reservation_capacity_permission_audits
  for each row execute function public.reject_capacity_audit_mutation();
drop trigger if exists reservation_capacity_override_use_immutable on public.reservation_capacity_override_uses;
create trigger reservation_capacity_override_use_immutable
  before update or delete on public.reservation_capacity_override_uses
  for each row execute function public.reject_capacity_audit_mutation();
drop trigger if exists reservation_schedule_override_audit_immutable on public.reservation_override_audits;
create trigger reservation_schedule_override_audit_immutable
  before update or delete on public.reservation_override_audits
  for each row execute function public.reject_capacity_audit_mutation();

revoke insert, update, delete, truncate on public.reservation_capacity_permissions,
  public.reservation_capacity_permission_audits, public.reservation_capacity_override_uses,
  public.reservation_capacity_override_nonces,
  public.reservation_override_audits from public, anon, authenticated;

create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and (auth.uid() = old.id or new.role = 'dono' or old.role = 'dono') then
    raise exception 'OWNER_ROLE_CHANGE_REQUIRES_APPROVED_PROCEDURE';
  end if;
  if auth.uid() = old.id and (new.role is distinct from old.role or new.job_role_id is distinct from old.job_role_id) then
    raise exception 'You cannot change your role or job assignment';
  end if;
  return new;
end;
$$;

revoke all on function public.is_reservation_admin_or_owner() from public, anon;
revoke all on function public.can_override_reservation_capacity() from public, anon;
revoke all on function public.set_reservation_capacity_permission(uuid, boolean, text) from public, anon;
revoke all on function public.get_reservation_commercial_turn(date, time) from public, anon, authenticated;
revoke all on function public.reservation_commercial_turn_is_available(date, text) from public, anon, authenticated;
revoke all on function public.get_reservation_service_start_for_commercial_turn(date, text) from public, anon, authenticated;
revoke all on function public.protect_reservation_capacity_controls() from public, anon, authenticated;
revoke all on function public.reject_capacity_audit_mutation() from public, anon, authenticated;
revoke all on function public.create_reservation_with_authorized_overrides(text, text, text, date, time, integer, text, uuid, uuid, text, text, numeric, text, text, text, text) from public, anon;
revoke all on function public.update_reservation_with_capacity_override(uuid, date, time, integer, text) from public, anon;
revoke all on function public.update_reservation_with_authorized_overrides(uuid, date, time, integer, text, text, text) from public, anon;
revoke all on function public.create_walk_in_reservation(text, text, text, date, time, integer, text) from public, anon;
revoke all on function public.classify_reservation_commercial_turn(uuid, text, text) from public, anon;
revoke all on function public.get_reservation_capacity_availability(date, date) from public, anon, authenticated;

grant execute on function public.is_reservation_owner() to authenticated;
grant execute on function public.is_reservation_admin_or_owner() to authenticated;
grant execute on function public.can_override_reservation_capacity() to authenticated;
grant execute on function public.set_reservation_capacity_permission(uuid, boolean, text) to authenticated;
grant execute on function public.create_reservation_with_authorized_overrides(text, text, text, date, time, integer, text, uuid, uuid, text, text, numeric, text, text, text, text) to authenticated;
grant execute on function public.update_reservation_with_capacity_override(uuid, date, time, integer, text) to authenticated;
grant execute on function public.update_reservation_with_authorized_overrides(uuid, date, time, integer, text, text, text) to authenticated;
grant execute on function public.create_walk_in_reservation(text, text, text, date, time, integer, text) to authenticated;
grant execute on function public.classify_reservation_commercial_turn(uuid, text, text) to authenticated;
grant execute on function public.get_reservation_capacity_availability(date, date) to service_role;
grant execute on function public.get_reservation_service_starts_at(date, time) to service_role;
grant select on public.reservation_capacity_permissions, public.reservation_capacity_permission_audits, public.reservation_capacity_override_uses to authenticated;

commit;
