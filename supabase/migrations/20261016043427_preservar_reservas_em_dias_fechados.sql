begin;

-- Fechar um dia bloqueia novas entradas, não invalida contratos já registrados.
-- Só preserva reservas cujo contexto original pode continuar sendo utilizado;
-- alterações de horário em dias abertos mantêm a proteção contra conflitos.
create function private.reserva_preservavel_em_dia_fechado(p_reserva public.reservations)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_reserva.service_starts_at is not null
    and p_reserva.commercial_turn is not null
    and p_reserva.duracao_reserva_minutos is not null
    and p_reserva.intervalo_troca_minutos is not null
    and coalesce((
      select d.fechado from public.dias_funcionamento d
      where d.ativo and (d.data_excecao = p_reserva.reservation_date
        or (d.data_excecao is null and d.dia_semana = extract(dow from p_reserva.reservation_date)))
      order by (d.data_excecao is not null) desc limit 1
    ), false);
$$;
revoke all on function private.reserva_preservavel_em_dia_fechado(public.reservations) from public, anon, authenticated;

create or replace function public.set_reservation_service_period()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
declare calculated_service_start time; calculated_commercial_turn text;
begin
  if tg_op = 'UPDATE' and new.reservation_date is not distinct from old.reservation_date
    and new.reservation_time is not distinct from old.reservation_time then
    new.service_starts_at := old.service_starts_at;
    new.commercial_turn := old.commercial_turn;
    return new;
  end if;
  calculated_service_start := public.get_reservation_service_starts_at(new.reservation_date, new.reservation_time);
  calculated_commercial_turn := public.get_reservation_commercial_turn(new.reservation_date, new.reservation_time);
  if calculated_service_start is not null and calculated_commercial_turn is not null then
    new.service_starts_at := calculated_service_start;
    new.commercial_turn := calculated_commercial_turn;
  elsif current_setting('app.reservation_schedule_override', true) = 'enabled' then
    if not public.reservation_commercial_turn_is_available(new.reservation_date, new.commercial_turn) then
      raise exception 'RESERVATION_COMMERCIAL_TURN_REQUIRED';
    end if;
    new.service_starts_at := public.get_reservation_service_start_for_commercial_turn(new.reservation_date, new.commercial_turn);
  else raise exception 'RESERVATION_TIME_UNAVAILABLE';
  end if;
  return new;
end; $$;

create or replace function public.set_reservation_decoration_service_period()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin
  if new.decoration_id is null then new.decoration_service_starts_at := null; return new; end if;
  if tg_op = 'UPDATE' and new.reservation_date is not distinct from old.reservation_date
    and new.reservation_time is not distinct from old.reservation_time
    and new.decoration_id is not distinct from old.decoration_id then
    new.decoration_service_starts_at := old.decoration_service_starts_at;
    return new;
  end if;
  new.decoration_service_starts_at := public.get_reservation_service_starts_at(new.reservation_date, new.reservation_time);
  if new.decoration_service_starts_at is null and current_setting('app.reservation_schedule_override', true) = 'enabled' then
    new.decoration_service_starts_at := new.service_starts_at;
  end if;
  if new.decoration_service_starts_at is null then raise exception 'DECORATION_SERVICE_PERIOD_NOT_FOUND'; end if;
  return new;
end; $$;

-- Patches delimitados das duas RPCs existentes. A definição completa permanece
-- no histórico anterior. Falha/rollback se a versão esperada não estiver lá,
-- evitando substituir silenciosamente uma implementação diferente em produção.
do $$
declare definicao text; trecho text; substituto text;
begin
  definicao := pg_get_functiondef('public.salvar_funcionamento_estabelecimento(jsonb,integer)'::regprocedure);
  trecho := 'and r.schedule_override_reason is null';
  substituto := trecho || E'\n    and not private.reserva_preservavel_em_dia_fechado(r)';
  if (length(definicao) - length(replace(definicao, trecho, ''))) / length(trecho) <> 1 then
    raise exception 'UNEXPECTED_SETTINGS_FUNCTION_DEFINITION';
  end if;
  execute replace(definicao, trecho, substituto);

  definicao := pg_get_functiondef('public.update_reservation_with_authorized_overrides(uuid,date,time,integer,text,text,text)'::regprocedure);
  trecho := 'next_turn := coalesce(public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time), p_commercial_turn);';
  substituto := 'next_turn := case when reservation_row.reservation_date = p_reservation_date and reservation_row.reservation_time = p_reservation_time then reservation_row.commercial_turn else coalesce(public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time), p_commercial_turn) end;';
  if (length(definicao) - length(replace(definicao, trecho, ''))) / length(trecho) <> 1 then
    raise exception 'UNEXPECTED_RESERVATION_OVERRIDE_DEFINITION';
  end if;
  execute replace(definicao, trecho, substituto);
end; $$;

commit;
