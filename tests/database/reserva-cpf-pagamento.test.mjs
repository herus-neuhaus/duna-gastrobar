import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Alvo fixo e descartável; não lê .env nem aceita URL. DDL e fixtures são
// revertidos por teste, sem alterar o histórico de migrations do banco local.
const db = new pg.Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres', statement_timeout: 10000 });
const migration = readFileSync(new URL('../../supabase/migrations/20261029234421_cpf_apenas_reservas_com_pagamento.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, '');

before(async () => {
  const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
  await db.connect();
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  assert.equal((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='20260901000000'")).rows[0].n, 1);
  assert.equal((await db.query("select to_regprocedure('public.require_reservation_cpf_for_bookings()') is not null present")).rows[0].present, true);
});
after(async () => { await db.end(); });

async function transaction(callback) {
  await db.query('begin');
  try {
    await db.query(migration);
    const slot = (await db.query('select reservation_date::text, reservation_time::text from get_reservation_available_times(current_date + 365, current_date + 400) limit 1')).rows[0];
    assert.ok(slot, 'O banco isolado deve possuir uma janela sintética futura disponível.');
    await callback(slot);
  } finally { await db.query('rollback'); }
}

function insert(slot, { guests = 14, cpf = null, amount = 0, paymentStatus = 'not_required', specialDateId = null } = {}) {
  const id = randomUUID();
  return db.query(`insert into reservations(id,name,whatsapp,reservation_date,reservation_time,num_guests,cpf,payment_amount,payment_status,special_date_id)
    values($1::uuid,'Cliente sintético',$1::text,$2,$3,$4,$5,$6,$7,$8) returning id,cpf`,
  [id, slot.reservation_date, slot.reservation_time, guests, cpf, amount, paymentStatus, specialDateId]);
}

test('CPF: 14 pessoas sem pagamento podem ser persistidas sem documento', () => transaction(async (slot) => {
  const result = await insert(slot);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].cpf, null);
}));

test('CPF: 15 pessoas exigem documento mesmo com estado financeiro forjado como gratuito', () => transaction(async (slot) => {
  await assert.rejects(insert(slot, { guests: 15 }), /RESERVATION_CPF_REQUIRED/);
}));

test('CPF: qualquer valor de pagamento exige documento mesmo abaixo de 15 pessoas', () => transaction(async (slot) => {
  await assert.rejects(insert(slot, { guests: 2, amount: 75 }), /RESERVATION_CPF_REQUIRED/);
}));

test('CPF: estado de pagamento pendente exige documento mesmo com valor zero', () => transaction(async (slot) => {
  await assert.rejects(insert(slot, { guests: 2, paymentStatus: 'pending' }), /RESERVATION_CPF_REQUIRED/);
}));

test('CPF: evento pago exige documento sem depender do valor informado na reserva', () => transaction(async (slot) => {
  const event = randomUUID();
  await db.query("insert into special_dates(id,date,description,requires_fee,fee_amount,included_guests) values($1,$2,'Evento sintético',true,75,2)", [event, slot.reservation_date]);
  await assert.rejects(insert(slot, { guests: 2, specialDateId: event }), /RESERVATION_CPF_REQUIRED/);
}));

test('CPF: reserva paga com documento preserva a criação', () => transaction(async (slot) => {
  assert.equal((await insert(slot, { guests: 15, cpf: '52998224725', amount: 100, paymentStatus: 'pending' })).rowCount, 1);
}));

test('CPF: migration não concede execução pública à função de trigger', () => transaction(async () => {
  const { rows } = await db.query("select has_function_privilege('anon','public.require_reservation_cpf_for_bookings()','execute') anon, has_function_privilege('authenticated','public.require_reservation_cpf_for_bookings()','execute') authenticated");
  assert.equal(rows[0].anon, false);
  assert.equal(rows[0].authenticated, false);
}));
