import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const connection = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(connection);
before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where name='configuracoes_estabelecimento'")).rows[0].n, 1);
});
after(async () => { await db.end(); });

async function transaction(callback) {
  await db.query('begin');
  try { await callback(); } finally { await db.query('rollback'); }
}
async function owner(role = 'dono') {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id}@example.invalid`]);
  // Fixture local; não promove contas reais nem altera permissões em produção.
  await db.query("set local session_replication_role='replica'");
  await db.query('update profiles set role=$2,force_password_change=false where id=$1', [id, role]);
  await db.query("set local session_replication_role='origin'");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  return id;
}
async function config() {
  const { rows } = await db.query(`select jsonb_agg(jsonb_build_object(
    'dia_semana',d.dia_semana,'data_excecao',null,'fechado',d.fechado,
    'periodos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'abre_as',p.abre_as,'fecha_as',p.fecha_as,'encerra_dia_seguinte',p.encerra_dia_seguinte)) from periodos_funcionamento p where p.dia_funcionamento_id=d.id and p.ativo),'[]'::jsonb),
    'reservas',coalesce((select jsonb_agg(to_jsonb(s)) from reservation_schedule_slots s where s.day_of_week=d.dia_semana and s.active),'[]'::jsonb))) config
    from dias_funcionamento d where d.data_excecao is null`);
  return rows[0].config;
}
async function save(dias, versao = 0) {
  return (await db.query('select salvar_funcionamento_estabelecimento($1,$2) versao', [JSON.stringify(dias), versao])).rows[0].versao;
}
async function date() {
  return (await db.query("select (current_date + 365 + ((2 - extract(dow from current_date + 365)::int + 7) % 7))::text d")).rows[0].d;
}
async function reservation(data, decoration = null, client = db) {
  const id = randomUUID();
  await client.query(`insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,cpf,decoration_id)
    values($1::uuid,'Teste local',null,$1::text,$2,'12:00',2,'52998224725',$3)`, [id, data, decoration]);
  return id;
}

test('funcionamento: dono salva atomicamente com vínculos, auditoria e versão', () => transaction(async () => {
  await owner();
  const dias = await config();
  await db.query('set local role authenticated');
  assert.equal(await save(dias), 1);
  await db.query('reset role');
  assert.equal((await db.query('select count(*)::int n from alteracoes_funcionamento')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from reservation_schedule_slots where active and periodo_funcionamento_id is null')).rows[0].n, 0);
  assert.ok((await db.query('select count(*)::int n from get_reservation_available_times(current_date+1,current_date+7)')).rows[0].n > 0);
  await db.query('savepoint versao');
  await assert.rejects(save(dias), /CONFIGURACAO_DESATUALIZADA/);
  await db.query('rollback to savepoint versao');
}));

test('funcionamento: recepção e acesso direto não podem editar a configuração', () => transaction(async () => {
  const dias = await config();
  await owner('receptionist');
  await db.query('set local role authenticated');
  await db.query('savepoint permissao');
  await assert.rejects(save(dias), /OWNER_REQUIRED/);
  await db.query('rollback to savepoint permissao');
  await assert.rejects(db.query('update configuracoes_estabelecimento set versao=99'), /permission denied/);
}));

test('funcionamento: exceção fechada substitui semana; removê-la restaura a semana', () => transaction(async () => {
  await owner();
  const dias = await config(), data = await date();
  dias.push({ dia_semana: null, data_excecao: data, fechado: true, periodos: [], reservas: [] });
  await save(dias);
  assert.equal((await db.query('select reservation_time_is_available($1,\'12:00\') disponivel', [data])).rows[0].disponivel, false);
  assert.equal((await db.query('select count(*)::int n from get_reservation_available_times($1,$1)', [data])).rows[0].n, 0);
  await save(dias.filter((dia) => !dia.data_excecao), 1);
  assert.equal((await db.query('select reservation_time_is_available($1,\'12:00\') disponivel', [data])).rows[0].disponivel, true);
}));

test('funcionamento: horário excepcional reduz agenda sem ampliar as reservas', () => transaction(async () => {
  await owner();
  const dias = await config(), data = await date();
  dias.push({ dia_semana: null, data_excecao: data, fechado: false, periodos: [{ abre_as: '12:00', fecha_as: '14:00', encerra_dia_seguinte: false }], reservas: [] });
  await save(dias);
  const horarios = (await db.query('select reservation_time from get_reservation_available_times($1,$1)', [data])).rows.map((row) => row.reservation_time);
  assert.deepEqual(horarios, ['12:00:00']);
  const semanal = dias.find((dia) => dia.dia_semana === 2);
  semanal.periodos[0].abre_as = '08:00';
  await save(dias, 1);
  assert.equal((await db.query('select reservation_time_is_available($1,\'08:00\') disponivel', [data])).rows[0].disponivel, false);
}));

test('funcionamento: fechamento conflitante faz rollback sem cancelar reserva', () => transaction(async () => {
  await owner();
  const dias = await config(), data = await date();
  const id = await reservation(data);
  dias.push({ dia_semana: null, data_excecao: data, fechado: true, periodos: [], reservas: [] });
  await db.query('savepoint conflito');
  await assert.rejects(save(dias), /AGENDA_CONFLITO_RESERVAS:1/);
  await db.query('rollback to savepoint conflito');
  assert.equal((await db.query('select versao from configuracoes_estabelecimento')).rows[0].versao, 0);
  assert.equal((await db.query('select status from reservations where id=$1', [id])).rows[0].status, 'pending');
  assert.equal((await db.query('select count(*)::int n from alteracoes_funcionamento')).rows[0].n, 0);
}));

test('funcionamento: parâmetros de ocupação de reservas antigas não mudam com a agenda', () => transaction(async () => {
  await owner();
  const dias = await config(), data = await date();
  const id = await reservation(data);
  const antes = (await db.query('select * from get_reservation_occupancy_window($1)', [id])).rows[0];
  dias.find((dia) => dia.dia_semana === 2).reservas.forEach((janela) => { janela.reservation_duration_minutes = 60; janela.turnover_buffer_minutes = 0; });
  await save(dias);
  const depois = (await db.query('select * from get_reservation_occupancy_window($1)', [id])).rows[0];
  assert.deepEqual(depois, antes);
  assert.equal((await db.query('select duracao_reserva_minutos from reservations where id=$1', [id])).rows[0].duracao_reserva_minutos, 120);
}));

test('funcionamento: madrugada e intervalos não se sobrepõem ao próximo dia', () => transaction(async () => {
  await owner();
  const dias = await config();
  const sexta = dias.find((dia) => dia.dia_semana === 5);
  sexta.periodos[0] = { ...sexta.periodos[0], abre_as: '18:00', fecha_as: '02:00', encerra_dia_seguinte: true };
  sexta.reservas = sexta.reservas.filter((janela) => janela.commercial_turn === 'dinner');
  await save(dias);
  const sabado = (await db.query("select (current_date + 365 + ((6 - extract(dow from current_date + 365)::int + 7) % 7))::text d")).rows[0].d;
  assert.equal((await db.query("select private.funcionamento_permite_reserva($1,'01:00',30) permite", [sabado])).rows[0].permite, true);
  dias.find((dia) => dia.dia_semana === 6).periodos[0].abre_as = '01:00';
  await assert.rejects(save(dias, 1), /PERIODOS_SOBREPOSTOS/);
}));

test('funcionamento: mudar início de período com decoração não libera identidade antiga', () => transaction(async () => {
  await owner();
  const dias = await config(), data = await date(), decoration = randomUUID();
  await db.query("insert into decorations(id,name,image_path,image_url) values($1::uuid,'Teste de agenda',$1::text,'https://example.invalid/agenda')", [decoration]);
  await reservation(data, decoration);
  const janela = dias.find((dia) => dia.dia_semana === 2).reservas.find((item) => item.commercial_turn === 'lunch');
  janela.starts_at = '11:30';
  await assert.rejects(save(dias), /AGENDA_CONFLITO_RESERVAS:1/);
}));

test('funcionamento: mover janelas não perde registros ao reutilizar um horário antigo', () => transaction(async () => {
  await owner();
  const dias = await config();
  const terca = dias.find((dia) => dia.dia_semana === 2);
  terca.reservas.find((janela) => janela.commercial_turn === 'lunch').starts_at = '18:00';
  terca.reservas.find((janela) => janela.commercial_turn === 'lunch').ends_at = '18:30';
  terca.reservas.find((janela) => janela.commercial_turn === 'dinner').starts_at = '19:00';
  await save(dias);
  assert.deepEqual((await db.query('select starts_at from reservation_schedule_slots where day_of_week=2 and active order by starts_at')).rows.map((row) => row.starts_at), ['18:00:00', '19:00:00']);
}));

test('funcionamento: nem o dono contorna auditoria por escrita direta na agenda', () => transaction(async () => {
  await owner();
  await db.query('set local role authenticated');
  await db.query('savepoint escrita');
  await assert.rejects(db.query("update reservation_schedule_slots set ends_at='22:00' where day_of_week=2"), /permission denied/);
  await db.query('rollback to savepoint escrita');
  assert.equal((await db.query('select count(*)::int n from dias_funcionamento')).rows[0].n, 7);
}));

test('funcionamento: salvamento aguarda reserva concorrente e revalida antes de fechar', async () => {
  const primeiro = new pg.Client(connection), segundo = new pg.Client(connection);
  let autor, reserva;
  await db.query('begin');
  try { autor = await owner(); await db.query('commit'); } catch (error) { await db.query('rollback'); throw error; }
  await Promise.all([primeiro.connect(), segundo.connect()]);
  try {
    const dias = await config(), data = await date();
    dias.push({ dia_semana: null, data_excecao: data, fechado: true, periodos: [], reservas: [] });
    await primeiro.query('begin');
    await segundo.query('begin');
    reserva = await reservation(data, null, primeiro);
    await segundo.query("select set_config('request.jwt.claim.sub',$1,true)", [autor]);
    const pid = (await segundo.query('select pg_backend_pid() pid')).rows[0].pid;
    const pendente = segundo.query('select salvar_funcionamento_estabelecimento($1,0)', [JSON.stringify(dias)]).then(() => null, (error) => error);
    let bloqueado = false;
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      bloqueado = (await db.query('select cardinality(pg_blocking_pids($1)) > 0 bloqueado', [pid])).rows[0].bloqueado;
      if (bloqueado) break;
      await delay(10);
    }
    assert.ok(bloqueado, 'o salvamento deve aguardar a transação da reserva');
    await primeiro.query('commit');
    assert.match((await pendente)?.message || '', /AGENDA_CONFLITO_RESERVAS:1/);
    await segundo.query('rollback');
    assert.equal((await db.query('select versao from configuracoes_estabelecimento')).rows[0].versao, 0);
  } finally {
    await Promise.all([primeiro.query('rollback'), segundo.query('rollback')]);
    await Promise.all([primeiro.end(), segundo.end()]);
    if (reserva) await db.query('delete from reservations where id=$1', [reserva]);
    await db.query('delete from auth.users where id=$1', [autor]);
  }
});
