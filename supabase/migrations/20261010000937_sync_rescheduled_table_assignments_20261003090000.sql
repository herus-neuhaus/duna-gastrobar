begin;

-- One calculation is shared by new allocations and rescheduling. Passing the
-- proposed date/time avoids reading the pre-update reservation row in a BEFORE trigger.
create or replace function private.get_reservation_occupancy_window_for_slot(
  p_reservation_date date,
  p_reservation_time time
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  duration_minutes integer;
  buffer_minutes integer;
  service_start timestamptz;
begin
  select slot.reservation_duration_minutes, slot.turnover_buffer_minutes
    into duration_minutes, buffer_minutes
  from (
    select date_slot.reservation_duration_minutes, date_slot.turnover_buffer_minutes
    from public.reservation_schedule_date_slots date_slot
    where date_slot.reservation_date = p_reservation_date
      and date_slot.active
      and p_reservation_time between date_slot.starts_at and date_slot.ends_at

    union all

    select weekly_slot.reservation_duration_minutes, weekly_slot.turnover_buffer_minutes
    from public.reservation_schedule_slots weekly_slot
    where weekly_slot.day_of_week = extract(dow from p_reservation_date)::smallint
      and weekly_slot.active
      and p_reservation_time between weekly_slot.starts_at and weekly_slot.ends_at
      and not exists (
        select 1
        from public.reservation_schedule_date_slots
        where reservation_date = p_reservation_date
      )
  ) slot
  limit 1;

  if duration_minutes is null then
    raise exception 'RESERVATION_SCHEDULE_NOT_FOUND';
  end if;

  service_start := timezone('America/Porto_Velho', p_reservation_date + p_reservation_time);
  return query select service_start, service_start + make_interval(mins => duration_minutes + buffer_minutes);
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
  select * into reservation_row
  from public.reservations
  where id = p_reservation_id;

  if reservation_row.id is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  return query
  select *
  from private.get_reservation_occupancy_window_for_slot(
    reservation_row.reservation_date,
    reservation_row.reservation_time
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
    -- Match the lock order used by table replacement, preventing competing
    -- reschedules/replacements from observing a partial assignment set.
    perform pg_advisory_xact_lock(hashtext('restaurant-table:' || assignment.table_id::text))
    from (
      select table_id
      from public.reservation_table_assignments
      where reservation_id = new.id
        and released_at is null
      order by table_id
    ) assignment;

    select * into occupancy
    from private.get_reservation_occupancy_window_for_slot(
      new.reservation_date,
      new.reservation_time
    );

    update public.reservation_table_assignments
       set starts_at = occupancy.starts_at,
           ends_at = occupancy.ends_at
     where reservation_id = new.id
       and released_at is null;
  end if;

  if new.num_guests is distinct from old.num_guests and exists (
    select 1
    from public.reservation_table_assignments
    where reservation_id = new.id
      and released_at is null
  ) and new.num_guests > (
    select coalesce(sum(allocated_capacity), 0)
    from public.reservation_table_assignments
    where reservation_id = new.id
      and released_at is null
  ) then
    raise exception 'TABLE_ASSIGNMENT_CAPACITY_INSUFFICIENT';
  end if;

  return new;
end;
$$;

revoke all on function private.get_reservation_occupancy_window_for_slot(date, time)
  from public, anon, authenticated;

commit;
