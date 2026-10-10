import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

// Deliberately no .env, DATABASE_URL, Supabase HTTP client or payment provider.
const config = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(config);
const reservationIds = [];
const dates = [];
const decorationId = randomUUID();
const areaId = randomUUID();
const tableId = randomUUID();
let verified = false;
let day = 0;

before(async () => {
  // Require the dedicated CLI container AND verify that the TCP endpoint is that
  // same cluster before any DML. This is not a configurable integration target.
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20260901000000'")).rows[0].n, 1);
  verified = true;
  await db.query("insert into decorations(id,name,image_path,image_url) values ($1,'Synthetic decoration',$2,'https://example.invalid/decoration')", [decorationId, decorationId]);
  await db.query("insert into restaurant_areas(id,name) values ($1,$2)", [areaId, `Synthetic ${areaId}`]);
  await db.query("insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,8)", [tableId, areaId, `T-${tableId.slice(0,8)}`]);
});

after(async () => {
  try {
    if (verified) {
      await db.query('delete from reservation_table_assignments where reservation_id = any($1::uuid[])', [reservationIds]);
      await db.query('delete from reservations where id = any($1::uuid[])', [reservationIds]);
      await db.query('delete from reservation_schedule_date_slots where reservation_date = any($1::date[])', [dates]);
      await db.query('delete from restaurant_tables where id=$1', [tableId]);
      await db.query('delete from restaurant_areas where id=$1', [areaId]);
      await db.query('delete from decorations where id=$1', [decorationId]);
    }
  } finally { await db.end(); }
});

async function date() {
  const value = (await db.query("select (current_date + $1::int)::text d", [365 + day++])).rows[0].d;
  dates.push(value);
  await db.query("insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at) values ($1,'12:00','13:30'),($1,'18:00','21:00')", [value]);
  return value;
}

function insertQuery(d, guests = 2, options = {}) {
  const id = randomUUID();
  reservationIds.push(id);
  return {
    text: `insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,decoration_id,status,reservation_access_token_hash,source)
      values ($1,'Synthetic guest','synthetic@example.invalid',$2,$3,$4,$5,$6,$7,'synthetic-token',$8) returning id`,
    values: [id, options.phone ?? id, d, options.time ?? '12:00', guests, options.decoration ?? null, options.status ?? 'pending', options.source ?? 'website'],
  };
}
async function reservation(d, guests = 2, options = {}) {
  return (await db.query(insertQuery(d, guests, options))).rows[0].id;
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
    // Attach rejection immediately, and prove the second connection really waits.
    const pending = second.query(secondQuery).then(result => ({ result }), error => ({ error }));
    let blocked = false;
    for (let attempts = 0; attempts < 100; attempts++) {
      const row = (await db.query('select $1::int = any(pg_blocking_pids($2)) blocked', [firstPid, secondPid])).rows[0];
      if (row.blocked) { blocked = true; break; }
      await delay(20);
    }
    assert.ok(blocked, 'independent transaction must wait for first transaction');
    await first.query('commit');
    const loser = await pending;
    await second.query(loser.error ? 'rollback' : 'commit');
    return { winner, ...loser };
  } finally {
    await Promise.all([first.query('rollback'), second.query('rollback')]);
    await Promise.all([first.end(), second.end()]);
  }
}

test('schema: sequential history, enabled capacity trigger, RLS and constraints', async () => {
  assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n, 24);
  assert.equal((await db.query("select tgenabled from pg_trigger where tgname='reservation_service_capacity'")).rows[0].tgenabled, 'O');
  assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='No direct access to reservation recovery challenges'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n, 0);
  const d = await date();
  await assert.rejects(db.query(insertQuery(d, 0)), { code: '23514' });
  await assert.rejects(db.query(insertQuery(d, 1, { status: 'invalid' })), { code: '23514' });
});

test('capacity: independent concurrent inserts cannot exceed 80 in the same turn', async () => {
  const d = await date();
  const result = await race(insertQuery(d, 50), insertQuery(d, 40));
  assert.match(result.error?.message ?? '', /CAPACITY_EXCEEDED/);
  assert.equal((await db.query('select sum(num_guests)::int n from reservations where reservation_date=$1', [d])).rows[0].n, 50);
});

test('capacity: lunch and dinner are independent', async () => {
  const d = await date();
  const id = await reservation(d, 80, { status: 'completed' });
  await assert.rejects(db.query(insertQuery(d, 1)), /CAPACITY_EXCEEDED/);
  await reservation(d, 1, { time: '18:00' });
  await db.query("update reservations set status='cancelled' where id=$1", [id]);
  await reservation(d, 1);
});

test('decoration: concurrent same-period conflict, separate dinner and cancellation release', async () => {
  const d = await date();
  const result = await race(insertQuery(d, 2, { decoration: decorationId }), insertQuery(d, 2, { time: '13:00', decoration: decorationId }));
  assert.equal(result.error?.code, '23505');
  assert.equal(result.error?.constraint, 'reservations_active_decoration_period_unique');
  await reservation(d, 2, { time: '18:00', decoration: decorationId });
  await db.query("update reservations set status='cancelled' where id=$1", [result.winner.rows[0].id]);
  await reservation(d, 2, { decoration: decorationId });
});

function assign(id) {
  return { text: 'select * from replace_reservation_table_assignments($1,$2::uuid[])', values: [id, [tableId]] };
}
test('tables: independent concurrent allocations conflict and losing transaction is atomic', async () => {
  const d = await date();
  const first = await reservation(d);
  const second = await reservation(d);
  const result = await race(assign(first), assign(second));
  assert.equal(result.error?.code, '23P01');
  assert.equal((await db.query('select count(*)::int n from reservation_table_assignments where reservation_id=$1', [second])).rows[0].n, 0);
  await db.query("select * from transition_reservation_status($1,array['pending'],'cancelled')", [first]);
  await db.query(assign(second));
  assert.equal((await db.query('select count(*)::int n from reservation_table_assignments where reservation_id=$1 and released_at is not null', [first])).rows[0].n, 1);
});

test('tables: an inactive area cannot be assigned through the backend function', async () => {
  const d = await date();
  const id = await reservation(d);
  await db.query('update restaurant_areas set active=false where id=$1', [areaId]);
  try {
    const availability = await db.query('select available from get_reservation_table_availability($1) where table_id=$2', [id, tableId]);
    assert.equal(availability.rows[0]?.available, false);
    await assert.rejects(db.query(assign(id)), /TABLE_NOT_AVAILABLE/);
    assert.equal((await db.query('select count(*)::int n from reservation_table_assignments where reservation_id=$1 and released_at is null', [id])).rows[0].n, 0);
  } finally {
    await db.query('update restaurant_areas set active=true where id=$1', [areaId]);
  }
});

test('states: allowed transitions, timestamps, events, terminal and stale-state rejection', async () => {
  const id = await reservation(await date());
  assert.equal((await db.query("select * from transition_reservation_status($1,array['pending'],'seated')", [id])).rowCount, 0);
  for (const [previous, next] of [['pending','confirmed'], ['confirmed','seated'], ['seated','completed']]) {
    assert.equal((await db.query('select * from transition_reservation_status($1,$2,$3)', [id, [previous], next])).rows[0].status, next);
  }
  assert.equal((await db.query("select * from transition_reservation_status($1,array['completed'],'confirmed')", [id])).rowCount, 0);
  const row = (await db.query('select seated_at,completed_at from reservations where id=$1', [id])).rows[0];
  assert.ok(row.seated_at && row.completed_at);
  assert.ok((await db.query('select count(*)::int n from reservation_events where reservation_id=$1', [id])).rows[0].n >= 4);
});

test('states: competing transitions cannot both consume pending status', async () => {
  const id = await reservation(await date());
  const query = next => ({ text: "select * from transition_reservation_status($1,array['pending'],$2)", values: [id, next] });
  const result = await race(query('confirmed'), query('cancelled'));
  assert.equal(result.winner.rowCount, 1);
  assert.equal(result.result.rowCount, 0);
});

test('access: anon/customer denied, staff can read, service token must match', async () => {
  const id = await reservation(await date());
  for (const role of ['anon', 'authenticated']) {
    await db.query('begin');
    try {
      if (role === 'authenticated') {
        const customer = randomUUID();
        await db.query('insert into auth.users(id) values ($1)', [customer]);
        await db.query('update reservations set customer_id=$1 where id=$2', [customer, id]);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [customer]);
      }
      await db.query(`set local role ${role}`);
      assert.equal((await db.query('select id from reservations where id=$1', [id])).rowCount, 0);
      await assert.rejects(db.query("select * from get_reservation_with_access_token($1,'synthetic-token')", [id]), { code: '42501' });
    } finally { await db.query('rollback'); }
  }
  await db.query('begin');
  try {
    const staff = randomUUID();
    await db.query('insert into auth.users(id) values ($1)', [staff]);
    await db.query("update profiles set role='receptionist' where id=$1", [staff]);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
    await db.query('set local role authenticated');
    assert.equal((await db.query('select id from reservations where id=$1', [id])).rowCount, 1);
  } finally { await db.query('rollback'); }
  await db.query('begin');
  try {
    await db.query('set local role service_role');
    assert.equal((await db.query("select * from get_reservation_with_access_token($1,'wrong')", [id])).rowCount, 0);
    assert.equal((await db.query("select * from get_reservation_with_access_token($1,'synthetic-token')", [id])).rowCount, 1);
    assert.equal((await db.query("select * from cancel_reservation_with_access_token($1,'wrong')", [id])).rowCount, 0);
    assert.equal((await db.query("select * from cancel_reservation_with_access_token($1,'synthetic-token')", [id])).rows[0].status, 'cancelled');
  } finally { await db.query('rollback'); }
});

test('synthetic payment: exact amount, confirmation and idempotent database transition', async () => {
  const id = await reservation(await date());
  await db.query("update reservations set payment_status='pending',payment_amount=100 where id=$1", [id]);
  assert.equal((await db.query('select * from complete_reservation_payment($1,99)', [id])).rowCount, 0);
  const paid = await db.query('select * from complete_reservation_payment($1,100)', [id]);
  assert.equal(paid.rows[0].status, 'confirmed');
  assert.equal(paid.rows[0].payment_status, 'paid');
  assert.equal((await db.query('select * from complete_reservation_payment($1,100)', [id])).rowCount, 0);
});

test('OUT-02: increasing a free reservation to 15 must require a fee', { todo: 'Plano financeiro: rule explicitly deferred by business' }, async () => {
  const id = await reservation(await date(), 14);
  await db.query("select * from update_reservation_with_access_token($1,'synthetic-token',(select reservation_date from reservations where id=$1),'12:00',15)", [id]);
  assert.equal((await db.query('select payment_status from reservations where id=$1', [id])).rows[0].payment_status, 'pending');
});

test('phones: differently formatted equal phones are detected as duplicates', async () => {
  const d = await date();
  await reservation(d, 2, { phone: '00000000000' });
  await assert.rejects(db.query(insertQuery(d, 2, { phone: '(00) 00000-0000' })), /ACTIVE_RESERVATION_EXISTS/);
});
