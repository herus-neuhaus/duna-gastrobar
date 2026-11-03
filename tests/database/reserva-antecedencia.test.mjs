import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// Somente sandbox dedicado, sem .env/URL externa. Requer autorização própria
// para execução. Exercita o trigger real em tabela temporária, sem criar reservas
// de clientes, aplicar histórico ou acionar os outros triggers de negócio.
const db = new pg.Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 });
const migration = readFileSync(new URL('../../supabase/migrations/20261030013127_antecedencia_reservas_duas_horas.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, '');

before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20260901000000'")).rows[0].n, 1);
  assert.equal((await db.query("select to_regprocedure('public.validate_reservation_schedule()') is not null present")).rows[0].present, true);
});
after(async () => { await db.end(); });

async function transaction(callback) {
  await db.query('begin');
  try {
    await db.query(migration);
    await db.query(`create temporary table reserva_antecedencia (
      id integer generated always as identity, reservation_date date, reservation_time time, source text
    ) on commit drop;
    create trigger validate_reservation_schedule before insert or update of reservation_date, reservation_time
      on reserva_antecedencia for each row execute function public.validate_reservation_schedule()`);
    // O override existente de agenda NÃO dispensa a antecedência. Assim as
    // fronteiras exatas independem do horário em que a suíte é executada.
    await db.query("select set_config('app.reservation_schedule_override','enabled',true)");
    await callback();
  } finally { await db.query('rollback'); }
}

function insert(offset, source = 'website') {
  return db.query(`insert into pg_temp.reserva_antecedencia(reservation_date,reservation_time,source)
    select instante::date, instante::time, $2::text
    from (select timezone('America/Porto_Velho',now()) + $1::interval as instante) t returning id`, [offset, source]);
}

test('antecedência: aceita exatamente duas horas, inclusive com microssegundos do relógio', () => transaction(async () => {
  assert.equal((await insert('2 hours')).rowCount, 1);
}));

test('antecedência: aceita mais de duas horas', () => transaction(async () => {
  assert.equal((await insert('2 hours 1 microsecond')).rowCount, 1);
}));

test('antecedência: rejeita um microssegundo abaixo de duas horas, mesmo com override de agenda', () => transaction(async () => {
  await assert.rejects(insert('1 hour 59 minutes 59.999999 seconds'), /RESERVATION_LEAD_TIME_NOT_MET/);
}));

test('antecedência: origem ausente não contorna o limite', () => transaction(async () => {
  await assert.rejects(insert('1 hour', null), /RESERVATION_LEAD_TIME_NOT_MET/);
}));

test('antecedência: preserva a exceção de walk-in', () => transaction(async () => {
  assert.equal((await insert('0 seconds', 'walk_in')).rowCount, 1);
}));

test('antecedência: reagendamento também rejeita menos de duas horas', () => transaction(async () => {
  const id = (await insert('3 hours')).rows[0].id;
  await assert.rejects(db.query(`update pg_temp.reserva_antecedencia
    set reservation_date = (timezone('America/Porto_Velho',now()) + interval '1 hour')::date,
      reservation_time = (timezone('America/Porto_Velho',now()) + interval '1 hour')::time where id=$1`, [id]), /RESERVATION_LEAD_TIME_NOT_MET/);
}));

test('antecedência: alteração sem mudar data/hora preserva o registro anterior', () => transaction(async () => {
  const id = (await insert('0 seconds', 'walk_in')).rows[0].id;
  // Torna o registro uma reserva comum dentro do prazo mínimo sem alterar data/hora.
  await db.query("update pg_temp.reserva_antecedencia set source='website' where id=$1", [id]);
  assert.equal((await db.query('update pg_temp.reserva_antecedencia set reservation_time=reservation_time where id=$1', [id])).rowCount, 1);
}));

test('antecedência: mantém a rejeição de horário fora da agenda sem override', () => transaction(async () => {
  await db.query("select set_config('app.reservation_schedule_override','',true)");
  const slot = (await db.query(`select instante::date::text dia, instante::time::text hora
    from generate_series((timezone('America/Porto_Velho',now())::date + 10)::timestamp,
      (timezone('America/Porto_Velho',now())::date + 11)::timestamp, interval '1 minute') instante
    where not public.reservation_time_is_available(instante::date,instante::time) limit 1`)).rows[0];
  assert.ok(slot, 'A agenda sintética precisa ter pelo menos um horário indisponível.');
  await assert.rejects(db.query(`insert into pg_temp.reserva_antecedencia(reservation_date,reservation_time,source)
    values($1,$2,'website')`, [slot.dia, slot.hora]), /RESERVATION_TIME_UNAVAILABLE/);
}));

test('antecedência: substituir a função preserva os privilégios e a segurança invoker', async () => {
  const query = "select proacl::text, prosecdef from pg_proc where oid='public.validate_reservation_schedule()'::regprocedure";
  const previous = (await db.query(query)).rows[0];
  await transaction(async () => {
    assert.deepEqual((await db.query(query)).rows[0], previous);
    assert.equal(previous.prosecdef, false);
  });
});
