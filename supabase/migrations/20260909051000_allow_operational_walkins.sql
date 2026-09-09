create or replace function public.validate_reservation_schedule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.reservation_date is distinct from old.reservation_date or new.reservation_time is distinct from old.reservation_time then
    if not public.reservation_time_is_available(new.reservation_date, new.reservation_time) then raise exception 'RESERVATION_TIME_UNAVAILABLE'; end if;
    if coalesce(new.source, 'website') <> 'walk_in'
       and new.reservation_date::timestamp + new.reservation_time < timezone('America/Porto_Velho', now()) + interval '8 hours' then
      raise exception 'RESERVATION_LEAD_TIME_NOT_MET';
    end if;
  end if;
  return new;
end;
$$;
