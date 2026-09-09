begin;

create extension if not exists btree_gist with schema extensions;

alter table public.reservation_schedule_slots
  add column if not exists reservation_duration_minutes integer not null default 120
    check (reservation_duration_minutes between 30 and 480),
  add column if not exists turnover_buffer_minutes integer not null default 30
    check (turnover_buffer_minutes between 0 and 120);

alter table public.reservation_schedule_date_slots
  add column if not exists reservation_duration_minutes integer not null default 120
    check (reservation_duration_minutes between 30 and 480),
  add column if not exists turnover_buffer_minutes integer not null default 30
    check (turnover_buffer_minutes between 0 and 120);

create table public.restaurant_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(btrim(description)) <= 500),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.restaurant_areas(id) on delete restrict,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  min_capacity integer not null check (min_capacity > 0),
  max_capacity integer not null check (max_capacity >= min_capacity),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create index restaurant_tables_area_active_idx
  on public.restaurant_tables (area_id, active, max_capacity);

create table public.reservation_table_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  allocated_capacity integer not null check (allocated_capacity > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  occupancy_range tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (reservation_id, table_id, assigned_at)
);

create index reservation_table_assignments_reservation_active_idx
  on public.reservation_table_assignments (reservation_id, released_at)
  where released_at is null;

create index reservation_table_assignments_assigned_by_idx
  on public.reservation_table_assignments (assigned_by)
  where assigned_by is not null;

alter table public.reservation_table_assignments
  add constraint reservation_table_assignments_no_overlap
  exclude using gist (table_id with =, occupancy_range with &&)
  where (released_at is null);

alter table public.restaurant_areas enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.reservation_table_assignments enable row level security;

create policy "Reservation staff can read restaurant areas"
  on public.restaurant_areas for select to authenticated using (private.is_reservation_staff());
create policy "Reservation staff can read restaurant tables"
  on public.restaurant_tables for select to authenticated using (private.is_reservation_staff());
create policy "Reservation staff can read table assignments"
  on public.reservation_table_assignments for select to authenticated using (private.is_reservation_staff());
create policy "Managers can manage restaurant areas"
  on public.restaurant_areas for all to authenticated using (private.is_manager()) with check (private.is_manager());
create policy "Managers can manage restaurant tables"
  on public.restaurant_tables for all to authenticated using (private.is_manager()) with check (private.is_manager());

create or replace function public.get_reservation_occupancy_window(p_reservation_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  duration_minutes integer;
  buffer_minutes integer;
  service_start timestamptz;
begin
  select * into reservation_row from public.reservations where id = p_reservation_id;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;

  select slot.reservation_duration_minutes, slot.turnover_buffer_minutes
    into duration_minutes, buffer_minutes
  from (
    select reservation_duration_minutes, turnover_buffer_minutes
    from public.reservation_schedule_date_slots date_slot
    where date_slot.reservation_date = reservation_row.reservation_date
      and date_slot.active
      and reservation_row.reservation_time between date_slot.starts_at and date_slot.ends_at
    union all
    select reservation_duration_minutes, turnover_buffer_minutes
    from public.reservation_schedule_slots weekly_slot
    where weekly_slot.day_of_week = extract(dow from reservation_row.reservation_date)::smallint
      and weekly_slot.active
      and reservation_row.reservation_time between weekly_slot.starts_at and weekly_slot.ends_at
      and not exists (
        select 1 from public.reservation_schedule_date_slots
        where reservation_date = reservation_row.reservation_date
      )
  ) slot
  limit 1;

  if duration_minutes is null then raise exception 'RESERVATION_SCHEDULE_NOT_FOUND'; end if;

  service_start := timezone('America/Porto_Velho', reservation_row.reservation_date + reservation_row.reservation_time);
  return query select service_start, service_start + make_interval(mins => duration_minutes + buffer_minutes);
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
    select * into occupancy from public.get_reservation_occupancy_window(new.id);
    update public.reservation_table_assignments
       set starts_at = occupancy.starts_at,
           ends_at = occupancy.ends_at
     where reservation_id = new.id and released_at is null;
  end if;

  if new.num_guests is distinct from old.num_guests and exists (
    select 1 from public.reservation_table_assignments where reservation_id = new.id and released_at is null
  ) and new.num_guests > (
    select coalesce(sum(allocated_capacity), 0)
    from public.reservation_table_assignments where reservation_id = new.id and released_at is null
  ) then
    raise exception 'TABLE_ASSIGNMENT_CAPACITY_INSUFFICIENT';
  end if;

  return new;
end;
$$;

create trigger sync_reservation_table_assignments
  before update of reservation_date, reservation_time, num_guests on public.reservations
  for each row execute function public.sync_reservation_table_assignments();

create or replace function public.release_terminal_reservation_tables()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.status, 'pending')) in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show')
     and lower(coalesce(old.status, 'pending')) not in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show') then
    update public.reservation_table_assignments
       set released_at = now()
     where reservation_id = new.id and released_at is null;
  end if;
  return new;
end;
$$;

create trigger release_terminal_reservation_tables
  after update of status on public.reservations
  for each row execute function public.release_terminal_reservation_tables();

create or replace function public.replace_reservation_table_assignments(
  p_reservation_id uuid,
  p_table_ids uuid[],
  p_assigned_by uuid default null
)
returns table (id uuid, table_id uuid, allocated_capacity integer, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  occupancy record;
  selected_count integer;
  selected_min_capacity integer;
  selected_max_capacity integer;
  selected_area_count integer;
begin
  select * into reservation_row from public.reservations where reservations.id = p_reservation_id for update;
  if reservation_row.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if lower(coalesce(reservation_row.status, 'pending')) not in ('pending', 'confirmed', 'seated') then
    raise exception 'RESERVATION_NOT_ASSIGNABLE';
  end if;
  if p_table_ids is null or cardinality(p_table_ids) = 0 or cardinality(p_table_ids) <> cardinality(array(select distinct unnest(p_table_ids))) then
    raise exception 'INVALID_TABLE_SELECTION';
  end if;

  perform pg_advisory_xact_lock(hashtext('restaurant-table:' || tables_to_lock.table_id::text))
  from (select unnest(p_table_ids) as table_id order by 1) tables_to_lock;

  select count(*), coalesce(sum(min_capacity), 0), coalesce(sum(max_capacity), 0), count(distinct area_id)
    into selected_count, selected_min_capacity, selected_max_capacity, selected_area_count
  from public.restaurant_tables
  where id = any(p_table_ids) and active;

  if selected_count <> cardinality(p_table_ids) then raise exception 'TABLE_NOT_AVAILABLE'; end if;
  if selected_area_count <> 1 then raise exception 'TABLES_MUST_SHARE_AREA'; end if;
  if reservation_row.num_guests not between selected_min_capacity and selected_max_capacity then
    raise exception 'TABLE_CAPACITY_INSUFFICIENT';
  end if;

  select * into occupancy from public.get_reservation_occupancy_window(p_reservation_id);

  -- The transaction rolls back both release and inserts if any selected table conflicts.
  update public.reservation_table_assignments
     set released_at = now()
   where reservation_id = p_reservation_id and released_at is null;

  return query
  insert into public.reservation_table_assignments (
    reservation_id, table_id, allocated_capacity, starts_at, ends_at, assigned_by
  )
  select p_reservation_id, restaurant_tables.id, restaurant_tables.max_capacity,
    occupancy.starts_at, occupancy.ends_at, p_assigned_by
  from public.restaurant_tables
  where restaurant_tables.id = any(p_table_ids)
  returning reservation_table_assignments.id, reservation_table_assignments.table_id,
    reservation_table_assignments.allocated_capacity, reservation_table_assignments.starts_at,
    reservation_table_assignments.ends_at;
end;
$$;

create or replace function public.get_reservation_table_availability(
  p_reservation_id uuid
)
returns table (
  table_id uuid,
  area_id uuid,
  area_name text,
  table_code text,
  min_capacity integer,
  max_capacity integer,
  active boolean,
  available boolean,
  reason text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with occupancy as (
    select * from public.get_reservation_occupancy_window(p_reservation_id)
  ), conflicts as (
    select assignment.table_id, min(assignment.ends_at) as available_after
    from public.reservation_table_assignments assignment, occupancy
    where assignment.released_at is null
      and assignment.reservation_id <> p_reservation_id
      and assignment.occupancy_range && tstzrange(occupancy.starts_at, occupancy.ends_at, '[)')
    group by assignment.table_id
  )
  select
    restaurant_tables.id,
    restaurant_tables.area_id,
    restaurant_areas.name,
    restaurant_tables.code,
    restaurant_tables.min_capacity,
    restaurant_tables.max_capacity,
    restaurant_tables.active,
    restaurant_tables.active and restaurant_areas.active and conflicts.table_id is null,
    case
      when not restaurant_tables.active then 'Mesa inativa'
      when not restaurant_areas.active then 'Área inativa'
      when conflicts.table_id is not null then 'Ocupada até ' || to_char(conflicts.available_after at time zone 'America/Porto_Velho', 'HH24:MI')
      else null
    end
  from public.restaurant_tables
  join public.restaurant_areas on restaurant_areas.id = restaurant_tables.area_id
  left join conflicts on conflicts.table_id = restaurant_tables.id
  order by restaurant_areas.display_order, restaurant_areas.name, restaurant_tables.max_capacity, restaurant_tables.code;
$$;

revoke all on function public.get_reservation_occupancy_window(uuid) from public, anon, authenticated;
revoke all on function public.sync_reservation_table_assignments() from public, anon, authenticated;
revoke all on function public.release_terminal_reservation_tables() from public, anon, authenticated;
revoke all on function public.replace_reservation_table_assignments(uuid, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.get_reservation_table_availability(uuid) from public, anon, authenticated;
grant execute on function public.get_reservation_occupancy_window(uuid) to service_role;
grant execute on function public.replace_reservation_table_assignments(uuid, uuid[], uuid) to service_role;
grant execute on function public.get_reservation_table_availability(uuid) to service_role;

commit;
