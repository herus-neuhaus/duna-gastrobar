begin;

-- Friday through Sunday now have independent lunch and dinner services.
update public.reservation_schedule_slots
set ends_at = '13:30'
where day_of_week in (0, 5, 6)
  and starts_at = '12:00'
  and ends_at = '20:00';

insert into public.reservation_schedule_slots (day_of_week, starts_at, ends_at)
values
  (0, '18:00', '21:00'),
  (5, '18:00', '21:00'),
  (6, '18:00', '21:00')
on conflict (day_of_week, starts_at) do update
set ends_at = excluded.ends_at,
    active = true;

alter table public.reservations
  add column if not exists decoration_service_starts_at time;

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
    select exists (
      select 1
      from public.reservation_schedule_date_slots
      where reservation_date = p_reservation_date
    ) as value
  ), slots as (
    select starts_at
    from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date
      and active
      and p_reservation_time between starts_at and ends_at

    union all

    select starts_at
    from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and p_reservation_time between starts_at and ends_at
      and not (select value from has_date_override)
  )
  select starts_at
  from slots
  order by starts_at
  limit 1;
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

  new.decoration_service_starts_at := public.get_reservation_service_starts_at(
    new.reservation_date,
    new.reservation_time
  );

  if new.decoration_service_starts_at is null then
    raise exception 'DECORATION_SERVICE_PERIOD_NOT_FOUND';
  end if;

  return new;
end;
$$;

drop trigger if exists set_reservation_decoration_service_period on public.reservations;
create trigger set_reservation_decoration_service_period
before insert or update of decoration_id, reservation_date, reservation_time on public.reservations
for each row execute function public.set_reservation_decoration_service_period();

update public.reservations
set decoration_service_starts_at = public.get_reservation_service_starts_at(
  reservation_date,
  reservation_time
)
where decoration_id is not null;

create unique index if not exists reservations_active_decoration_period_unique
  on public.reservations (reservation_date, decoration_id, decoration_service_starts_at)
  where decoration_id is not null
    and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show');

create or replace function public.get_reservation_decoration_availability(
  p_reservation_date date,
  p_reservation_time time
)
returns table (decoration_id uuid, available boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected_period as (
    select public.get_reservation_service_starts_at(
      p_reservation_date,
      p_reservation_time
    ) as starts_at
  )
  select
    decorations.id,
    selected_period.starts_at is not null
      and not exists (
        select 1
        from public.reservations
        where reservation_date = p_reservation_date
          and decoration_id = decorations.id
          and decoration_service_starts_at = selected_period.starts_at
          and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show')
      )
  from public.decorations
  cross join selected_period
  where decorations.active;
$$;

revoke all on function public.get_reservation_service_starts_at(date, time) from public, anon, authenticated;
revoke all on function public.set_reservation_decoration_service_period() from public, anon, authenticated;
revoke all on function public.get_reservation_decoration_availability(date, time) from public, anon, authenticated;
grant execute on function public.get_reservation_service_starts_at(date, time) to service_role;
grant execute on function public.get_reservation_decoration_availability(date, time) to service_role;

commit;
