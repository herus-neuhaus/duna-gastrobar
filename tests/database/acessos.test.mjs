import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const db = new pg.Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 });
before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where name='alinhar_acessos_administrador_operacao'")).rows[0].n, 1);
});
after(async () => { await db.end(); });

async function transaction(callback) {
  await db.query('begin');
  try { await callback(); } finally { await db.query('rollback'); }
}
async function user(role, forced = false) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id}@example.invalid`]);
  // Somente fixtures locais, não contas reais.
  await db.query("set local session_replication_role='replica'");
  await db.query('update profiles set role=$2,force_password_change=$3 where id=$1', [id, role, forced]);
  await db.query("set local session_replication_role='origin'");
  return id;
}
async function actor(id, callback) {
  await db.query('savepoint actor_scope');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query('set local role authenticated');
    const result = await callback();
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query('release savepoint actor_scope');
    return result;
  } catch (error) {
    await db.query('rollback to savepoint actor_scope');
    await db.query('release savepoint actor_scope');
    throw error;
  }
}

test('acessos: admin e dono têm poderes administrativos; equipe apenas operação', () => transaction(async () => {
  for (const role of ['admin', 'dono', 'employee', 'gerente', 'receptionist', 'portaria', 'customer']) {
    const id = await user(role);
    const result = await actor(id, async () => (await db.query('select public.is_reservation_owner() administrador, private.is_manager() gestor, private.is_reservation_staff() operacional, public.can_override_reservation_capacity() exceder')).rows[0]);
    const administrativo = ['admin', 'dono'].includes(role);
    assert.deepEqual(result, { administrador: administrativo, gestor: administrativo, operacional: role !== 'customer', exceder: administrativo });
  }
}));

test('acessos: troca de senha obrigatória não pode ser removida pelo próprio usuário', () => transaction(async () => {
  const id = await user('admin', true);
  await actor(id, async () => {
    assert.equal((await db.query('select public.is_reservation_owner() permitido')).rows[0].permitido, false);
  });
  await assert.rejects(actor(id, () => db.query('update profiles set force_password_change=false where id=$1', [id])), /CANNOT_CHANGE_OWN_ACCESS/);
}));

test('acessos: administrador pode configurar o estabelecimento', () => transaction(async () => {
  const id = await user('admin');
  const config = (await db.query(`select jsonb_agg(jsonb_build_object('dia_semana',d.dia_semana,'data_excecao',null,'fechado',d.fechado,
    'periodos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'abre_as',p.abre_as,'fecha_as',p.fecha_as,'encerra_dia_seguinte',p.encerra_dia_seguinte)) from periodos_funcionamento p where p.dia_funcionamento_id=d.id and p.ativo),'[]'::jsonb),
    'reservas',coalesce((select jsonb_agg(to_jsonb(s)) from reservation_schedule_slots s where s.day_of_week=d.dia_semana and s.active),'[]'::jsonb))) config from dias_funcionamento d where d.data_excecao is null`)).rows[0].config;
  assert.equal((await actor(id, () => db.query('select salvar_funcionamento_estabelecimento($1,0) versao', [JSON.stringify(config)]))).rows[0].versao, 1);
}));

test('acessos: funcionário não promove a si mesmo nem altera outros perfis', () => transaction(async () => {
  const employee = await user('employee'), target = await user('customer');
  await assert.rejects(actor(employee, () => db.query("update profiles set role='admin' where id=$1", [employee])), /CANNOT_CHANGE_OWN_ACCESS/);
  assert.equal((await actor(employee, () => db.query("update profiles set role='admin' where id=$1", [target]))).rowCount, 0);
  await assert.rejects(actor(employee, () => db.query("select salvar_funcionamento_estabelecimento('[]',0)")), /OWNER_REQUIRED/);
}));

test('acessos: administrador gerencia cargos de terceiros com auditoria, não o próprio', () => transaction(async () => {
  const admin = await user('admin'), target = await user('employee');
  await actor(admin, () => db.query("update profiles set role='admin' where id=$1", [target]));
  const audit = (await db.query('select autor_id,cargo_anterior,cargo_novo from alteracoes_cargos where perfil_id=$1', [target])).rows[0];
  assert.deepEqual(audit, { autor_id: admin, cargo_anterior: 'employee', cargo_novo: 'admin' });
  await assert.rejects(actor(admin, () => db.query("update profiles set role='employee' where id=$1", [admin])), /CANNOT_CHANGE_OWN_ACCESS/);
  const employee = await user('employee');
  assert.equal((await actor(employee, () => db.query('select * from alteracoes_cargos'))).rowCount, 0);
}));

test('acessos: gerente legado perde escrita sensível e continua com leitura operacional', () => transaction(async () => {
  const gerente = await user('gerente');
  assert.equal((await actor(gerente, () => db.query("update blocked_dates set reason='indevido' returning id"))).rowCount, 0);
  assert.equal((await actor(gerente, () => db.query('select * from profiles'))).rowCount, 1);
  await assert.rejects(actor(gerente, () => db.query("insert into employee_roles(name) values('Cargo indevido')")), /row-level security/);
}));

test('acessos: pagamentos completos são invisíveis ao funcionário e visíveis ao administrador', () => transaction(async () => {
  const admin = await user('admin'), employee = await user('employee');
  const date = (await db.query("select (current_date + 365 + ((2-extract(dow from current_date+365)::int+7)%7))::text d")).rows[0].d;
  const reservation = randomUUID(), payment = randomUUID();
  await db.query("insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,cpf) values($1::uuid,'Teste local',null,$1::text,$2,'12:00',2,'52998224725')", [reservation, date]);
  await db.query("insert into reservation_payments(id,reservation_id,provider,provider_order_id,status,amount) values($1::uuid,$2,'synthetic',$1::text,'pending',42)", [payment, reservation]);
  assert.equal((await actor(employee, () => db.query('select id from reservations where id=$1', [reservation]))).rowCount, 1);
  assert.equal((await actor(employee, () => db.query('select * from reservation_payments where id=$1', [payment]))).rowCount, 0);
  assert.equal((await actor(admin, () => db.query('select * from reservation_payments where id=$1', [payment]))).rowCount, 1);
}));

test('acessos: funcionário registra atendimento presencial sem receber gestão', () => transaction(async () => {
  const employee = await user('employee');
  const today = (await db.query("select timezone('America/Porto_Velho',now())::date::text d")).rows[0].d;
  await db.query("insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at,commercial_turn) values($1,'12:00','13:30','lunch') on conflict(reservation_date,starts_at) do nothing", [today]);
  const result = await actor(employee, () => db.query("select * from create_walk_in_reservation('Atendimento local',null,'69912345678',$1,'12:00',2,null,null)", [today]));
  assert.equal(result.rowCount, 1);
  assert.equal((await db.query('select source from reservations where id=$1', [result.rows[0].id])).rows[0].source, 'walk_in');
}));

test('acessos: delegação de capacidade para funcionário exige concessão explícita', () => transaction(async () => {
  const admin = await user('admin'), employee = await user('employee');
  await assert.rejects(actor(employee, () => db.query('select * from set_reservation_capacity_permission($1,true,\'Sem autorização\')', [admin])), /OWNER_REQUIRED/);
  await actor(admin, () => db.query('select * from set_reservation_capacity_permission($1,true,\'Cobertura operacional aprovada\')', [employee]));
  assert.equal((await actor(employee, () => db.query('select can_override_reservation_capacity() permitido'))).rows[0].permitido, true);
  assert.equal((await actor(employee, () => db.query('select is_reservation_admin_or_owner() permitido'))).rows[0].permitido, false);
}));

test('acessos: uma exclusão pela API privilegiada não remove o último administrador', () => transaction(async () => {
  const admin = await user('admin');
  assert.equal((await db.query("select count(*)::int n from profiles where role in ('admin','dono')")).rows[0].n, 1);
  await db.query('set local role service_role');
  await assert.rejects(db.query('delete from profiles where id=$1', [admin]), /LAST_ADMIN_REQUIRED/);
}));
