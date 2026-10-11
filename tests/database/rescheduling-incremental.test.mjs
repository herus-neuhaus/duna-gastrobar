import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const config = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(config);
const date = '2030-10-03';
const areaId = randomUUID();
const tableId = randomUUID();
const currentTableId = randomUUID();
const legacyId = randomUUID();
const currentId = randomUUID();

async function createReservation(id, assignedTableId) {
  await db.query(
    `insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,status,source,cpf)
      values ($1,'Synthetic incremental','incremental@example.invalid',$2,$3,'12:00',2,'pending','website','52998224725')`,
    [id, id, date],
  );
  await db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [id, [assignedTableId]]);
}

before(async () => {
  await db.connect();
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20261003090000'")).rows[0].n, 0, 'start with the pre-Plan-2A local history');
  await db.query("insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at) values ($1,'12:00','13:30'),($1,'18:00','21:00')", [date]);
  await db.query('insert into restaurant_areas(id,name) values ($1,$2)', [areaId, `Incremental ${areaId}`]);
  await db.query('insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,8)', [tableId, areaId, `I-${tableId.slice(0, 8)}`]);
  await db.query('insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,8)', [currentTableId, areaId, `I-${currentTableId.slice(0, 8)}`]);
  await createReservation(legacyId, tableId);
});

after(async () => {
  try {
    await db.query('delete from reservation_table_assignments where reservation_id in ($1,$2)', [legacyId, currentId]);
    await db.query('delete from reservations where id in ($1,$2)', [legacyId, currentId]);
    await db.query('delete from reservation_schedule_date_slots where reservation_date=$1', [date]);
    await db.query('delete from restaurant_tables where id in ($1,$2)', [tableId, currentTableId]);
    await db.query('delete from restaurant_areas where id=$1', [areaId]);
  } finally {
    await db.end();
  }
});

test('incremental migration applies over synthetic pre-existing assignments', async () => {
  // This reproduces the pre-migration defect without involving production data.
  await db.query("update reservations set reservation_time='18:00' where id=$1", [legacyId]);
  assert.equal((await db.query(
    `select a.starts_at = w.starts_at matches
     from reservation_table_assignments a
     cross join lateral get_reservation_occupancy_window(a.reservation_id) w
     where a.reservation_id=$1 and a.released_at is null`,
    [legacyId],
  )).rows[0].matches, false);

  execFileSync('npm', ['run', 'db:apply:plan-2a'], { cwd: process.cwd(), stdio: 'inherit' });
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20261003090000'")).rows[0].n, 1);

  await createReservation(currentId, currentTableId);
  await db.query("update reservations set reservation_time='18:00' where id=$1", [currentId]);
  const row = (await db.query(
    `select to_char(a.starts_at at time zone 'America/Porto_Velho','HH24:MI') starts_at,
       to_char(a.ends_at at time zone 'America/Porto_Velho','HH24:MI') ends_at
     from reservation_table_assignments a where a.reservation_id=$1 and a.released_at is null`,
    [currentId],
  )).rows[0];
  assert.deepEqual(row, { starts_at: '18:00', ends_at: '20:30' });
});
