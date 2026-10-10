begin;

-- A reservation keeps the service it was booked into. This prevents later
-- schedule edits from silently moving historical reservations between turns.
alter table public.reservations
  add column if not exists service_starts_at time,
  add column if not exists capacity_override_reason text,
  add column if not exists capacity_override_authorized_by uuid references public.profiles(id),
  add column if not exists capacity_override_authorized_at timestamptz,
  add column if not exists capacity_override_effect jsonb not null default '{}'::jsonb,
  add column if not exists schedule_override_reason text,
  add column if not exists schedule_override_authorized_by uuid references public.profiles(id),
  add column if not exists schedule_override_authorized_at timestamptz;

alter table public.reservations
  drop constraint if exists reservations_capacity_override_authorization_check,
  add constraint reservations_capacity_override_authorization_check check (
    (capacity_override_reason is null
      and capacity_override_authorized_by is null
      and capacity_override_authorized_at is null)
    or (
      char_length(btrim(capacity_override_reason)) between 3 and 1000
      and capacity_override_authorized_by is not null
      and capacity_override_authorized_at is not null
    )
  ),
  drop constraint if exists reservations_schedule_override_authorization_check,
  add constraint reservations_schedule_override_authorization_check check (
    (schedule_override_reason is null
      and schedule_override_authorized_by is null
      and schedule_override_authorized_at is null)
    or (
      char_length(btrim(schedule_override_reason)) between 3 and 1000
      and schedule_override_authorized_by is not null
      and schedule_override_authorized_at is not null
    )
  );

create index if not exists reservations_capacity_service_idx
  on public.reservations (reservation_date, service_starts_at)
  where lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
    and source <> 'walk_in';

create table if not exists public.reservation_override_audits (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  override_type text not null check (override_type in ('capacity', 'schedule')),
  authorized_by uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  reservation_date date not null,
  service_starts_at time not null,
  effect jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reservation_id, override_type)
);

create index if not exists reservation_override_audits_date_service_idx
  on public.reservation_override_audits (reservation_date, service_starts_at);

alter table public.reservation_override_audits enable row level security;

create or replace function public.is_reservation_owner()
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
      and role = 'dono'
      and not coalesce(force_password_change, false)
  );
$$;

create policy "Owners can read reservation override audits"
  on public.reservation_override_audits for select to authenticated
  using (public.is_reservation_owner());

create or replace function public.reservation_service_start_is_available(
  p_reservation_date date,
  p_service_starts_at time
)
returns boolean
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
  )
  select exists (
    select 1
    from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date
      and active
      and starts_at = p_service_starts_at

    union all

    select 1
    from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and starts_at = p_service_starts_at
      and not (select value from has_date_override)
  );
$$;

create or replace function public.set_reservation_service_period()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  calculated_service_start time;
begin
  calculated_service_start := public.get_reservation_service_starts_at(
    new.reservation_date,
    new.reservation_time
  );

  if calculated_service_start is not null then
    new.service_starts_at := calculated_service_start;
  elsif new.schedule_override_reason is not null then
    if new.service_starts_at is null
       or not public.reservation_service_start_is_available(new.reservation_date, new.service_starts_at) then
      raise exception 'RESERVATION_SERVICE_PERIOD_REQUIRED';
    end if;
  else
    raise exception 'RESERVATION_TIME_UNAVAILABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists set_reservation_service_period on public.reservations;
drop trigger if exists a_set_reservation_service_period on public.reservations;
create trigger a_set_reservation_service_period
  before insert or update of reservation_date, reservation_time on public.reservations
  for each row execute function public.set_reservation_service_period();

-- Only values that are still unambiguous under the installed schedule are
-- backfilled. Remaining rows are exposed below and intentionally fail closed.
update public.reservations
set service_starts_at = public.get_reservation_service_starts_at(
  reservation_date,
  reservation_time
)
where service_starts_at is null
  and public.get_reservation_service_starts_at(reservation_date, reservation_time) is not null;

create or replace view public.reservation_turn_classification_issues
with (security_invoker = true)
as
  select
    id,
    reservation_date,
    reservation_time,
    num_guests,
    status,
    source,
    created_at
  from public.reservations
  where lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
    and source <> 'walk_in'
    and service_starts_at is null;

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
       and new.schedule_override_reason is null then
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
  override_used boolean := false;
begin
  new_status := lower(coalesce(new.status, 'pending'));
  old_status := lower(coalesce(old.status, 'pending'));
  if new.status is null then
    new.status := 'pending';
    new_status := 'pending';
  end if;

  if tg_op = 'UPDATE'
     and new.reservation_date is not distinct from old.reservation_date
     and new.reservation_time is not distinct from old.reservation_time
     and new.service_starts_at is not distinct from old.service_starts_at
     and new.num_guests is not distinct from old.num_guests
     and new.status is not distinct from old.status
     and new.source is not distinct from old.source
     and new.whatsapp is not distinct from old.whatsapp then
    return new;
  end if;

  -- Lock both ends of a reschedule in a stable order so concurrent moves do
  -- not each observe an available turn before the other transaction commits.
  perform pg_advisory_xact_lock(hashtext('reservation-capacity:' || lock_key))
  from (
    select distinct reservation_date::text || ':' || service_starts_at::text as lock_key
    from (
      select new.reservation_date, new.service_starts_at
      union all
      select old.reservation_date, old.service_starts_at
      where tg_op = 'UPDATE'
    ) turns
    where service_starts_at is not null
    order by 1
  ) locks;

  active_reservation := new_status not in ('cancelled', 'cancelado')
    and coalesce(new.source, 'website') <> 'walk_in';

  if active_reservation and new.service_starts_at is null then
    raise exception 'RESERVATION_TURN_UNCLASSIFIED';
  end if;

  if active_reservation and exists (
    select 1
    from public.reservation_turn_classification_issues issue
    where issue.reservation_date = new.reservation_date
      and issue.id <> new.id
  ) and not (
    tg_op = 'UPDATE'
    and old.service_starts_at is null
    and new.service_starts_at is not null
  ) then
    raise exception 'RESERVATION_TURN_CLASSIFICATION_REQUIRED';
  end if;

  if tg_op = 'INSERT'
     or new.reservation_date is distinct from old.reservation_date
     or regexp_replace(new.whatsapp, '\D', '', 'g') is distinct from regexp_replace(old.whatsapp, '\D', '', 'g')
     or old_status in ('cancelled', 'cancelado') then
    select exists (
      select 1
      from public.reservations
      where reservation_date = new.reservation_date
        and regexp_replace(whatsapp, '\D', '', 'g') = regexp_replace(new.whatsapp, '\D', '', 'g')
        and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) into has_duplicate;

    if has_duplicate then
      raise exception 'ACTIVE_RESERVATION_EXISTS: Já existe uma reserva ativa para este WhatsApp nesta data.';
    end if;
  end if;

  if not active_reservation then
    new.capacity_override_effect := '{}'::jsonb;
    return new;
  end if;

  select coalesce(sum(num_guests), 0)
    into current_total
    from public.reservations
   where reservation_date = new.reservation_date
     and service_starts_at = new.service_starts_at
     and source <> 'walk_in'
     and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if current_total + new.num_guests > 80 then
    if new.capacity_override_reason is null then
      raise exception 'CAPACITY_EXCEEDED: Limite de 80 pessoas atingido no turno. (Ocupado: %, Tentativa: %)', current_total, new.num_guests;
    end if;
    override_used := true;
  end if;

  new.capacity_override_effect := jsonb_build_object(
    'limit', 80,
    'occupied_before', current_total,
    'occupied_after', current_total + new.num_guests,
    'capacity_exceeded', override_used
  );
  return new;
end;
$$;

create or replace function public.record_reservation_override_audits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.capacity_override_reason is not null then
    insert into public.reservation_override_audits (
      reservation_id, override_type, authorized_by, reason,
      reservation_date, service_starts_at, effect
    ) values (
      new.id, 'capacity', new.capacity_override_authorized_by,
      new.capacity_override_reason, new.reservation_date,
      new.service_starts_at, new.capacity_override_effect
    ) on conflict (reservation_id, override_type) do update
      set reservation_date = excluded.reservation_date,
          service_starts_at = excluded.service_starts_at,
          effect = excluded.effect;
  end if;

  if new.schedule_override_reason is not null then
    insert into public.reservation_override_audits (
      reservation_id, override_type, authorized_by, reason,
      reservation_date, service_starts_at, effect
    ) values (
      new.id, 'schedule', new.schedule_override_authorized_by,
      new.schedule_override_reason, new.reservation_date,
      new.service_starts_at,
      jsonb_build_object('reservation_time', new.reservation_time, 'outside_schedule', true)
    ) on conflict (reservation_id, override_type) do update
      set reservation_date = excluded.reservation_date,
          service_starts_at = excluded.service_starts_at,
          effect = excluded.effect;
  end if;
  return new;
end;
$$;

-- Trigger names define execution order for BEFORE triggers. Capacity must run
-- after a_set_reservation_service_period and before table-assignment syncing.
drop trigger if exists enforce_daily_capacity on public.reservations;
drop trigger if exists reservation_service_capacity on public.reservations;
create trigger reservation_service_capacity
  before insert or update on public.reservations
  for each row execute function public.check_daily_capacity();

drop trigger if exists record_reservation_override_audits on public.reservations;
create trigger record_reservation_override_audits
  after insert or update of reservation_date, reservation_time, service_starts_at,
    num_guests, status, source, capacity_override_reason, schedule_override_reason
  on public.reservations
  for each row execute function public.record_reservation_override_audits();

create or replace function public.create_reservation_with_owner_overrides(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_reservation_date date,
  p_reservation_time time,
  p_num_guests integer,
  p_notes text,
  p_special_date_id uuid,
  p_decoration_id uuid,
  p_cpf text,
  p_payment_status text,
  p_payment_amount numeric,
  p_reservation_access_token_hash text,
  p_capacity_override_reason text default null,
  p_schedule_override_reason text default null,
  p_service_starts_at time default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capacity_reason text := nullif(btrim(p_capacity_override_reason), '');
  schedule_reason text := nullif(btrim(p_schedule_override_reason), '');
  actor_id uuid := auth.uid();
begin
  if not public.is_reservation_owner() then
    raise exception 'OWNER_REQUIRED';
  end if;
  if capacity_reason is null and schedule_reason is null then
    raise exception 'RESERVATION_OVERRIDE_REQUIRED';
  end if;
  if capacity_reason is not null and char_length(capacity_reason) not between 3 and 1000 then
    raise exception 'INVALID_CAPACITY_OVERRIDE_REASON';
  end if;
  if schedule_reason is not null and char_length(schedule_reason) not between 3 and 1000 then
    raise exception 'INVALID_SCHEDULE_OVERRIDE_REASON';
  end if;
  if schedule_reason is not null and p_service_starts_at is null then
    raise exception 'RESERVATION_SERVICE_PERIOD_REQUIRED';
  end if;

  return query
  insert into public.reservations (
    name, email, whatsapp, reservation_date, reservation_time, num_guests,
    notes, special_date_id, decoration_id, cpf, payment_status, payment_amount,
    reservation_access_token_hash, status, source, service_starts_at,
    capacity_override_reason, capacity_override_authorized_by,
    capacity_override_authorized_at, schedule_override_reason,
    schedule_override_authorized_by, schedule_override_authorized_at
  ) values (
    p_name, p_email, p_whatsapp, p_reservation_date, p_reservation_time,
    p_num_guests, p_notes, p_special_date_id, p_decoration_id, p_cpf,
    p_payment_status, p_payment_amount, p_reservation_access_token_hash,
    'pending', 'admin', p_service_starts_at,
    capacity_reason, case when capacity_reason is not null then actor_id end,
    case when capacity_reason is not null then now() end,
    schedule_reason, case when schedule_reason is not null then actor_id end,
    case when schedule_reason is not null then now() end
  ) returning reservations.id;
end;
$$;

create or replace function public.classify_reservation_service_period(
  p_reservation_id uuid,
  p_service_starts_at time,
  p_reason text
)
returns table (id uuid, service_starts_at time)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  classification_reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_reservation_owner() then
    raise exception 'OWNER_REQUIRED';
  end if;
  if classification_reason is null or char_length(classification_reason) not between 3 and 1000 then
    raise exception 'INVALID_TURN_CLASSIFICATION_REASON';
  end if;

  perform 1
  from public.reservations
  where reservations.id = p_reservation_id
    and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
    and source <> 'walk_in'
    and reservations.service_starts_at is null
  for update;
  if not found then
    raise exception 'RESERVATION_TURN_CLASSIFICATION_NOT_REQUIRED';
  end if;
  if not public.reservation_service_start_is_available(
    (select reservation_date from public.reservations where reservations.id = p_reservation_id),
    p_service_starts_at
  ) then
    raise exception 'INVALID_RESERVATION_SERVICE_PERIOD';
  end if;

  return query
  update public.reservations
     set service_starts_at = p_service_starts_at
   where reservations.id = p_reservation_id
  returning reservations.id, reservations.service_starts_at;

  insert into public.reservation_events (reservation_id, event_type, actor_type, metadata)
  values (
    p_reservation_id,
    'updated',
    'staff',
    jsonb_build_object(
      'turn_classification', true,
      'service_starts_at', p_service_starts_at,
      'reason', classification_reason,
      'authorized_by', auth.uid()
    )
  );
end;
$$;

create or replace function public.get_reservation_capacity_availability(
  p_from date,
  p_to date
)
returns table (
  reservation_date date,
  reservation_time time,
  service_starts_at time,
  occupied_guests integer,
  has_unclassified_reservation boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with slots as (
    select
      available.reservation_date,
      available.reservation_time,
      public.get_reservation_service_starts_at(
        available.reservation_date,
        available.reservation_time
      ) as service_starts_at
    from public.get_reservation_available_times(p_from, p_to) available
  ), unclassified as (
    select reservation_date
    from public.reservation_turn_classification_issues
    group by reservation_date
  )
  select
    slots.reservation_date,
    slots.reservation_time,
    slots.service_starts_at,
    coalesce(sum(reservations.num_guests), 0)::integer as occupied_guests,
    unclassified.reservation_date is not null as has_unclassified_reservation
  from slots
  left join public.reservations
    on reservations.reservation_date = slots.reservation_date
    and reservations.service_starts_at = slots.service_starts_at
    and reservations.source <> 'walk_in'
    and lower(coalesce(reservations.status, 'pending')) not in ('cancelled', 'cancelado')
  left join unclassified
    on unclassified.reservation_date = slots.reservation_date
  group by slots.reservation_date, slots.reservation_time, slots.service_starts_at, unclassified.reservation_date
  order by slots.reservation_date, slots.reservation_time;
$$;

revoke all on function public.is_reservation_owner() from public, anon;
revoke all on function public.reservation_service_start_is_available(date, time) from public, anon, authenticated;
revoke all on function public.set_reservation_service_period() from public, anon, authenticated;
revoke all on function public.record_reservation_override_audits() from public, anon, authenticated;
revoke all on function public.create_reservation_with_owner_overrides(text, text, text, date, time, integer, text, uuid, uuid, text, text, numeric, text, text, text, time) from public, anon;
revoke all on function public.classify_reservation_service_period(uuid, time, text) from public, anon;
revoke all on function public.get_reservation_capacity_availability(date, date) from public, anon, authenticated;

grant execute on function public.is_reservation_owner() to authenticated;
grant execute on function public.create_reservation_with_owner_overrides(text, text, text, date, time, integer, text, uuid, uuid, text, text, numeric, text, text, text, time) to authenticated;
grant execute on function public.classify_reservation_service_period(uuid, time, text) to authenticated;
grant execute on function public.get_reservation_capacity_availability(date, date) to service_role;
grant select on public.reservation_override_audits to authenticated;

commit;
