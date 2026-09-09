begin;

alter table public.reservations
  add column if not exists special_date_id uuid references public.special_dates(id) on delete set null;

create index if not exists reservations_special_date_id_idx
  on public.reservations (special_date_id);

alter table public.reservations
  drop constraint if exists reservations_status_check;

alter table public.reservations
  add constraint reservations_status_check check (
    status = any (array[
      'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled',
      'pendente', 'confirmado', 'concluido', 'cancelado'
    ])
  );

create table if not exists public.reservation_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week, starts_at),
  check (ends_at >= starts_at)
);

create table if not exists public.reservation_schedule_date_slots (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  starts_at time not null,
  ends_at time not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_date, starts_at),
  check (ends_at >= starts_at)
);

insert into public.reservation_schedule_slots (day_of_week, starts_at, ends_at)
values
  (0, '12:00', '20:00'),
  (2, '12:00', '13:30'),
  (2, '18:00', '21:00'),
  (3, '12:00', '13:30'),
  (3, '18:00', '21:00'),
  (4, '12:00', '13:30'),
  (4, '18:00', '21:00'),
  (5, '12:00', '20:00'),
  (6, '12:00', '20:00')
on conflict (day_of_week, starts_at) do nothing;

create table if not exists public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'rescheduled', 'guests_changed', 'status_changed', 'payment_changed', 'updated'
  )),
  actor_type text not null default 'system' check (actor_type in ('customer', 'staff', 'system', 'payment_gateway')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reservation_events_reservation_created_idx
  on public.reservation_events (reservation_id, created_at desc);

create table if not exists public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  provider text not null,
  provider_order_id text not null,
  method text not null default 'pix',
  status text not null check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  amount numeric not null check (amount > 0),
  currency text not null default 'BRL',
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id)
);

create index if not exists reservation_payments_reservation_created_idx
  on public.reservation_payments (reservation_id, created_at desc);

create table if not exists public.reservation_recovery_challenges (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  code_hash text not null,
  reservation_ids uuid[] not null default '{}',
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reservation_recovery_challenges_email_created_idx
  on public.reservation_recovery_challenges (email_hash, created_at desc);

alter table public.reservation_schedule_slots enable row level security;
alter table public.reservation_schedule_date_slots enable row level security;
alter table public.reservation_events enable row level security;
alter table public.reservation_payments enable row level security;
alter table public.reservation_recovery_challenges enable row level security;

create policy "Public can read active reservation schedule slots"
  on public.reservation_schedule_slots for select using (active);

create policy "Public can read active date schedule slots"
  on public.reservation_schedule_date_slots for select using (active);

create policy "Managers can manage reservation schedule slots"
  on public.reservation_schedule_slots for all to authenticated
  using (private.is_manager()) with check (private.is_manager());

create policy "Managers can manage date schedule slots"
  on public.reservation_schedule_date_slots for all to authenticated
  using (private.is_manager()) with check (private.is_manager());

create policy "Reservation staff can read reservation events"
  on public.reservation_events for select to authenticated using (private.is_reservation_staff());

create policy "Reservation staff can read reservation payments"
  on public.reservation_payments for select to authenticated using (private.is_reservation_staff());

create policy "No direct access to reservation recovery challenges"
  on public.reservation_recovery_challenges for all using (false) with check (false);

create or replace function public.reservation_time_is_available(
  p_reservation_date date,
  p_reservation_time time
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
  ), slots as (
    select starts_at, ends_at, slot_interval_minutes
    from public.reservation_schedule_date_slots
    where reservation_date = p_reservation_date and active

    union all

    select starts_at, ends_at, slot_interval_minutes
    from public.reservation_schedule_slots
    where day_of_week = extract(dow from p_reservation_date)::smallint
      and active
      and not (select value from has_date_override)
  )
  select not exists (
    select 1 from public.blocked_dates where date = p_reservation_date
  ) and exists (
    select 1
    from slots
    where p_reservation_time between starts_at and ends_at
      and mod(extract(epoch from (p_reservation_time - starts_at))::integer, slot_interval_minutes * 60) = 0
  );
$$;

create or replace function public.get_reservation_available_times(
  p_from date,
  p_to date
)
returns table (reservation_date date, reservation_time time)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dates as (
    select day::date as reservation_date
    from generate_series(p_from, p_to, interval '1 day') as day
  ), slots as (
    select
      dates.reservation_date,
      schedule.starts_at,
      schedule.ends_at,
      schedule.slot_interval_minutes
    from dates
    join lateral (
      select starts_at, ends_at, slot_interval_minutes
      from public.reservation_schedule_date_slots
      where reservation_date = dates.reservation_date and active

      union all

      select starts_at, ends_at, slot_interval_minutes
      from public.reservation_schedule_slots
      where day_of_week = extract(dow from dates.reservation_date)::smallint
        and active
        and not exists (
          select 1 from public.reservation_schedule_date_slots
          where reservation_date = dates.reservation_date
        )
    ) as schedule on true
    where not exists (
      select 1 from public.blocked_dates where date = dates.reservation_date
    )
  )
  select slots.reservation_date, generated_time::time
  from slots
  cross join lateral generate_series(
    slots.reservation_date + slots.starts_at,
    slots.reservation_date + slots.ends_at,
    make_interval(mins => slots.slot_interval_minutes)
  ) as generated_time
  order by slots.reservation_date, generated_time;
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
    if not public.reservation_time_is_available(new.reservation_date, new.reservation_time) then
      raise exception 'RESERVATION_TIME_UNAVAILABLE';
    end if;

    if new.reservation_date::timestamp + new.reservation_time
       < timezone('America/Porto_Velho', now()) + interval '8 hours' then
      raise exception 'RESERVATION_LEAD_TIME_NOT_MET';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reservation_schedule on public.reservations;
create trigger validate_reservation_schedule
  before insert or update of reservation_date, reservation_time on public.reservations
  for each row execute function public.validate_reservation_schedule();

create or replace function public.record_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_fields jsonb := '{}'::jsonb;
  next_event_type text := 'updated';
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_events (reservation_id, event_type, metadata)
    values (new.id, 'created', jsonb_build_object('status', new.status));
    return new;
  end if;

  if new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time then
    next_event_type := 'rescheduled';
    changed_fields := changed_fields || jsonb_build_object(
      'from', jsonb_build_object('date', old.reservation_date, 'time', old.reservation_time),
      'to', jsonb_build_object('date', new.reservation_date, 'time', new.reservation_time)
    );
  end if;

  if new.num_guests is distinct from old.num_guests then
    next_event_type := case when next_event_type = 'updated' then 'guests_changed' else next_event_type end;
    changed_fields := changed_fields || jsonb_build_object('guests', jsonb_build_object('from', old.num_guests, 'to', new.num_guests));
  end if;

  if new.status is distinct from old.status then
    next_event_type := case when next_event_type = 'updated' then 'status_changed' else next_event_type end;
    changed_fields := changed_fields || jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.payment_amount is distinct from old.payment_amount then
    next_event_type := case when next_event_type = 'updated' then 'payment_changed' else next_event_type end;
    changed_fields := changed_fields || jsonb_build_object('payment', jsonb_build_object(
      'status_from', old.payment_status,
      'status_to', new.payment_status,
      'amount_from', old.payment_amount,
      'amount_to', new.payment_amount
    ));
  end if;

  if changed_fields <> '{}'::jsonb then
    insert into public.reservation_events (reservation_id, event_type, metadata)
    values (new.id, next_event_type, changed_fields);
  end if;

  return new;
end;
$$;

drop trigger if exists record_reservation_event on public.reservations;
create trigger record_reservation_event
  after insert or update on public.reservations
  for each row execute function public.record_reservation_event();

create or replace function public.transition_reservation_status(
  p_reservation_id uuid,
  p_expected_statuses text[],
  p_next_status text
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_next_status not in ('confirmed', 'seated', 'completed', 'no_show', 'cancelled') then
    raise exception 'INVALID_RESERVATION_STATUS_TRANSITION';
  end if;

  return query
  update public.reservations
     set status = p_next_status
   where reservations.id = p_reservation_id
     and lower(coalesce(reservations.status, 'pending')) = any (p_expected_statuses)
     and (
       (lower(coalesce(reservations.status, 'pending')) = 'pending' and p_next_status in ('confirmed', 'cancelled'))
       or (lower(coalesce(reservations.status, 'pending')) = 'confirmed' and p_next_status in ('seated', 'no_show', 'cancelled'))
       or (lower(coalesce(reservations.status, 'pending')) = 'seated' and p_next_status = 'completed')
     )
  returning reservations.id, reservations.status;
end;
$$;

create or replace function public.update_reservation_with_access_token(
  p_reservation_id uuid,
  p_access_token_hash text,
  p_reservation_date date,
  p_reservation_time time,
  p_num_guests integer
)
returns table (id uuid, reservation_date date, reservation_time time, num_guests integer, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_num_guests not between 1 and 30 then
    raise exception 'INVALID_GUEST_COUNT';
  end if;

  return query
  update public.reservations
     set reservation_date = p_reservation_date,
         reservation_time = p_reservation_time,
         num_guests = p_num_guests
   where reservations.id = p_reservation_id
     and reservations.reservation_access_token_hash = p_access_token_hash
     and lower(coalesce(reservations.status, 'pending')) in ('pending', 'confirmed')
     and coalesce(reservations.payment_status, 'not_required') = 'not_required'
  returning reservations.id, reservations.reservation_date, reservations.reservation_time,
    reservations.num_guests, reservations.status;
end;
$$;

create or replace function public.create_reservation_recovery_challenge(
  p_email_hash text,
  p_code_hash text,
  p_reservation_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge_id uuid;
begin
  if (
    select count(*)
    from public.reservation_recovery_challenges
    where email_hash = p_email_hash
      and created_at > now() - interval '15 minutes'
  ) >= 3 then
    raise exception 'RECOVERY_RATE_LIMITED';
  end if;

  insert into public.reservation_recovery_challenges (
    email_hash, code_hash, reservation_ids, expires_at
  ) values (
    p_email_hash, p_code_hash, p_reservation_ids, now() + interval '10 minutes'
  ) returning id into challenge_id;

  return challenge_id;
end;
$$;

create or replace function public.complete_reservation_access_recovery(
  p_challenge_id uuid,
  p_email_hash text,
  p_code_hash text,
  p_access_tokens jsonb
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge public.reservation_recovery_challenges%rowtype;
begin
  update public.reservation_recovery_challenges
     set attempts = attempts + 1
   where reservation_recovery_challenges.id = p_challenge_id
     and email_hash = p_email_hash
     and verified_at is null
  returning * into challenge;

  if challenge.id is null
     or challenge.expires_at <= now()
     or challenge.attempts > 5
     or challenge.code_hash <> p_code_hash then
    return;
  end if;

  if (
    select count(*) from jsonb_to_recordset(p_access_tokens) as token(reservation_id uuid, token_hash text)
  ) <> cardinality(challenge.reservation_ids)
  or exists (
    select 1 from jsonb_to_recordset(p_access_tokens) as token(reservation_id uuid, token_hash text)
    where token.reservation_id <> all(challenge.reservation_ids)
      or token.token_hash is null
  ) then
    raise exception 'INVALID_RECOVERY_TOKENS';
  end if;

  update public.reservation_recovery_challenges
     set verified_at = now()
   where reservation_recovery_challenges.id = challenge.id;

  return query
  update public.reservations
     set reservation_access_token_hash = token.token_hash
    from jsonb_to_recordset(p_access_tokens) as token(reservation_id uuid, token_hash text)
   where reservations.id = token.reservation_id
     and reservations.id = any(challenge.reservation_ids)
  returning reservations.id;
end;
$$;

create or replace function public.record_reservation_payment_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.reservation_events (reservation_id, event_type, actor_type, metadata)
  values (
    new.reservation_id,
    'payment_changed',
    case when new.status = 'paid' then 'payment_gateway' else 'system' end,
    jsonb_build_object('payment_id', new.id, 'provider', new.provider, 'status', new.status, 'amount', new.amount)
  );
  return new;
end;
$$;

drop trigger if exists record_reservation_payment_event on public.reservation_payments;
create trigger record_reservation_payment_event
  after insert or update of status on public.reservation_payments
  for each row execute function public.record_reservation_payment_event();

revoke all on function public.reservation_time_is_available(date, time) from public, anon, authenticated;
revoke all on function public.get_reservation_available_times(date, date) from public, anon, authenticated;
revoke all on function public.update_reservation_with_access_token(uuid, text, date, time, integer) from public, anon, authenticated;
revoke all on function public.create_reservation_recovery_challenge(text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.complete_reservation_access_recovery(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_reservation_event() from public, anon, authenticated;
revoke all on function public.record_reservation_payment_event() from public, anon, authenticated;

grant execute on function public.reservation_time_is_available(date, time) to service_role;
grant execute on function public.get_reservation_available_times(date, date) to service_role;
grant execute on function public.update_reservation_with_access_token(uuid, text, date, time, integer) to service_role;
grant execute on function public.create_reservation_recovery_challenge(text, text, uuid[]) to service_role;
grant execute on function public.complete_reservation_access_recovery(uuid, text, text, jsonb) to service_role;

commit;
