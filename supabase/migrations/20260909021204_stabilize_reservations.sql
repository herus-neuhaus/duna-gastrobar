begin;

alter table public.reservations
  add column if not exists reservation_access_token_hash text;

create index if not exists reservations_reservation_date_idx
  on public.reservations (reservation_date);

-- Every write for one date waits its turn before calculating capacity.
create or replace function public.check_daily_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  current_total integer;
  new_status text;
  has_duplicate boolean;
begin
  new_status := lower(coalesce(new.status, 'pending'));
  if new.status is null then
    new.status := 'pending';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.reservation_date::text));

  if new_status in ('cancelled', 'cancelado') then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.reservation_date is distinct from old.reservation_date
     or regexp_replace(new.whatsapp, '\\D', '', 'g') is distinct from regexp_replace(old.whatsapp, '\\D', '', 'g')
     or lower(coalesce(old.status, 'pending')) in ('cancelled', 'cancelado') then
    select exists (
      select 1
      from public.reservations
      where reservation_date = new.reservation_date
        and regexp_replace(whatsapp, '\\D', '', 'g') = regexp_replace(new.whatsapp, '\\D', '', 'g')
        and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) into has_duplicate;

    if has_duplicate then
      raise exception 'ACTIVE_RESERVATION_EXISTS: Já existe uma reserva ativa para este WhatsApp nesta data.';
    end if;
  end if;

  select coalesce(sum(num_guests), 0)
    into current_total
    from public.reservations
   where reservation_date = new.reservation_date
     and lower(coalesce(status, 'pending')) not in ('cancelled', 'cancelado')
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if current_total + new.num_guests > 80 then
    raise exception 'CAPACITY_EXCEEDED: Limite de 80 pessoas atingido. (Ocupado: %, Tentativa: %)', current_total, new.num_guests;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id
     and not private.is_manager()
     and (new.role is distinct from old.role or new.job_role_id is distinct from old.job_role_id) then
    raise exception 'You cannot change your role or job assignment';
  end if;

  return new;
end;
$$;

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
  if p_next_status not in ('confirmed', 'cancelled') then
    raise exception 'INVALID_RESERVATION_STATUS_TRANSITION';
  end if;

  return query
  update public.reservations
     set status = p_next_status
   where reservations.id = p_reservation_id
     and lower(coalesce(reservations.status, 'pending')) = any (p_expected_statuses)
  returning reservations.id, reservations.status;
end;
$$;

create or replace function public.cancel_reservation_with_access_token(
  p_reservation_id uuid,
  p_access_token_hash text
)
returns table (id uuid, status text)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.reservations
     set status = 'cancelled'
   where reservations.id = p_reservation_id
     and reservations.reservation_access_token_hash = p_access_token_hash
     and lower(coalesce(reservations.status, 'pending')) in ('pending', 'confirmed')
  returning reservations.id, reservations.status;
$$;

create or replace function public.get_reservation_with_access_token(
  p_reservation_id uuid,
  p_access_token_hash text
)
returns table (
  id uuid,
  reservation_date date,
  reservation_time time,
  num_guests integer,
  status text,
  payment_status text,
  payment_amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    reservations.id,
    reservations.reservation_date,
    reservations.reservation_time,
    reservations.num_guests,
    reservations.status,
    reservations.payment_status,
    reservations.payment_amount
  from public.reservations
  where reservations.id = p_reservation_id
    and reservations.reservation_access_token_hash = p_access_token_hash;
$$;

create or replace function public.complete_reservation_payment(
  p_reservation_id uuid,
  p_payment_amount numeric
)
returns table (id uuid, status text, payment_status text)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.reservations
     set payment_status = 'paid',
         status = case
           when lower(coalesce(reservations.status, 'pending')) = 'pending' then 'confirmed'
           else reservations.status
         end
   where reservations.id = p_reservation_id
     and reservations.payment_status = 'pending'
     and reservations.payment_amount = p_payment_amount
  returning reservations.id, reservations.status, reservations.payment_status;
$$;

revoke all on function public.transition_reservation_status(uuid, text[], text) from public, anon, authenticated;
revoke all on function public.cancel_reservation_with_access_token(uuid, text) from public, anon, authenticated;
revoke all on function public.get_reservation_with_access_token(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_reservation_payment(uuid, numeric) from public, anon, authenticated;

grant execute on function public.transition_reservation_status(uuid, text[], text) to service_role;
grant execute on function public.cancel_reservation_with_access_token(uuid, text) to service_role;
grant execute on function public.get_reservation_with_access_token(uuid, text) to service_role;
grant execute on function public.complete_reservation_payment(uuid, numeric) to service_role;

commit;
