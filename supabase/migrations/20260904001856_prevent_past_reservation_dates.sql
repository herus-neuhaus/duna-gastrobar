create or replace function private.prevent_past_reservation_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.date < (timezone('America/Porto_Velho', now()))::date then
    raise exception 'Reservation dates cannot be in the past';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_past_reservation_date() from public, anon, authenticated;

drop trigger if exists prevent_past_special_dates on public.special_dates;
create trigger prevent_past_special_dates
before insert or update of date on public.special_dates
for each row execute function private.prevent_past_reservation_date();

drop trigger if exists prevent_past_blocked_dates on public.blocked_dates;
create trigger prevent_past_blocked_dates
before insert or update of date on public.blocked_dates
for each row execute function private.prevent_past_reservation_date();
