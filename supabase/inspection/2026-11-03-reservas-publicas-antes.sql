-- Snapshot de metadados obtido via supabase_duna antes das duas migrations.
-- Projeto: gnakcuvfxltbgpssirpv (produção). Não contém registros de clientes.
-- Não é migration e não deve ser aplicado automaticamente.
-- Reversão das funções somente após aprovação específica; não remove o histórico
-- das migrations nem reservas criadas sob as novas regras.
-- ACLs observadas (ambas as migrations devem preservá-las):
-- require_reservation_cpf_for_bookings: {postgres=X/postgres,service_role=X/postgres}
-- validate_reservation_schedule: {=X/postgres,postgres=X/postgres,service_role=X/postgres}
-- Triggers ativos (tgenabled = O), não alterados pelas migrations:
-- require_reservation_cpf_for_bookings: BEFORE INSERT ON public.reservations
-- validate_reservation_schedule: BEFORE INSERT OR UPDATE OF reservation_date, reservation_time
--   ON public.reservations
-- O CREATE OR REPLACE abaixo preserva a ACL vigente; caso a ACL tenha mudado
-- depois deste snapshot, interromper e revisar a restauração de privilégios.

begin;

CREATE OR REPLACE FUNCTION public.require_reservation_cpf_for_bookings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.source is distinct from 'walk_in'
     and nullif(btrim(new.cpf), '') is null then
    raise exception 'RESERVATION_CPF_REQUIRED';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_reservation_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT'
     or new.reservation_date is distinct from old.reservation_date
     or new.reservation_time is distinct from old.reservation_time then
    if not public.reservation_time_is_available(new.reservation_date, new.reservation_time)
       and current_setting('app.reservation_schedule_override', true) is distinct from 'enabled' then
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
$function$;

commit;
