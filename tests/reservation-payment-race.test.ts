import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/supabase/database.types';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), provider: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));
vi.mock('@/lib/pagarme', async () => {
  const { isValidCpf } = await import('@/lib/cpf');
  return { isValidCpf, pagarmeRequest: mocks.provider };
});

import { POST as pix } from '@/app/api/payments/pix/route';
import { POST as webhook } from '@/app/api/pagarme/webhook/route';
import { hashReservationAccessToken } from '@/lib/reservation-access';

const reservationId = '11111111-1111-4111-8111-111111111111';
const accessToken = 'a'.repeat(64);
type Row = Record<string, unknown>;
type Operation = { table: string; method: string; values: Row; url: URL; prefer: string };
let reservation: Row;
let payments: Row[];
let operations: Operation[];
let paymentEvents: number;
let failCompletion: boolean;
let beforeWrite: ((operation: Operation) => Promise<void>) | undefined;
let network: ReturnType<typeof vi.fn>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function order(status = 'paid', amount = 10000) {
  return {
    id: 'or_synthetic', status, amount,
    metadata: { reservation_id: reservationId, purpose: 'reservation_fee' },
    charges: [{ last_transaction: { qr_code: 'synthetic-qr', expires_at: '2026-11-03T13:00:00Z' } }],
  };
}

function pixRequest(token = accessToken) {
  return new Request('http://localhost/api/payments/pix', {
    method: 'POST', body: JSON.stringify({ reservationId, accessToken: token, cpf: '52998224725' }),
  });
}

function webhookRequest(accountId = 'acc_synthetic') {
  return new Request('http://localhost/api/pagarme/webhook', {
    method: 'POST', body: JSON.stringify({ type: 'order.paid', account: { id: accountId }, data: { id: 'or_synthetic' } }),
  });
}

// Exercise the installed Supabase client's HTTP serialization (Prefer, filters,
// RPC arguments), but emulate data in memory. These are NOT PostgreSQL/RLS/lock tests.
async function databaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.origin !== 'https://payment-tests.invalid') throw new Error('Unexpected database destination');
  const method = init?.method || 'GET';
  const headers = new Headers(init?.headers);
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
  if (!isRow(body)) throw new Error('Unexpected request body');
  const table = url.pathname.split('/').at(-1) || '';
  const operation = { table, method, values: body, url, prefer: headers.get('Prefer') || '' };
  operations.push(operation);

  if (table === 'complete_reservation_payment') {
    if (failCompletion) return Response.json({ message: 'Synthetic completion failure', code: 'TEST_FAILURE' }, { status: 500 });
    if (body.p_reservation_id !== reservationId || body.p_payment_amount !== reservation.payment_amount || reservation.payment_status !== 'pending') {
      return Response.json([]);
    }
    reservation.payment_status = 'paid';
    if (reservation.status === 'pending') reservation.status = 'confirmed';
    return Response.json([{ id: reservationId, status: reservation.status, payment_status: reservation.payment_status }]);
  }

  const rows = table === 'reservations' ? [reservation] : table === 'reservation_payments' ? payments : undefined;
  if (!rows) throw new Error(`Unexpected table: ${table}`);
  const matches = (row: Row) => [...url.searchParams].every(([key, filter]) => {
    if (key === 'select') return true;
    if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
    if (filter.startsWith('neq.')) return String(row[key]) !== filter.slice(4);
    if (key === 'on_conflict') return true;
    throw new Error(`Unsupported test filter: ${key}=${filter}`);
  });

  if (method === 'GET') {
    const found = rows.filter(matches);
    return Response.json(headers.get('Accept') === 'application/vnd.pgrst.object+json' ? found[0] : found);
  }
  if (beforeWrite) await beforeWrite(operation);
  if (method === 'POST' && table === 'reservation_payments') {
    const existing = payments.find((row) => row.provider === body.provider && row.provider_order_id === body.provider_order_id);
    if (!existing) {
      payments.push({ ...body }); paymentEvents++;
    } else if (!operation.prefer.includes('resolution=ignore-duplicates')) {
      Object.assign(existing, body); paymentEvents++;
    }
    return new Response(null, { status: 201 });
  }
  if (method === 'PATCH') {
    for (const row of rows.filter(matches)) {
      Object.assign(row, body);
      if (table === 'reservation_payments' && 'status' in body) paymentEvents++;
    }
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unsupported test operation: ${method} ${table}`);
}

describe('PIX and paid webhook monotonic persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
    vi.stubEnv('PAGAR_ME_ID_CONTA', 'acc_synthetic');
    network = vi.fn(() => { throw new Error('Real network is forbidden in payment tests'); });
    vi.stubGlobal('fetch', network);
    mocks.admin.mockReset(); mocks.provider.mockReset();
    payments = []; operations = []; paymentEvents = 0; failCompletion = false; beforeWrite = undefined;
    reservation = {
      id: reservationId, name: 'Synthetic guest', whatsapp: '69912345678', status: 'pending',
      payment_status: 'pending', payment_amount: 100,
      reservation_access_token_hash: hashReservationAccessToken(accessToken),
    };
    mocks.admin.mockReturnValue(createClient<Database>('https://payment-tests.invalid', 'fictional-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: databaseFetch },
    }));
    mocks.provider.mockImplementation(async (path: string) => path === '/orders' ? order('pending') : order());
  });
  afterEach(() => {
    expect(network).not.toHaveBeenCalled();
    vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it('creates PIX with trusted amount, stable key and insert-only conflict resolution', async () => {
    const response = await pix(pixRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ amount: 100, orderId: 'or_synthetic', qrCode: 'synthetic-qr' });
    const [, options] = mocks.provider.mock.calls[0];
    expect(JSON.parse(options.body).items[0].amount).toBe(10000);
    expect(options.headers['Idempotency-Key']).toBe(`reservation-${reservationId}-fee`);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'pending', paid_at: null });
    expect(operations.find((operation) => operation.method === 'POST')?.prefer).toContain('resolution=ignore-duplicates');
    const metadataWrite = operations.find((operation) => operation.method === 'PATCH' && operation.table === 'reservations');
    expect(metadataWrite?.values).not.toHaveProperty('payment_status');
    expect(metadataWrite?.url.searchParams.get('payment_status')).toBe('eq.pending');
  });

  it('does not duplicate pending payment or audit status events on PIX retry', async () => {
    expect((await pix(pixRequest())).status).toBe(200);
    expect((await pix(pixRequest())).status).toBe(200);
    expect(payments).toHaveLength(1); expect(paymentEvents).toBe(1);
  });

  it('rejects wrong token before provider IO or writes', async () => {
    expect((await pix(pixRequest('b'.repeat(64)))).status).toBe(404);
    expect(mocks.provider).not.toHaveBeenCalled(); expect(payments).toHaveLength(0);
  });

  it.each([
    ['not_required', 'pending', 400], ['paid', 'confirmed', 409], ['pending', 'cancelled', 409],
  ])('rejects PIX for payment=%s reservation=%s', async (paymentStatus, status, expected) => {
    Object.assign(reservation, { payment_status: paymentStatus, status });
    expect((await pix(pixRequest())).status).toBe(expected);
    expect(mocks.provider).not.toHaveBeenCalled(); expect(payments).toHaveLength(0);
  });

  it('preserves paid state when webhook arrives during provider IO', async () => {
    mocks.provider.mockImplementation(async (path: string) => {
      if (path === '/orders') {
        expect((await webhook(webhookRequest())).status).toBe(200);
        return order('pending');
      }
      return order();
    });
    expect((await pix(pixRequest())).status).toBe(200);
    expect(reservation).toMatchObject({ status: 'confirmed', payment_status: 'paid' });
    expect(payments[0]).toMatchObject({ status: 'paid', paid_at: '2026-11-03T12:00:00.000Z' });
    expect(paymentEvents).toBe(1);
  });

  it.each(['reservation_payments', 'reservations'])('preserves paid state if webhook arrives just before pending metadata UPDATE on %s', async (table) => {
    let delivered = false;
    beforeWrite = async (operation) => {
      if (!delivered && operation.table === table && operation.method === 'PATCH' && !('status' in operation.values)) {
        delivered = true;
        expect((await webhook(webhookRequest())).status).toBe(200);
      }
    };
    expect((await pix(pixRequest())).status).toBe(200);
    expect(delivered).toBe(true);
    expect(reservation.payment_status).toBe('paid');
    expect(payments[0].status).toBe('paid');
    expect(payments[0].paid_at).not.toBeNull();
  });

  it('confirms provider response already paid even without a QR code', async () => {
    mocks.provider.mockResolvedValue({ ...order(), charges: [] });
    const response = await pix(pixRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Esta reserva já está paga.' });
    expect(reservation).toMatchObject({ status: 'confirmed', payment_status: 'paid' });
    expect(payments[0].status).toBe('paid');
  });

  it('acknowledges duplicate webhook without changing paid_at or adding audit events', async () => {
    expect((await pix(pixRequest())).status).toBe(200);
    expect((await webhook(webhookRequest())).status).toBe(200);
    const paidAt = payments[0].paid_at;
    const events = paymentEvents;
    vi.setSystemTime(new Date('2026-11-03T12:10:00Z'));
    const response = await webhook(webhookRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(payments).toHaveLength(1); expect(payments[0].paid_at).toBe(paidAt);
    expect(paymentEvents).toBe(events);
  });

  it('handles concurrent paid deliveries without duplicate rows or status events', async () => {
    const responses = await Promise.all([webhook(webhookRequest()), webhook(webhookRequest())]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(payments).toHaveLength(1); expect(paymentEvents).toBe(1);
    expect(reservation.payment_status).toBe('paid');
  });

  it('recovers completion failure on retry without rewriting the paid row', async () => {
    failCompletion = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await webhook(webhookRequest())).status).toBe(500);
      expect(payments[0].status).toBe('paid');
      expect(reservation.payment_status).toBe('pending');
      const paidAt = payments[0].paid_at;
      failCompletion = false;
      vi.setSystemTime(new Date('2026-11-03T12:10:00Z'));
      expect((await webhook(webhookRequest())).status).toBe(200);
      expect(reservation.payment_status).toBe('paid');
      expect(payments[0].paid_at).toBe(paidAt); expect(paymentEvents).toBe(1);
    } finally { log.mockRestore(); }
  });

  it('does not downgrade a paid row when PIX arrives after partial webhook failure', async () => {
    failCompletion = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await webhook(webhookRequest())).status).toBe(500);
      expect((await pix(pixRequest())).status).toBe(200);
      expect(payments[0].status).toBe('paid'); expect(payments[0].paid_at).not.toBeNull();
      failCompletion = false;
      expect((await webhook(webhookRequest())).status).toBe(200);
      expect(reservation.payment_status).toBe('paid');
    } finally { log.mockRestore(); }
  });

  it('recovers paid provider response after a completion failure on PIX retry', async () => {
    mocks.provider.mockResolvedValue(order());
    failCompletion = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await pix(pixRequest())).status).toBe(500);
      expect(payments[0].status).toBe('paid');
      expect(reservation.payment_status).toBe('pending');
      failCompletion = false;
      expect((await pix(pixRequest())).status).toBe(409);
      expect(reservation.payment_status).toBe('paid');
      expect(paymentEvents).toBe(1);
    } finally { log.mockRestore(); }
  });

  it.each([
    { reservation_id: '22222222-2222-4222-8222-222222222222', amount: 100 },
    { reservation_id: reservationId, amount: 99 },
  ])('rejects conflicting persisted order without reassignment or confirmation: %j', async (existing) => {
    payments.push({ ...existing, provider: 'pagarme', provider_order_id: 'or_synthetic', status: 'pending' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await webhook(webhookRequest())).status).toBe(500);
      expect(payments[0]).toMatchObject({ ...existing, status: 'pending' });
      expect(reservation.payment_status).toBe('pending');
      expect(paymentEvents).toBe(0);
    } finally { log.mockRestore(); }
  });

  it('records late payment without reactivating a cancelled reservation', async () => {
    reservation.status = 'cancelled';
    expect((await webhook(webhookRequest())).status).toBe(200);
    expect(reservation).toMatchObject({ status: 'cancelled', payment_status: 'paid' });
    expect((await webhook(webhookRequest())).status).toBe(200);
    expect(reservation.status).toBe('cancelled');
  });

  it('does not treat a different order as a duplicate for an already-paid reservation', async () => {
    expect((await webhook(webhookRequest())).status).toBe(200);
    mocks.provider.mockResolvedValue({ ...order(), id: 'or_other' });
    expect((await webhook(webhookRequest())).status).toBe(400);
    expect(payments).toHaveLength(1); expect(paymentEvents).toBe(1);
  });

  it.each([
    { ...order(), amount: 9900 },
    { ...order(), status: 'pending' },
    { ...order(), metadata: { reservation_id: reservationId, purpose: 'unrelated' } },
  ])('rejects invalid paid webhook before writes: %j', async (providerOrder) => {
    mocks.provider.mockResolvedValue(providerOrder);
    expect((await webhook(webhookRequest())).status).toBe(400);
    expect(payments).toHaveLength(0); expect(reservation.payment_status).toBe('pending');
  });

  it('checks account before provider IO', async () => {
    expect((await webhook(webhookRequest('acc_other'))).status).toBe(403);
    expect(mocks.provider).not.toHaveBeenCalled(); expect(payments).toHaveLength(0);
  });

  it('does not confirm a provider response with mismatched amount from PIX creation', async () => {
    mocks.provider.mockResolvedValue(order('paid', 9900));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await pix(pixRequest())).status).toBe(500);
      expect(payments).toHaveLength(0); expect(reservation.payment_status).toBe('pending');
    } finally { log.mockRestore(); }
  });
});
