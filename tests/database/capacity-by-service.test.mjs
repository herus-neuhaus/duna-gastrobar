import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const config = { host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 };
const db = new pg.Client(config);
const reservationIds = [];
const dates = [];
const userIds = [];
const areaId = randomUUID();
const tableIds = [randomUUID(), randomUUID()];
const decorationId = randomUUID();
let day = 800;

before(async () => {
  await db.connect();
  await db.query('insert into restaurant_areas(id,name) values ($1,$2)', [areaId, `Capacity test ${areaId}`]);
  for (const [index, tableId] of tableIds.entries()) {
    await db.query('insert into restaurant_tables(id,area_id,code,min_capacity,max_capacity) values ($1,$2,$3,1,30)', [tableId, areaId, `C-${tableId.slice(0, 8)}-${index}`]);
  }
  await db.query('insert into decorations(id,name,image_path,image_url) values ($1,$2,$3,$4)', [decorationId, 'Capacity audit decoration', decorationId, 'https://example.invalid/capacity']);
});

after(async () => {
  try {
    await db.query('delete from reservation_table_assignments where reservation_id = any($1::uuid[])', [reservationIds]);
    await db.query('delete from reservations where id = any($1::uuid[])', [reservationIds]);
    await db.query('delete from reservation_schedule_date_slots where reservation_date = any($1::date[])', [dates]);
    await db.query('delete from decorations where id=$1', [decorationId]);
    await db.query('delete from restaurant_tables where id = any($1::uuid[])', [tableIds]);
    await db.query('delete from restaurant_areas where id=$1', [areaId]);
    await db.query('delete from auth.users where id = any($1::uuid[])', [userIds]);
  } finally { await db.end(); }
});

async function date({ twoLunchSlots = false } = {}) {
  const value = (await db.query('select (current_date + $1::int)::text d', [day++])).rows[0].d;
  dates.push(value);
  await db.query(
    `insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at,commercial_turn)
     values ($1,'12:00','12:30','lunch'),($1,$2,$3,'lunch'),($1,'18:00','21:00','dinner')`,
    [value, twoLunchSlots ? '13:00' : '12:30', twoLunchSlots ? '13:30' : '13:30'],
  );
  return value;
}

async function reservation(d, guests, options = {}) {
  const id = randomUUID();
  reservationIds.push(id);
  await db.query(
    `insert into reservations(id,name,email,whatsapp,reservation_date,reservation_time,num_guests,status,source,decoration_id)
     values ($1,'Capacity test','capacity@example.invalid',$2,$3,$4,$5,$6,'website',$7)`,
    [id, options.phone || id, d, options.time || '12:00', guests, options.status || 'pending', options.decorationId || null],
  );
  return id;
}

async function user(role) {
  const id = randomUUID();
  userIds.push(id);
  await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${id}@example.invalid`]);
  // This fixture represents the separately approved initial-owner designation;
  // bypass only local fixture triggers, never application role management.
  await db.query("set session_replication_role = 'replica'");
  await db.query('update profiles set role=$2, force_password_change=false where id=$1', [id, role]);
  await db.query("set session_replication_role = 'origin'");
  return id;
}

async function actor(actorId, callback) {
  await db.query('savepoint actor_scope');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId]);
    await db.query('set local role authenticated');
    const value = await callback();
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    await db.query("select set_config('app.reservation_capacity_override_use_id','',true)");
    await db.query("select set_config('app.reservation_schedule_override','',true)");
    await db.query('reset role');
    await db.query('release savepoint actor_scope');
    return value;
  } catch (error) {
    await db.query('rollback to savepoint actor_scope');
    await db.query('release savepoint actor_scope');
    throw error;
  }
}

async function inTransaction(callback) {
  await db.query('begin');
  try { return await callback(); }
  finally { await db.query('rollback'); }
}

async function expectSqlReject(query, matcher) {
  await db.query('savepoint expected_rejection');
  await assert.rejects(query(), matcher);
  await db.query('rollback to savepoint expected_rejection');
  await db.query('release savepoint expected_rejection');
}

async function reservationAsOwner(ownerId, d, options = {}) {
  return actor(ownerId, async () => {
    const { rows } = await db.query(
      `select * from create_reservation_with_authorized_overrides(
       'Authorized capacity','authorized@example.invalid',$1,$2,$3,$4,null,null,$5,null,
       'not_required',0,'synthetic-token',$6,$7,$8)`,
      [options.phone || randomUUID(), d, options.time || '12:00', options.guests || 2,
        options.decorationId || null, options.capacityReason || null,
        options.scheduleReason || null, options.commercialTurn || null],
    );
    reservationIds.push(rows[0].id);
    return rows[0].id;
  });
}

test('capacity: completed and no_show count; only cancellation releases, and walk-ins are excluded', async () => {
  const d = await date();
  await reservation(d, 80, { status: 'completed' });
  await assert.rejects(reservation(d, 1), /CAPACITY_EXCEEDED/);
  const dinner = await reservation(d, 80, { time: '18:00', status: 'no_show' });
  await assert.rejects(reservation(d, 1, { time: '18:00' }), /CAPACITY_EXCEEDED/);
  await db.query("update reservations set status='cancelled' where id=$1", [dinner]);
  await reservation(d, 1, { time: '18:00' });

  const walkInDate = await date();
  const today = (await db.query("select timezone('America/Porto_Velho',now())::date::text d")).rows[0].d;
  dates.push(today);
  await db.query("insert into reservation_schedule_date_slots(reservation_date,starts_at,ends_at,commercial_turn) values ($1,'12:00','13:30','lunch'),($1,'18:00','21:00','dinner')", [today]);
  const receptionist = await user('receptionist');
  await db.query('begin');
  try {
    const walkIns = await actor(receptionist, async () => {
      const ids = [];
      for (const [index, partySize] of [30, 30, 20].entries()) {
        const result = await db.query(
          "select * from create_walk_in_reservation('Walk in','walkin@example.invalid',$1,$2,'12:00',$3,null)",
          [`6991234567${index}`, today, partySize],
        );
        ids.push(result.rows[0].id);
      }
      return ids;
    });
    reservationIds.push(...walkIns);
    await db.query('commit');
    for (const walkIn of walkIns) await db.query('update reservations set reservation_date=$2 where id=$1', [walkIn, walkInDate]);
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
  await reservation(walkInDate, 80);
});

test('turn identity: multiple lunch slots share a quota; schedule edits retain historical commercial identity', async () => {
  const d = await date({ twoLunchSlots: true });
  const id = await reservation(d, 80, { time: '12:00' });
  await assert.rejects(reservation(d, 1, { time: '13:00' }), /CAPACITY_EXCEEDED/);
  const before = await db.query('select commercial_turn from reservations where id=$1', [id]);
  assert.equal(before.rows[0].commercial_turn, 'lunch');
  await db.query("update reservation_schedule_date_slots set starts_at='11:00',ends_at='12:30' where reservation_date=$1 and starts_at='12:00'", [d]);
  const after = await db.query('select commercial_turn from reservations where id=$1', [id]);
  assert.equal(after.rows[0].commercial_turn, 'lunch');
  const capacity = await db.query('select * from get_reservation_capacity_availability($1,$1) where reservation_time in (\'11:00\',\'13:00\')', [d]);
  assert.ok(capacity.rows.every((slot) => slot.commercial_turn === 'lunch' && slot.occupied_guests === 80));
});

test('capacity permissions: owner grant/revoke, explicit delegated uses, actor audit and revocation', async () => {
  const d = await date();
  await reservation(d, 80);
  const ownerId = await user('dono');
  const adminId = await user('admin');
  const delegateId = await user('receptionist');

  await inTransaction(async () => {
    await assert.rejects(actor(ownerId, () => db.query('select * from set_reservation_capacity_permission($1,true,$2)', [ownerId, 'Self assignment'])), /CAPACITY_PERMISSION_SELF_ASSIGNMENT_FORBIDDEN/);
    await assert.rejects(actor(adminId, () => db.query('select * from set_reservation_capacity_permission($1,true,$2)', [delegateId, 'Admin cannot grant'])), /OWNER_REQUIRED/);
    await assert.rejects(actor(adminId, () => db.query(
      `select * from create_reservation_with_authorized_overrides('Admin denied','denied@example.invalid','69900000001',$1,'12:00',10,null,null,null,null,'not_required',0,'token','No grant',null,null)`, [d]),
    ), /CAPACITY_OVERRIDE_NOT_AUTHORIZED/);

    await actor(ownerId, () => db.query('select * from set_reservation_capacity_permission($1,true,$2)', [delegateId, 'Cobertura da operação']));
    const authorizedId = await reservationAsOwner(delegateId, d, { guests: 10, capacityReason: 'Grupo aprovado pelo dono' });
    const firstUsage = await db.query('select actor_id,reason,operation,occupied_before,occupied_after,next_commercial_turn from reservation_capacity_override_uses where reservation_id=$1', [authorizedId]);
    assert.deepEqual(firstUsage.rows[0], {
      actor_id: delegateId, reason: 'Grupo aprovado pelo dono', operation: 'create',
      occupied_before: 80, occupied_after: 90, next_commercial_turn: 'lunch',
    });

    // A capacity exception is not a schedule exception.
    await assert.rejects(actor(delegateId, () => db.query(
      `select * from create_reservation_with_authorized_overrides('Schedule denied','schedule@example.invalid','69900000002',$1,'15:00',1,null,null,null,null,'not_required',0,'token',null,'Horario', 'dinner')`, [d]),
    ), /SCHEDULE_OVERRIDE_NOT_AUTHORIZED/);
    const scheduleId = await actor(adminId, async () => {
      const result = await db.query(
        `select * from create_reservation_with_authorized_overrides('Admin schedule','schedule@example.invalid','69900000003',$1,'15:00',1,null,null,null,null,'not_required',0,'token',null,'Evento operacional','dinner')`, [d],
      );
      reservationIds.push(result.rows[0].id);
      return result.rows[0].id;
    });
    assert.equal((await db.query("select count(*)::int n from reservation_override_audits where reservation_id=$1 and override_type='schedule'", [scheduleId])).rows[0].n, 1);

    // In a 90-person turn, reductions and state-only transitions do not consume new capacity.
    const reduced = await db.query('update reservations set num_guests=8 where id=$1 returning num_guests', [authorizedId]);
    assert.equal(reduced.rows[0].num_guests, 8);
    await db.query("update reservations set status='confirmed' where id=$1", [authorizedId]);
    await db.query("update reservations set status='seated' where id=$1", [authorizedId]);
    await expectSqlReject(() => db.query('update reservations set num_guests=10 where id=$1', [authorizedId]), /CAPACITY_(EXCEEDED|OVERRIDE_USE_REQUIRED)/);

    await actor(delegateId, () => db.query(
      'select * from update_reservation_with_capacity_override($1,$2,\'12:00\',10,$3)',
      [authorizedId, d, 'Novo aumento autorizado'],
    ));
    assert.equal((await db.query('select count(*)::int n from reservation_capacity_override_uses where reservation_id=$1', [authorizedId])).rows[0].n, 2);
    await expectSqlReject(() => db.query('update reservation_capacity_override_uses set reason=\'forged\' where reservation_id=$1', [authorizedId]), /CAPACITY_AUDIT_IMMUTABLE/);

    await actor(ownerId, () => db.query('select * from set_reservation_capacity_permission($1,false,$2)', [delegateId, 'Fim da autorização temporária']));
    await assert.rejects(actor(delegateId, () => db.query(
      'select * from update_reservation_with_capacity_override($1,$2,\'12:00\',12,$3)',
      [authorizedId, d, 'Tentativa após revogação'],
    )), /CAPACITY_OVERRIDE_NOT_AUTHORIZED/);
    await db.query("update reservations set status='no_show' where id=$1", [authorizedId]);
    const permissionAudit = await db.query("select action,reason,actor_id from reservation_capacity_permission_audits where profile_id=$1 order by created_at", [delegateId]);
    assert.deepEqual(permissionAudit.rows.map((row) => row.action), ['granted', 'revoked']);
    assert.ok(permissionAudit.rows.every((row) => row.actor_id === ownerId));
  });
});

test('database boundary: authenticated admin cannot forge source, turn or override metadata', async () => {
  const d = await date();
  const adminId = await user('admin');
  const targetId = await user('receptionist');
  const existing = await reservation(d, 2);
  await inTransaction(async () => {
    await assert.rejects(actor(adminId, () => db.query(
      `insert into reservations(name,email,whatsapp,reservation_date,reservation_time,num_guests,source,commercial_turn,capacity_override_reason,capacity_override_authorized_by,capacity_override_authorized_at)
       values ('Forge','forge@example.invalid','69911111111',$1,'12:00',1,'walk_in','dinner','fake', $2, now())`, [d, adminId],
    )), /permission denied for table reservations/);
    await assert.rejects(actor(adminId, () => db.query("update reservations set source='walk_in',commercial_turn='dinner' where id=$1", [existing])), /permission denied for table reservations/);
    await assert.rejects(actor(adminId, () => db.query('select * from set_reservation_capacity_permission($1,true,$2)', [adminId, 'Self grant'])), /OWNER_REQUIRED/);
    await assert.rejects(actor(adminId, () => db.query("update profiles set role='dono' where id=$1", [targetId])), /OWNER_ROLE_CHANGE_REQUIRES_APPROVED_PROCEDURE/);
  });
  await db.query('begin');
  try {
    await db.query('set local role service_role');
    await db.query('savepoint forged_walkin');
    await assert.rejects(db.query(
      `insert into reservations(name,email,whatsapp,reservation_date,reservation_time,num_guests,source)
       values ('Forged walkin','forge@example.invalid','69911111112',$1,'12:00',1,'walk_in')`, [d],
    ), /WALK_IN_SOURCE_FORBIDDEN/);
    await db.query('rollback to savepoint forged_walkin');
    await db.query('savepoint forged_turn');
    await assert.rejects(db.query('update reservations set commercial_turn=\'dinner\' where id=$1', [existing]), /RESERVATION_TURN_IMMUTABLE/);
    await db.query('rollback to savepoint forged_turn');
  } finally { await db.query('rollback'); }
});

test('historical turn classification is owner-only and does not infer ambiguous records', async () => {
  const d = await date();
  const id = await reservation(d, 2);
  await db.query("set session_replication_role = 'replica'");
  await db.query('update reservations set service_starts_at=null,commercial_turn=null where id=$1', [id]);
  await db.query("set session_replication_role = 'origin'");
  assert.equal((await db.query('select count(*)::int n from reservation_turn_classification_issues where id=$1', [id])).rows[0].n, 1);
  await assert.rejects(reservation(d, 2, { time: '18:00' }), /RESERVATION_TURN_CLASSIFICATION_REQUIRED/);

  const ownerId = await user('dono');
  await db.query('begin');
  try {
    await actor(ownerId, async () => {
      const result = await db.query("select * from classify_reservation_commercial_turn($1,'lunch','Verificado em registro operacional')", [id]);
      assert.equal(result.rows[0].commercial_turn, 'lunch');
    });
    assert.equal((await db.query('select commercial_turn from reservations where id=$1', [id])).rows[0].commercial_turn, 'lunch');
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
});

test('decoration exclusivity remains enforced when the owner authorizes excess capacity', async () => {
  const d = await date();
  const ownerId = await user('dono');
  await reservation(d, 80, { decorationId });
  await inTransaction(async () => {
    await assert.rejects(reservationAsOwner(ownerId, d, { guests: 5, capacityReason: 'Exceção', decorationId }), { code: '23505' });
  });
});

test('admin schedule exception remains separate and preserves an allocated table window', async () => {
  const d = await date();
  const id = await reservation(d, 2);
  await db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [id, [tableIds[0]]]);
  const adminId = await user('admin');
  await inTransaction(async () => {
    await actor(adminId, () => db.query(
      `select * from update_reservation_with_authorized_overrides($1,$2,'15:00',2,null,'Reunião operacional','dinner')`,
      [id, d],
    ));
    const row = (await db.query("select to_char(starts_at at time zone 'America/Porto_Velho','HH24:MI') starts from reservation_table_assignments where reservation_id=$1 and released_at is null", [id])).rows[0];
    assert.equal(row.starts, '15:00');
    assert.equal((await db.query('select count(*)::int n from reservation_capacity_override_uses where reservation_id=$1', [id])).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from reservation_override_audits where reservation_id=$1 and override_type='schedule'", [id])).rows[0].n, 1);
  });
});

test('concurrent turn moves serialize capacity and preserve the losing table window', async () => {
  const targetDate = await date();
  const sourceOne = await date();
  const sourceTwo = await date();
  await reservation(targetDate, 70, { time: '18:00' });
  const firstId = await reservation(sourceOne, 10);
  const secondId = await reservation(sourceTwo, 10);
  await db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [firstId, [tableIds[0]]]);
  await db.query('select * from replace_reservation_table_assignments($1,$2::uuid[])', [secondId, [tableIds[1]]]);

  const first = new pg.Client(config);
  const second = new pg.Client(config);
  await Promise.all([first.connect(), second.connect()]);
  try {
    await Promise.all([first.query('begin'), second.query('begin')]);
    const firstPid = (await first.query('select pg_backend_pid() pid')).rows[0].pid;
    const secondPid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
    const moved = await first.query("update reservations set reservation_date=$2,reservation_time='18:00' where id=$1", [firstId, targetDate]);
    const pending = second.query("update reservations set reservation_date=$2,reservation_time='18:00' where id=$1", [secondId, targetDate]).then((result) => ({ result }), (error) => ({ error }));
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await db.query('select $1::int=any(pg_blocking_pids($2)) blocked', [firstPid, secondPid])).rows[0].blocked) { blocked = true; break; }
      await delay(20);
    }
    assert.ok(blocked);
    await first.query('commit');
    const loser = await pending;
    await second.query(loser.error ? 'rollback' : 'commit');
    assert.equal(moved.rowCount, 1);
    assert.match(loser.error?.message || '', /CAPACITY_EXCEEDED/);
    assert.equal((await db.query('select reservation_date::text from reservations where id=$1', [secondId])).rows[0].reservation_date, sourceTwo);
    assert.equal((await db.query('select starts_at::date::text from reservation_table_assignments where reservation_id=$1 and released_at is null', [secondId])).rows[0].starts_at, sourceTwo);
  } finally {
    await Promise.all([first.end(), second.end()]);
  }
});
