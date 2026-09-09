begin;

alter table public.reservations
  add column if not exists source text not null default 'website' check (source in ('website', 'admin', 'walk_in', 'waitlist', 'import', 'other')),
  add column if not exists arrived_at timestamptz,
  add column if not exists seated_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.reservation_events drop constraint if exists reservation_events_event_type_check;
alter table public.reservation_events add constraint reservation_events_event_type_check check (event_type in ('created', 'rescheduled', 'guests_changed', 'status_changed', 'payment_changed', 'arrival_recorded', 'table_assigned', 'waitlist_converted', 'updated'));

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text not null check (char_length(regexp_replace(phone, '\\D', '', 'g')) between 10 and 13),
  party_size integer not null check (party_size between 1 and 30),
  preferred_area_id uuid references public.restaurant_areas(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'waiting' check (status in ('waiting', 'called', 'seated', 'cancelled', 'left')),
  seated_at timestamptz,
  cancelled_at timestamptz,
  reservation_id uuid unique references public.reservations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index waitlist_entries_active_idx on public.waitlist_entries (status, created_at) where status in ('waiting', 'called');
create index reservations_operational_day_idx on public.reservations (reservation_date, reservation_time, status);
alter table public.waitlist_entries enable row level security;
create policy "Reservation staff can read waitlist" on public.waitlist_entries for select to authenticated using (private.is_reservation_staff());
create policy "Managers can manage waitlist" on public.waitlist_entries for all to authenticated using (private.is_manager()) with check (private.is_manager());

create or replace function public.record_reservation_operational_events()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.arrived_at is distinct from old.arrived_at and new.arrived_at is not null then
    insert into public.reservation_events (reservation_id, event_type, actor_type, metadata) values (new.id, 'arrival_recorded', 'staff', jsonb_build_object('arrived_at', new.arrived_at));
  end if;
  if new.seated_at is distinct from old.seated_at and new.seated_at is not null then
    insert into public.reservation_events (reservation_id, event_type, actor_type, metadata) values (new.id, 'status_changed', 'staff', jsonb_build_object('seated_at', new.seated_at));
  end if;
  return new;
end $$;
create trigger record_reservation_operational_events after update of arrived_at, seated_at on public.reservations for each row execute function public.record_reservation_operational_events();

create or replace function public.transition_reservation_status(p_reservation_id uuid, p_expected_statuses text[], p_next_status text)
returns table (id uuid, status text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_next_status not in ('confirmed', 'seated', 'completed', 'no_show', 'cancelled') then raise exception 'INVALID_RESERVATION_STATUS_TRANSITION'; end if;
  return query update public.reservations set status = p_next_status, seated_at = case when p_next_status = 'seated' then coalesce(reservations.seated_at, now()) else reservations.seated_at end, completed_at = case when p_next_status = 'completed' then now() else reservations.completed_at end where reservations.id = p_reservation_id and lower(coalesce(reservations.status, 'pending')) = any (p_expected_statuses) and ((lower(coalesce(reservations.status, 'pending')) = 'pending' and p_next_status in ('confirmed', 'cancelled')) or (lower(coalesce(reservations.status, 'pending')) = 'confirmed' and p_next_status in ('seated', 'no_show', 'cancelled')) or (lower(coalesce(reservations.status, 'pending')) = 'seated' and p_next_status = 'completed')) returning reservations.id, reservations.status;
end $$;

revoke all on function public.record_reservation_operational_events() from public, anon, authenticated;
grant execute on function public.transition_reservation_status(uuid, text[], text) to service_role;
commit;
