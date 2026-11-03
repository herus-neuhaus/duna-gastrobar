begin;

-- Substitui somente a exigência de CPF na criação. Não apaga CPF histórico,
-- não altera agenda/capacidade, pagamentos, grants ou a exceção de walk-in.
create or replace function public.require_reservation_cpf_for_bookings()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source is distinct from 'walk_in'
     and (
       new.num_guests >= 15
       or coalesce(new.payment_amount, 0) > 0
       or coalesce(new.payment_status, 'not_required') in ('pending', 'paid')
       or exists (
         select 1 from public.special_dates d
         where d.id = new.special_date_id and d.requires_fee
       )
     )
     and nullif(btrim(new.cpf), '') is null then
    raise exception 'RESERVATION_CPF_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function public.require_reservation_cpf_for_bookings() from public, anon, authenticated;

commit;
