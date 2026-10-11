alter table public.reservations
  alter column email drop not null;

create or replace function public.require_reservation_cpf_for_bookings()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source is distinct from 'walk_in'
     and nullif(btrim(new.cpf), '') is null then
    raise exception 'RESERVATION_CPF_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function public.require_reservation_cpf_for_bookings() from public, anon, authenticated;

drop trigger if exists require_reservation_cpf_for_bookings on public.reservations;
create trigger require_reservation_cpf_for_bookings
  before insert on public.reservations
  for each row execute function public.require_reservation_cpf_for_bookings();

drop function if exists public.create_walk_in_reservation(text, text, text, date, time, integer, text);

create function public.create_walk_in_reservation(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_reservation_date date,
  p_reservation_time time,
  p_num_guests integer,
  p_notes text,
  p_cpf text default null
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
    notes, status, source, arrived_at, cpf
  ) values (
    btrim(p_name), nullif(btrim(p_email), ''), p_whatsapp,
    p_reservation_date, p_reservation_time, p_num_guests,
    nullif(btrim(p_notes), ''), 'confirmed', 'walk_in', now(), nullif(btrim(p_cpf), '')
  ) returning reservations.id;
end;
$$;

revoke all on function public.create_walk_in_reservation(text, text, text, date, time, integer, text, text) from public, anon;
grant execute on function public.create_walk_in_reservation(text, text, text, date, time, integer, text, text) to authenticated;
