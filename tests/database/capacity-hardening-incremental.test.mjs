import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const config = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(config);
const reservationId = randomUUID();
const areaId = randomUUID();
const tableId = randomUUID();
const date = '2031-11-18';
const tokenHash = 'synthetic-preserved-reservation-token-hash';

before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20261003100000'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20261003110000'")).rows[0].n, 0);
  await db.query("insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at) values ($1,'12:00','13:30'),($1,'18:00','21:00')", [date]);
  await db.query('insert into restaurant_areas(id,name) values ($1,$2)', [areaId, `Incremental capacity ${areaId}`]);
  await db.query('insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,8)', [tableId, areaId, `HC-${tableId.slice(0, 8)}`]);
  await db.query(
    `insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,status,source,payment_status,payment_amount,reservation_access_token_hash,cpf)
     values ($1,'Preserved booking','preserve@example.invalid','69933334444',$2,'12:00',4,'confirmed','website','pending',100,$3,'52998224725')`,
    [reservationId, date, tokenHash],
  );
  await db.query("insert into reservation_payments(reservation_id,provider,provider_order_id,status,amount) values ($1,'synthetic','capacity-complement-order','pending',100)", [reservationId]);
  await db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [reservationId, [tableId]]);
});

after(async () => {
  try {
    await db.query('delete from reservation_table_assignments where reservation_id=$1', [reservationId]);
    await db.query('delete from reservations where id=$1', [reservationId]);
    await db.query('delete from reservation_schedule_date_slots where reservation_date=$1', [date]);
    await db.query('delete from restaurant_tables where id=$1', [tableId]);
    await db.query('delete from restaurant_areas where id=$1', [areaId]);
  } finally { await db.end(); }
});

test('incremental complement preserves existing payment, token, state and table allocation', async () => {
  const beforeReservation = (await db.query(
    'select id,status,payment_status,payment_amount,reservation_access_token_hash,service_starts_at from reservations where id=$1',
    [reservationId],
  )).rows[0];
  const beforePayment = (await db.query('select provider,provider_order_id,status,amount from reservation_payments where reservation_id=$1', [reservationId])).rows[0];
  const beforeAssignment = (await db.query('select table_id,allocated_capacity,starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1 and released_at is null', [reservationId])).rows[0];

  execFileSync('npm', ['run', 'db:apply:plan-2b-complement'], { cwd: process.cwd(), stdio: 'inherit' });

  const afterReservation = (await db.query(
    'select id,status,payment_status,payment_amount,reservation_access_token_hash,service_starts_at,commercial_turn from reservations where id=$1',
    [reservationId],
  )).rows[0];
  const afterPayment = (await db.query('select provider,provider_order_id,status,amount from reservation_payments where reservation_id=$1', [reservationId])).rows[0];
  const afterAssignment = (await db.query('select table_id,allocated_capacity,starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1 and released_at is null', [reservationId])).rows[0];

  assert.deepEqual(afterReservation, { ...beforeReservation, commercial_turn: 'lunch' });
  assert.deepEqual(afterPayment, beforePayment);
  assert.deepEqual(afterAssignment, beforeAssignment);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20261003110000'")).rows[0].n, 1);
});
