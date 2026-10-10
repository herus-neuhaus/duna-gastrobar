import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const config = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(config);
const reservations = [];
const dates = [];
const areaId = randomUUID();
const tableIds = [randomUUID(), randomUUID(), randomUUID()];
let day = 100;

before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  await db.query('insert into restaurant_areas(id,name) values ($1,$2)', [areaId, `Rescheduling ${areaId}`]);
  for (const [index, id] of tableIds.entries()) {
    await db.query('insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,8)', [id, areaId, `R-${id.slice(0, 8)}-${index}`]);
  }
});

after(async () => {
  try {
    await db.query('delete from reservation_table_assignments where reservation_id = any($1::uuid[])', [reservations]);
    await db.query('delete from reservations where id = any($1::uuid[])', [reservations]);
    await db.query('delete from reservation_schedule_date_slots where reservation_date = any($1::date[])', [dates]);
    await db.query('delete from restaurant_tables where id = any($1::uuid[])', [tableIds]);
    await db.query('delete from restaurant_areas where id=$1', [areaId]);
  } finally {
    await db.end();
  }
});

async function date(slots = [
  { startsAt: '12:00', endsAt: '13:30', duration: 120, buffer: 30, commercialTurn: 'lunch' },
  { startsAt: '18:00', endsAt: '21:00', duration: 120, buffer: 30, commercialTurn: 'dinner' },
]) {
  const value = (await db.query("select (current_date + $1::int)::text d", [365 + day++])).rows[0].d;
  dates.push(value);
  for (const slot of slots) {
    await db.query(
      `insert into reservation_schedule_date_slots(
         reservation_date,starts_at,ends_at,reservation_duration_minutes,turnover_buffer_minutes,commercial_turn
       ) values ($1,$2,$3,$4,$5,$6)`,
      [value, slot.startsAt, slot.endsAt, slot.duration, slot.buffer, slot.commercialTurn],
    );
  }
  return value;
}

async function reservation(reservationDate, time = '12:00', guests = 2) {
  const id = randomUUID();
  reservations.push(id);
  await db.query(
    `insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,status,source)
      values ($1,'Synthetic reschedule','reschedule@example.invalid',$2,$3,$4,$5,'pending','website')`,
    [id, id, reservationDate, time, guests],
  );
  return id;
}

function assign(id, assignedTables = [tableIds[0]]) {
  return db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [id, assignedTables]);
}

async function reschedule(id, reservationDate, time) {
  return db.query('update reservations set reservation_date=$2,reservation_time=$3 where id=$1', [id, reservationDate, time]);
}

async function activeAssignments(id) {
  return (await db.query(
    `select table_id,starts_at,ends_at,to_char(starts_at at time zone 'America/Porto_Velho','YYYY-MM-DD HH24:MI') local_start,
       to_char(ends_at at time zone 'America/Porto_Velho','YYYY-MM-DD HH24:MI') local_end
     from reservation_table_assignments
     where reservation_id=$1 and released_at is null order by table_id`,
    [id],
  )).rows;
}

async function race(firstQuery, secondQuery) {
  const first = new pg.Client(config);
  const second = new pg.Client(config);
  await Promise.all([first.connect(), second.connect()]);
  try {
    await first.query('begin');
    await second.query('begin');
    const firstPid = (await first.query('select pg_backend_pid() pid')).rows[0].pid;
    const secondPid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
    const winner = await first.query(firstQuery);
    const pending = second.query(secondQuery).then(result => ({ result }), error => ({ error }));
    let blocked = false;
    for (let attempts = 0; attempts < 100; attempts++) {
      const row = (await db.query('select $1::int = any(pg_blocking_pids($2)) blocked', [firstPid, secondPid])).rows[0];
      if (row.blocked) { blocked = true; break; }
      await delay(20);
    }
    assert.ok(blocked, 'second independent reschedule must wait for the table lock');
    await first.query('commit');
    const loser = await pending;
    await second.query(loser.error ? 'rollback' : 'commit');
    return { winner, ...loser };
  } finally {
    await Promise.all([first.query('rollback'), second.query('rollback')]);
    await Promise.all([first.end(), second.end()]);
  }
}

test('rescheduling: 12h to 18h updates the active window, frees 12h and occupies 18h', async () => {
  const d = await date();
  const id = await reservation(d);
  await assign(id);
  await reschedule(id, d, '18:00');

  assert.deepEqual(await activeAssignments(id), [{
    table_id: tableIds[0],
    starts_at: (await activeAssignments(id))[0].starts_at,
    ends_at: (await activeAssignments(id))[0].ends_at,
    local_start: `${d} 18:00`,
    local_end: `${d} 20:30`,
  }]);

  const oldPeriod = await reservation(d, '12:00');
  await assign(oldPeriod);
  const newPeriod = await reservation(d, '18:00');
  await assert.rejects(assign(newPeriod), { code: '23P01' });
});

test('rescheduling: changing date recalculates the window in America/Porto_Velho', async () => {
  const from = await date();
  const to = await date();
  const id = await reservation(from);
  await assign(id);
  await reschedule(id, to, '18:00');
  const assignment = (await activeAssignments(id))[0];
  assert.equal(assignment.local_start, `${to} 18:00`);
  assert.equal(assignment.local_end, `${to} 20:30`);
});

test('rescheduling: every active assigned table is moved together', async () => {
  const d = await date();
  const id = await reservation(d);
  await assign(id, [tableIds[0], tableIds[1]]);
  await reschedule(id, d, '18:00');
  const assignments = await activeAssignments(id);
  assert.equal(assignments.length, 2);
  assert.deepEqual(assignments.map(({ table_id, local_start, local_end }) => ({ table_id, local_start, local_end })), [
    { table_id: tableIds[0], local_start: `${d} 18:00`, local_end: `${d} 20:30` },
    { table_id: tableIds[1], local_start: `${d} 18:00`, local_end: `${d} 20:30` },
  ].sort((a, b) => a.table_id.localeCompare(b.table_id)));
});

test('rescheduling: released assignment history is never rewritten', async () => {
  const d = await date();
  const id = await reservation(d);
  await assign(id);
  const before = (await db.query('select starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1', [id])).rows[0];
  await db.query('update reservation_table_assignments set released_at=now() where reservation_id=$1', [id]);
  await reschedule(id, d, '18:00');
  const after = (await db.query('select starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1', [id])).rows[0];
  assert.deepEqual(after, { ...before, released_at: after.released_at });
  assert.ok(after.released_at);
});

test('rescheduling: a reservation without tables remains schedulable', async () => {
  const from = await date();
  const to = await date();
  const id = await reservation(from);
  await reschedule(id, to, '18:00');
  assert.deepEqual((await db.query('select reservation_date::text reservation_date,reservation_time from reservations where id=$1', [id])).rows[0], { reservation_date: to, reservation_time: '18:00:00' });
  assert.equal((await db.query('select count(*)::int n from reservation_table_assignments where reservation_id=$1', [id])).rows[0].n, 0);
});

test('rescheduling: simultaneous guest changes keep allocation validation and rollback semantics', async () => {
  const d = await date();
  const id = await reservation(d, '12:00', 2);
  await assign(id);
  const before = (await activeAssignments(id))[0];

  await assert.rejects(
    db.query("update reservations set reservation_time='18:00',num_guests=9 where id=$1", [id]),
    /TABLE_ASSIGNMENT_CAPACITY_INSUFFICIENT/,
  );
  assert.deepEqual((await db.query('select reservation_time,num_guests from reservations where id=$1', [id])).rows[0], { reservation_time: '12:00:00', num_guests: 2 });
  assert.deepEqual((await activeAssignments(id))[0], before);

  await db.query("update reservations set reservation_time='18:00',num_guests=8 where id=$1", [id]);
  assert.deepEqual((await db.query('select reservation_time,num_guests from reservations where id=$1', [id])).rows[0], { reservation_time: '18:00:00', num_guests: 8 });
  assert.equal((await activeAssignments(id))[0].local_start, `${d} 18:00`);
});

test('rescheduling: a conflict on one table rolls back reservation, active assignments and history', async () => {
  const d = await date();
  const subject = await reservation(d, '12:00');
  await assign(subject, [tableIds[0], tableIds[1]]);
  const blocker = await reservation(d, '18:00');
  await assign(blocker, [tableIds[1]]);
  await db.query(
    `insert into reservation_table_assignments(reservation_id,table_id,allocated_capacity,starts_at,ends_at,released_at)
     values ($1,$2,8,timezone('America/Porto_Velho',$3::date + time '12:00'),timezone('America/Porto_Velho',$3::date + time '13:00'),now())`,
    [subject, tableIds[2], d],
  );
  const beforeReservation = (await db.query('select reservation_date,reservation_time from reservations where id=$1', [subject])).rows[0];
  const beforeAssignments = (await db.query('select table_id,starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1 order by table_id', [subject])).rows;

  await assert.rejects(reschedule(subject, d, '18:00'), { code: '23P01', constraint: 'reservation_table_assignments_no_overlap' });

  assert.deepEqual((await db.query('select reservation_date,reservation_time from reservations where id=$1', [subject])).rows[0], beforeReservation);
  assert.deepEqual((await db.query('select table_id,starts_at,ends_at,released_at from reservation_table_assignments where reservation_id=$1 order by table_id', [subject])).rows, beforeAssignments);
});

test('rescheduling: a date override supplies its configured duration and buffer', async () => {
  const from = await date();
  const to = await date([{ startsAt: '18:00', endsAt: '18:00', duration: 45, buffer: 15, commercialTurn: 'dinner' }]);
  const id = await reservation(from);
  await assign(id);
  await reschedule(id, to, '18:00');
  const assignment = (await activeAssignments(id))[0];
  assert.equal(assignment.local_start, `${to} 18:00`);
  assert.equal(assignment.local_end, `${to} 19:00`);
});

test('rescheduling: concurrent moves toward the same table window cannot overlap', async () => {
  const d = await date([
    { startsAt: '12:00', endsAt: '12:00', duration: 30, buffer: 0, commercialTurn: 'lunch' },
    { startsAt: '15:00', endsAt: '15:00', duration: 30, buffer: 0, commercialTurn: 'lunch' },
    { startsAt: '18:00', endsAt: '18:00', duration: 30, buffer: 0, commercialTurn: 'dinner' },
  ]);
  const first = await reservation(d, '12:00');
  const second = await reservation(d, '18:00');
  await assign(first);
  await assign(second);

  const result = await race(
    { text: "update reservations set reservation_time='15:00' where id=$1", values: [first] },
    { text: "update reservations set reservation_time='15:00' where id=$1", values: [second] },
  );
  assert.equal(result.winner.rowCount, 1);
  assert.equal(result.error?.code, '23P01');
  assert.equal((await db.query("select count(*)::int n from reservation_table_assignments where table_id=$1 and released_at is null and occupancy_range @> timezone('America/Porto_Velho',$2::date + time '15:00')", [tableIds[0], d])).rows[0].n, 1);
});
