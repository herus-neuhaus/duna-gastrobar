begin;

-- Novas tabelas usam português. A agenda de reservas existente é preservada.
create table public.configuracoes_estabelecimento (
  id boolean primary key default true check (id),
  funcionamento_configurado boolean not null default false,
  versao integer not null default 0 check (versao >= 0),
  atualizado_em timestamptz not null default now()
);
insert into public.configuracoes_estabelecimento (id) values (true);

create table public.dias_funcionamento (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint check (dia_semana between 0 and 6),
  data_excecao date,
  fechado boolean not null default false,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  check ((dia_semana is null) <> (data_excecao is null))
);
create unique index dias_funcionamento_semana_idx on public.dias_funcionamento (dia_semana) where data_excecao is null;
create unique index dias_funcionamento_data_idx on public.dias_funcionamento (data_excecao) where data_excecao is not null;

create table public.periodos_funcionamento (
  id uuid primary key default gen_random_uuid(),
  dia_funcionamento_id uuid not null references public.dias_funcionamento(id) on delete restrict,
  abre_as time not null,
  fecha_as time not null,
  encerra_dia_seguinte boolean not null default false,
  ativo boolean not null default true,
  check (case when encerra_dia_seguinte then fecha_as <= abre_as else fecha_as > abre_as end)
);
create index periodos_funcionamento_dia_idx on public.periodos_funcionamento (dia_funcionamento_id);

create table public.alteracoes_funcionamento (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete restrict,
  versao integer not null,
  configuracao jsonb not null,
  criado_em timestamptz not null default now()
);
create index alteracoes_funcionamento_autor_idx on public.alteracoes_funcionamento (autor_id);

-- Sugestão inicial igual à informação já publicada no site. Não restringe a
-- agenda existente antes da primeira confirmação explícita do dono.
insert into public.dias_funcionamento (dia_semana, fechado)
select dia, dia = 1 from generate_series(0, 6) dia;
insert into public.periodos_funcionamento (dia_funcionamento_id, abre_as, fecha_as)
select id, '11:30', '23:00' from public.dias_funcionamento where not fechado;

alter table public.reservation_schedule_slots
  add column periodo_funcionamento_id uuid references public.periodos_funcionamento(id) on delete restrict;
alter table public.reservation_schedule_date_slots
  add column periodo_funcionamento_id uuid references public.periodos_funcionamento(id) on delete restrict;
create index reservation_schedule_periodo_idx on public.reservation_schedule_slots (periodo_funcionamento_id);
create index reservation_schedule_date_periodo_idx on public.reservation_schedule_date_slots (periodo_funcionamento_id);

alter table public.reservations
  add column periodo_funcionamento_id uuid references public.periodos_funcionamento(id) on delete restrict,
  add column duracao_reserva_minutos integer check (duracao_reserva_minutos between 30 and 480),
  add column intervalo_troca_minutos integer check (intervalo_troca_minutos between 0 and 120);
create index reservations_periodo_funcionamento_idx on public.reservations (periodo_funcionamento_id);

alter table public.configuracoes_estabelecimento enable row level security;
alter table public.dias_funcionamento enable row level security;
alter table public.periodos_funcionamento enable row level security;
alter table public.alteracoes_funcionamento enable row level security;
grant select on public.configuracoes_estabelecimento, public.dias_funcionamento, public.periodos_funcionamento to anon, authenticated;
grant select on public.alteracoes_funcionamento to authenticated;
grant all on public.configuracoes_estabelecimento, public.dias_funcionamento,
  public.periodos_funcionamento, public.alteracoes_funcionamento to service_role;
revoke insert, update, delete, truncate on public.configuracoes_estabelecimento, public.dias_funcionamento,
  public.periodos_funcionamento, public.alteracoes_funcionamento from public, anon, authenticated;
create policy "Leitura da configuracao de funcionamento" on public.configuracoes_estabelecimento for select to anon, authenticated using (true);
create policy "Leitura dos dias ativos" on public.dias_funcionamento for select to anon, authenticated using (ativo);
create policy "Leitura dos periodos ativos" on public.periodos_funcionamento for select to anon, authenticated
  using (ativo and exists (select 1 from public.dias_funcionamento d where d.id = dia_funcionamento_id and d.ativo));
create policy "Dono consulta alteracoes de funcionamento" on public.alteracoes_funcionamento for select to authenticated using (public.is_reservation_owner());
-- A edição passa pela RPC transacional; políticas antigas não podem contornar
-- o controle de versão, a auditoria e a verificação de reservas futuras.
revoke insert, update, delete, truncate on public.reservation_schedule_slots, public.reservation_schedule_date_slots from public, anon, authenticated;
create trigger alteracoes_funcionamento_imutaveis before update or delete on public.alteracoes_funcionamento
  for each row execute function public.reject_capacity_audit_mutation();

create function private.periodos_funcionamento_na_data(p_data date)
returns table (periodo_id uuid, abertura timestamp, fechamento timestamp)
language sql stable security definer set search_path = public, pg_temp
as $$
  with datas as (select p_data as data union all select p_data - 1), dias as (
    select datas.data, dia.id, dia.fechado from datas
    join lateral (
      select d.id, d.fechado from public.dias_funcionamento d
      where d.ativo and (d.data_excecao = datas.data or (d.data_excecao is null and d.dia_semana = extract(dow from datas.data)))
      order by (d.data_excecao is not null) desc limit 1
    ) dia on true
  )
  select p.id, d.data + p.abre_as, d.data + p.fecha_as + case when p.encerra_dia_seguinte then interval '1 day' else interval '0' end
  from dias d join public.periodos_funcionamento p on p.dia_funcionamento_id = d.id and p.ativo
  where not d.fechado and (d.data = p_data or p.encerra_dia_seguinte)
    and not exists (select 1 from public.dias_funcionamento ex where ex.ativo and ex.data_excecao = p_data and ex.fechado);
$$;

create function private.funcionamento_permite_reserva(p_data date, p_hora time, p_duracao integer default 0)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select not (select funcionamento_configurado from public.configuracoes_estabelecimento where id)
    or exists (select 1 from private.periodos_funcionamento_na_data(p_data) p
      where p_data + p_hora >= p.abertura and p_data + p_hora < p.fechamento
        and p_data + p_hora + make_interval(mins => p_duracao) <= p.fechamento);
$$;

create function private.contexto_agenda_reserva(p_data date, p_hora time, p_turno text)
returns table (duracao integer, preparacao integer, periodo_id uuid)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.reservation_duration_minutes, s.turnover_buffer_minutes, s.periodo_funcionamento_id
  from (
    select starts_at, ends_at, commercial_turn, reservation_duration_minutes, turnover_buffer_minutes, periodo_funcionamento_id
    from public.reservation_schedule_date_slots where reservation_date = p_data and active
    union all
    select starts_at, ends_at, commercial_turn, reservation_duration_minutes, turnover_buffer_minutes, periodo_funcionamento_id
    from public.reservation_schedule_slots where day_of_week = extract(dow from p_data) and active
      and not exists (select 1 from public.reservation_schedule_date_slots where reservation_date = p_data)
  ) s where s.commercial_turn = p_turno
  order by (p_hora between s.starts_at and s.ends_at) desc, s.starts_at limit 1;
$$;

-- Preserva os parâmetros de ocupação existentes antes de permitir edição.
with contextos as (
  select r.id, c.* from public.reservations r
  cross join lateral private.contexto_agenda_reserva(r.reservation_date, r.reservation_time, r.commercial_turn) c
)
update public.reservations r set duracao_reserva_minutos = c.duracao, intervalo_troca_minutos = c.preparacao
from contextos c where r.id = c.id;

create function private.bloquear_alteracao_agenda()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin
  perform pg_advisory_xact_lock(hashtext('estabelecimento:agenda'));
  return new;
end; $$;
create trigger a0_bloquear_alteracao_agenda before insert or update of reservation_date, reservation_time on public.reservations
  for each row execute function private.bloquear_alteracao_agenda();

create function private.registrar_contexto_funcionamento()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$ declare contexto record; begin
  if tg_op = 'INSERT' or new.reservation_date is distinct from old.reservation_date or new.reservation_time is distinct from old.reservation_time then
    select * into contexto from private.contexto_agenda_reserva(new.reservation_date, new.reservation_time, new.commercial_turn);
    new.duracao_reserva_minutos := contexto.duracao;
    new.intervalo_troca_minutos := contexto.preparacao;
    select p.periodo_id into new.periodo_funcionamento_id from private.periodos_funcionamento_na_data(new.reservation_date) p
      where new.reservation_date + new.reservation_time >= p.abertura
        and new.reservation_date + new.reservation_time < p.fechamento order by p.abertura limit 1;
  else
    new.duracao_reserva_minutos := old.duracao_reserva_minutos;
    new.intervalo_troca_minutos := old.intervalo_troca_minutos;
    new.periodo_funcionamento_id := old.periodo_funcionamento_id;
  end if;
  return new;
end; $$;
create trigger aa_registrar_contexto_funcionamento before insert or update on public.reservations
  for each row execute function private.registrar_contexto_funcionamento();

-- O helper só consulta a agenda e é chamado pelo leitor STABLE de ocupação.
alter function private.get_reservation_occupancy_window_for_slot(date, time, text) stable;

create or replace function public.get_reservation_occupancy_window(p_reservation_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$ declare r public.reservations%rowtype; inicio timestamptz; begin
  select * into r from public.reservations where id = p_reservation_id;
  if r.id is null then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if r.duracao_reserva_minutos is not null then
    inicio := timezone('America/Porto_Velho', r.reservation_date + r.reservation_time);
    return query select inicio, inicio + make_interval(mins => r.duracao_reserva_minutos + r.intervalo_troca_minutos);
  else
    return query select * from private.get_reservation_occupancy_window_for_slot(r.reservation_date, r.reservation_time, r.commercial_turn);
  end if;
end; $$;

create or replace function public.get_reservation_available_times(p_from date, p_to date)
returns table (reservation_date date, reservation_time time)
language sql stable security definer set search_path = public, pg_temp
as $$
  with datas as (select dia::date as data from generate_series(p_from, least(p_to, p_from + 366), interval '1 day') dia), janelas as (
    select datas.data, s.* from datas join lateral (
      select starts_at, ends_at, slot_interval_minutes, reservation_duration_minutes from public.reservation_schedule_date_slots
      where reservation_date = datas.data and active
      union all
      select starts_at, ends_at, slot_interval_minutes, reservation_duration_minutes from public.reservation_schedule_slots
      where day_of_week = extract(dow from datas.data) and active
        and not exists (select 1 from public.reservation_schedule_date_slots where reservation_date = datas.data)
    ) s on true where not exists (select 1 from public.blocked_dates where date = datas.data)
  )
  select distinct j.data, hora::time from janelas j
  cross join lateral generate_series(j.data + j.starts_at, j.data + j.ends_at, make_interval(mins => j.slot_interval_minutes)) hora
  where private.funcionamento_permite_reserva(j.data, hora::time, j.reservation_duration_minutes)
  order by 1, 2;
$$;

create or replace function public.reservation_time_is_available(p_reservation_date date, p_reservation_time time)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.get_reservation_available_times(p_reservation_date, p_reservation_date) h where h.reservation_time = p_reservation_time);
$$;

create function public.salvar_funcionamento_estabelecimento(p_configuracao jsonb, p_versao integer)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  dia jsonb; periodo jsonb; janela jsonb; dia_id uuid; periodo_id uuid; janela_id uuid; janela_original uuid;
  atual integer; nova_versao integer; conflitos integer; excecoes date[] := array[]::date[]; ids_periodos uuid[]; ids_janelas uuid[];
  dia_num integer; data_dia date; aberto boolean; inicio time; fim time; duracao integer; preparacao integer; passo integer;
begin
  if not public.is_reservation_owner() then raise exception 'OWNER_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext('estabelecimento:agenda'));
  select versao into atual from public.configuracoes_estabelecimento where id for update;
  if atual is distinct from p_versao then raise exception 'CONFIGURACAO_DESATUALIZADA'; end if;
  if jsonb_typeof(p_configuracao) is distinct from 'array' or jsonb_array_length(p_configuracao) not between 7 and 107 then raise exception 'CONFIGURACAO_INVALIDA'; end if;
  if (select count(distinct (d->>'dia_semana')::integer) from jsonb_array_elements(p_configuracao) d where d->>'data_excecao' is null and (d->>'dia_semana')::integer between 0 and 6) <> 7
    or (select count(*) from jsonb_array_elements(p_configuracao)) <> (select count(distinct coalesce('s:' || (d->>'dia_semana'), 'd:' || (d->>'data_excecao'))) from jsonb_array_elements(p_configuracao) d) then raise exception 'CONFIGURACAO_INVALIDA'; end if;
  if exists (select 1 from jsonb_array_elements(p_configuracao) d cross join lateral jsonb_array_elements(d->'periodos') p
    where p->>'id' is not null group by p->>'id' having count(*) > 1)
    or exists (select 1 from jsonb_array_elements(p_configuracao) d cross join lateral jsonb_array_elements(d->'reservas') j
    where j->>'id' is not null group by j->>'id' having count(*) > 1) then raise exception 'CONFIGURACAO_INVALIDA'; end if;

  for dia in select * from jsonb_array_elements(p_configuracao) loop
    dia_num := (dia->>'dia_semana')::integer; data_dia := (dia->>'data_excecao')::date;
    if (dia_num is null) = (data_dia is null) or jsonb_typeof(dia->'fechado') is distinct from 'boolean'
      or jsonb_typeof(dia->'periodos') is distinct from 'array' or jsonb_typeof(dia->'reservas') is distinct from 'array' then raise exception 'CONFIGURACAO_INVALIDA'; end if;
    aberto := not (dia->>'fechado')::boolean;
    if jsonb_array_length(dia->'periodos') > 6 or jsonb_array_length(dia->'reservas') > 12
      or (aberto and jsonb_array_length(dia->'periodos') = 0) or (not aberto and jsonb_array_length(dia->'periodos') > 0)
      or (data_dia is not null and jsonb_array_length(dia->'reservas') > 0) then raise exception 'CONFIGURACAO_INVALIDA'; end if;
    if exists (select 1 from jsonb_array_elements(dia->'reservas') j group by (j->>'starts_at')::time having count(*) > 1) then raise exception 'JANELAS_SOBREPOSTAS'; end if;

    select id into dia_id from public.dias_funcionamento where (dia_semana = dia_num and data_excecao is null) or data_excecao = data_dia;
    if dia_id is null then
      insert into public.dias_funcionamento (dia_semana, data_excecao, fechado) values (dia_num, data_dia, not aberto) returning id into dia_id;
    else
      update public.dias_funcionamento set fechado = not aberto, ativo = true, atualizado_em = now() where id = dia_id;
    end if;
    if data_dia is not null then excecoes := array_append(excecoes, data_dia); end if;
    ids_periodos := array[]::uuid[];
    for periodo in select * from jsonb_array_elements(dia->'periodos') loop
      periodo_id := coalesce((periodo->>'id')::uuid, gen_random_uuid());
      if exists (select 1 from public.periodos_funcionamento where id = periodo_id and dia_funcionamento_id <> dia_id) then raise exception 'CONFIGURACAO_INVALIDA'; end if;
      insert into public.periodos_funcionamento (id, dia_funcionamento_id, abre_as, fecha_as, encerra_dia_seguinte)
      values (periodo_id, dia_id, (periodo->>'abre_as')::time, (periodo->>'fecha_as')::time, (periodo->>'encerra_dia_seguinte')::boolean)
      on conflict (id) do update set abre_as = excluded.abre_as, fecha_as = excluded.fecha_as, encerra_dia_seguinte = excluded.encerra_dia_seguinte, ativo = true;
      ids_periodos := array_append(ids_periodos, periodo_id);
    end loop;
    update public.periodos_funcionamento set ativo = false where dia_funcionamento_id = dia_id and not (id = any(ids_periodos));

    if dia_num is not null then
      ids_janelas := array[]::uuid[];
      for janela in select * from jsonb_array_elements(dia->'reservas') loop
        inicio := (janela->>'starts_at')::time; fim := (janela->>'ends_at')::time;
        duracao := (janela->>'reservation_duration_minutes')::integer;
        preparacao := (janela->>'turnover_buffer_minutes')::integer; passo := (janela->>'slot_interval_minutes')::integer;
        select p.id into periodo_id from public.periodos_funcionamento p where p.dia_funcionamento_id = dia_id and p.ativo
          and inicio >= p.abre_as and fim >= inicio
          and date '2000-01-01' + fim + make_interval(mins => duracao) <= date '2000-01-01' + p.fecha_as + case when p.encerra_dia_seguinte then interval '1 day' else interval '0' end
          order by p.abre_as limit 1;
        if periodo_id is null or not aberto then raise exception 'RESERVA_FORA_FUNCIONAMENTO'; end if;
        janela_original := (janela->>'id')::uuid;
        if janela_original is not null and not exists (select 1 from public.reservation_schedule_slots where id = janela_original and day_of_week = dia_num) then raise exception 'CONFIGURACAO_INVALIDA'; end if;
        -- A identidade do período de decoração não pode mudar por uma simples
        -- edição da agenda. Conflitos abaixo fazem rollback de toda a operação.
        select id into janela_id from public.reservation_schedule_slots where day_of_week = dia_num and starts_at = inicio;
        -- Reutiliza a linha do horário de destino, não a origem do formulário.
        -- Assim duas janelas podem trocar de posição sem colisão ou perda de uma
        -- delas; horários removidos continuam inativos para preservar histórico.
        if janela_id is null then
          insert into public.reservation_schedule_slots (day_of_week, starts_at, ends_at, commercial_turn, slot_interval_minutes, reservation_duration_minutes, turnover_buffer_minutes, periodo_funcionamento_id)
          values (dia_num, inicio, fim, janela->>'commercial_turn', passo, duracao, preparacao, periodo_id) returning id into janela_id;
        else
          update public.reservation_schedule_slots set starts_at = inicio, ends_at = fim, commercial_turn = janela->>'commercial_turn', slot_interval_minutes = passo,
            reservation_duration_minutes = duracao, turnover_buffer_minutes = preparacao, periodo_funcionamento_id = periodo_id, active = true, updated_at = now() where id = janela_id;
        end if;
        ids_janelas := array_append(ids_janelas, janela_id);
      end loop;
      update public.reservation_schedule_slots set active = false, updated_at = now() where day_of_week = dia_num and not (id = any(ids_janelas));
      if exists (select 1 from public.reservation_schedule_slots a join public.reservation_schedule_slots b on a.id < b.id and a.day_of_week = b.day_of_week
        where a.day_of_week = dia_num and a.active and b.active and a.starts_at <= b.ends_at and b.starts_at <= a.ends_at) then raise exception 'JANELAS_SOBREPOSTAS'; end if;
    end if;
  end loop;
  update public.dias_funcionamento set ativo = false, atualizado_em = now() where data_excecao is not null and not (data_excecao = any(excecoes));

  -- Verifica a semana em si, mesmo se todos os próximos dias tiverem exceções.
  if exists (
    with semana as (
      select p.id, date '2000-01-02' + d.dia_semana + p.abre_as as abertura,
        date '2000-01-02' + d.dia_semana + p.fecha_as + case when p.encerra_dia_seguinte then interval '1 day' else interval '0' end as fechamento
      from public.dias_funcionamento d join public.periodos_funcionamento p on p.dia_funcionamento_id = d.id
      where d.ativo and not d.fechado and d.data_excecao is null and p.ativo
    )
    select 1 from semana a cross join semana b cross join generate_series(-1, 1) deslocamento
    where a.id <> b.id and a.abertura < b.fechamento + make_interval(days => deslocamento * 7)
      and b.abertura + make_interval(days => deslocamento * 7) < a.fechamento
  ) then raise exception 'PERIODOS_SOBREPOSTOS'; end if;

  if exists (
    with datas as (
      select current_date + n as data from generate_series(0, 13) n
      union select data_excecao from public.dias_funcionamento where data_excecao is not null and ativo
      union select data_excecao + 1 from public.dias_funcionamento where data_excecao is not null and ativo
    )
    select 1 from datas d cross join lateral private.periodos_funcionamento_na_data(d.data) a
    cross join lateral private.periodos_funcionamento_na_data(d.data) b
    where a.periodo_id < b.periodo_id and a.abertura < b.fechamento and b.abertura < a.fechamento
  ) then raise exception 'PERIODOS_SOBREPOSTOS'; end if;

  update public.configuracoes_estabelecimento set funcionamento_configurado = true, versao = versao + 1, atualizado_em = now() where id returning versao into nova_versao;
  -- Exceções de reservas já existentes também apontam para o funcionamento
  -- efetivo da data, sem ampliar suas janelas automaticamente.
  update public.reservation_schedule_date_slots s set periodo_funcionamento_id = (
    select p.periodo_id from private.periodos_funcionamento_na_data(s.reservation_date) p
    where s.reservation_date + s.starts_at >= p.abertura
      and s.reservation_date + s.ends_at + make_interval(mins => s.reservation_duration_minutes) <= p.fechamento
    order by p.abertura limit 1
  ) where s.active and s.reservation_date >= timezone('America/Porto_Velho', now())::date;
  select count(*) into conflitos from public.reservations r
  where r.reservation_date >= timezone('America/Porto_Velho', now())::date
    and lower(coalesce(r.status, 'pending')) not in ('cancelled', 'cancelado', 'completed', 'concluido', 'no_show')
    and r.schedule_override_reason is null
    and (not public.reservation_time_is_available(r.reservation_date, r.reservation_time)
      or public.get_reservation_commercial_turn(r.reservation_date, r.reservation_time) is distinct from r.commercial_turn
      or not private.funcionamento_permite_reserva(r.reservation_date, r.reservation_time, coalesce(r.duracao_reserva_minutos, 120))
      or (r.decoration_id is not null and public.get_reservation_service_starts_at(r.reservation_date, r.reservation_time) is distinct from r.decoration_service_starts_at));
  if conflitos > 0 then raise exception 'AGENDA_CONFLITO_RESERVAS:%', conflitos; end if;

  insert into public.alteracoes_funcionamento (autor_id, versao, configuracao) values (auth.uid(), nova_versao, p_configuracao);
  return nova_versao;
end; $$;

revoke all on function private.periodos_funcionamento_na_data(date), private.funcionamento_permite_reserva(date, time, integer),
  private.contexto_agenda_reserva(date, time, text), private.bloquear_alteracao_agenda(), private.registrar_contexto_funcionamento() from public, anon, authenticated;
revoke all on function public.salvar_funcionamento_estabelecimento(jsonb, integer) from public, anon;
grant execute on function public.salvar_funcionamento_estabelecimento(jsonb, integer) to authenticated;

commit;
