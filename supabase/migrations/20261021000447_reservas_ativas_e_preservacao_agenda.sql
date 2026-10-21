begin;

-- Sem duração real conhecida, não há liberação automática por horário.
-- As cotas existentes de 80 pessoas por data/turno e os locks são preservados;
-- somente os estados que comprometem lugares passam a ser os estados ativos.
create or replace view public.reservation_turn_classification_issues
with (security_invoker = true) as
  select id, reservation_date, reservation_time, num_guests, status, source, commercial_turn, created_at
  from public.reservations
  where lower(coalesce(status, 'pending')) in ('pending', 'pendente', 'confirmed', 'confirmado', 'seated')
    and source <> 'walk_in' and commercial_turn is null;

-- Patches delimitados, como na migração anterior de preservação. As guardas
-- interrompem a migração se a implementação não tiver as precondições esperadas.
-- Não substitui grants, autorização, nonces, auditoria nem a regra de duplicidade.
do $$
declare
  definicao text; original text; substituto text; assinatura text; esperado integer;
begin
  definicao := pg_get_functiondef('public.check_daily_capacity()'::regprocedure);
  original := 'active_reservation := new_status not in (''cancelled'', ''cancelado'')';
  substituto := 'active_reservation := new_status in (''pending'', ''pendente'', ''confirmed'', ''confirmado'', ''seated'')';
  if (length(definicao) - length(replace(definicao, original, ''))) / length(original) <> 1 then
    raise exception 'UNEXPECTED_CAPACITY_FUNCTION_DEFINITION';
  end if;
  definicao := replace(definicao, original, substituto);
  original := 'and old_status not in (''cancelled'', ''cancelado'')';
  substituto := 'and old_status in (''pending'', ''pendente'', ''confirmed'', ''confirmado'', ''seated'')';
  if (length(definicao) - length(replace(definicao, original, ''))) / length(original) <> 1 then
    raise exception 'UNEXPECTED_CAPACITY_FUNCTION_DEFINITION';
  end if;
  definicao := replace(definicao, original, substituto);
  -- Catálogo remoto e arquivo local diferem somente na indentação deste trecho.
  -- Delimita pela cláusula source para não alterar a validação de duplicidade.
  original := substring(definicao from 'and source <> ''walk_in''[[:space:]]+and lower\(coalesce\(status, ''pending''\)\) not in \(''cancelled'', ''cancelado''\)');
  if original is null or (length(definicao) - length(replace(definicao, original, ''))) / nullif(length(original), 0) <> 1 then
    raise exception 'UNEXPECTED_CAPACITY_FUNCTION_DEFINITION';
  end if;
  substituto := replace(original, 'lower(coalesce(status, ''pending'')) not in (''cancelled'', ''cancelado'')',
    'lower(coalesce(status, ''pending'')) in (''pending'', ''pendente'', ''confirmed'', ''confirmado'', ''seated'')');
  execute replace(definicao, original, substituto);

  foreach assinatura in array array[
    'public.create_reservation_with_authorized_overrides(text,text,text,date,time,integer,text,uuid,uuid,text,text,numeric,text,text,text,text)',
    'public.update_reservation_with_capacity_override(uuid,date,time,integer,text)',
    'public.update_reservation_with_authorized_overrides(uuid,date,time,integer,text,text,text)',
    'public.get_reservation_capacity_availability(date,date)'
  ] loop
    definicao := pg_get_functiondef(assinatura::regprocedure);
    if assinatura like 'public.create_%' then
      original := 'lower(coalesce(status, ''pending'')) not in (''cancelled'', ''cancelado'')';
      substituto := 'lower(coalesce(status, ''pending'')) in (''pending'', ''pendente'', ''confirmed'', ''confirmado'', ''seated'')';
    else
      original := 'lower(coalesce(reservations.status, ''pending'')) not in (''cancelled'', ''cancelado'')';
      substituto := 'lower(coalesce(reservations.status, ''pending'')) in (''pending'', ''pendente'', ''confirmed'', ''confirmado'', ''seated'')';
    end if;
    esperado := (length(definicao) - length(replace(definicao, original, ''))) / length(original);
    if esperado <> 1 then raise exception 'UNEXPECTED_CAPACITY_FUNCTION_DEFINITION:%', assinatura; end if;
    execute replace(definicao, original, substituto);
  end loop;

  -- A edição muda a agenda futura, nunca as reservas já feitas. Só registros
  -- legados sem contexto suficiente exigem revisão antes de modificar a agenda.
  definicao := pg_get_functiondef('public.salvar_funcionamento_estabelecimento(jsonb,integer)'::regprocedure);
  original := substring(definicao from 'select count\(\*\) into conflitos from public\.reservations r.*?if conflitos > 0 then raise exception ''AGENDA_CONFLITO_RESERVAS:%'', conflitos; end if;');
  if original is null then raise exception 'UNEXPECTED_SETTINGS_FUNCTION_DEFINITION'; end if;
  substituto := $patch$select count(*) into conflitos from public.reservations r
    where r.reservation_date >= timezone('America/Porto_Velho', now())::date
      and lower(coalesce(r.status, 'pending')) in ('pending', 'pendente', 'confirmed', 'confirmado', 'seated')
      and (r.service_starts_at is null or r.commercial_turn is null
        or r.duracao_reserva_minutos is null or r.intervalo_troca_minutos is null);
    if conflitos > 0 then raise exception 'AGENDA_CONFLITO_RESERVAS:%', conflitos; end if;$patch$;
  execute replace(definicao, original, substituto);
end;
$$;

-- Uma alteração da agenda não pode fazer uma decoração em uso parecer livre
-- apenas porque a primeira entrada mudou. Não reclassifica registros históricos.
-- Períodos atuais distintos mantêm a regra existente. Uma decoração preservada
-- continua comprometida no turno original e em janelas de mesa sobrepostas.
create function private.decoracao_conflita_com_reserva_preservada(
  p_data date, p_hora time, p_turno text, p_periodo time,
  p_decoracao uuid, p_duracao_total integer, p_excluir uuid default null
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reservations r
    where r.reservation_date = p_data and r.decoration_id = p_decoracao
      and (p_excluir is null or r.id <> p_excluir)
      and lower(coalesce(r.status, 'pending')) in ('pending', 'pendente', 'confirmed', 'confirmado', 'seated')
      and (
        r.decoration_service_starts_at = p_periodo
        or (
          (r.decoration_service_starts_at is distinct from public.get_reservation_service_starts_at(r.reservation_date, r.reservation_time)
            or p_periodo is distinct from public.get_reservation_service_starts_at(p_data, p_hora))
          and (r.commercial_turn = p_turno
            or tsrange(r.reservation_date + r.reservation_time,
              r.reservation_date + r.reservation_time + make_interval(mins => coalesce(r.duracao_reserva_minutos, 120) + coalesce(r.intervalo_troca_minutos, 30)), '[)')
              && tsrange(p_data + p_hora, p_data + p_hora + make_interval(mins => p_duracao_total), '[)'))
        )
      )
  );
$$;
revoke all on function private.decoracao_conflita_com_reserva_preservada(date,time,text,time,uuid,integer,uuid) from public, anon, authenticated;

create or replace function public.set_reservation_decoration_service_period()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.decoration_id is null then new.decoration_service_starts_at := null; return new; end if;
  if tg_op = 'UPDATE' and new.reservation_date is not distinct from old.reservation_date
    and new.reservation_time is not distinct from old.reservation_time
    and new.decoration_id is not distinct from old.decoration_id then
    new.decoration_service_starts_at := old.decoration_service_starts_at;
    -- Confirmar, acomodar ou concluir não revalida o contrato pela agenda nova.
    if lower(coalesce(old.status, 'pending')) in ('pending', 'pendente', 'confirmed', 'confirmado', 'seated') then return new; end if;
  else
    new.decoration_service_starts_at := public.get_reservation_service_starts_at(new.reservation_date, new.reservation_time);
    if new.decoration_service_starts_at is null and current_setting('app.reservation_schedule_override', true) = 'enabled' then
      new.decoration_service_starts_at := new.service_starts_at;
    end if;
  end if;
  if new.decoration_service_starts_at is null then raise exception 'DECORATION_SERVICE_PERIOD_NOT_FOUND'; end if;
  if lower(coalesce(new.status, 'pending')) in ('pending', 'pendente', 'confirmed', 'confirmado', 'seated') then
    perform pg_advisory_xact_lock(hashtext('reservation-decoration:' || new.reservation_date::text || ':' || new.decoration_id::text));
    if private.decoracao_conflita_com_reserva_preservada(new.reservation_date, new.reservation_time,
      new.commercial_turn, new.decoration_service_starts_at, new.decoration_id,
      coalesce(new.duracao_reserva_minutos, 120) + coalesce(new.intervalo_troca_minutos, 30), new.id) then
      raise unique_violation using message = 'reservations_active_decoration_period_unique', constraint = 'reservations_active_decoration_period_unique';
    end if;
  end if;
  return new;
end;
$$;
drop trigger set_reservation_decoration_service_period on public.reservations;
create trigger set_reservation_decoration_service_period
  before insert or update of decoration_id, reservation_date, reservation_time, status on public.reservations
  for each row execute function public.set_reservation_decoration_service_period();
revoke all on function public.set_reservation_decoration_service_period() from public, anon, authenticated;

create or replace function public.get_reservation_decoration_availability(p_reservation_date date, p_reservation_time time)
returns table (decoration_id uuid, available boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  with periodo as (
    select public.get_reservation_service_starts_at(p_reservation_date, p_reservation_time) as inicio,
      public.get_reservation_commercial_turn(p_reservation_date, p_reservation_time) as turno
  )
  select d.id, public.reservation_time_is_available(p_reservation_date, p_reservation_time)
    and periodo.inicio is not null
    and not private.decoracao_conflita_com_reserva_preservada(p_reservation_date, p_reservation_time,
      periodo.turno, periodo.inicio, d.id, coalesce(c.duracao, 120) + coalesce(c.preparacao, 30))
  from public.decorations d cross join periodo
  left join lateral private.contexto_agenda_reserva(p_reservation_date, p_reservation_time, periodo.turno) c on true
  where d.active;
$$;

commit;
