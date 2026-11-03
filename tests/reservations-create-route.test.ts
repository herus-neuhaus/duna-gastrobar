import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  isPanelStaff: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/auth', () => ({ isPanelStaff: mocks.isPanelStaff }));

import { POST } from '@/app/api/reservations/route';

const standardBody = {
  name: 'Synthetic guest',
  email: 'guest@example.invalid',
  whatsapp: '69912345678',
  cpf: '52998224725',
  date: '2026-09-10',
  time: '18:00',
  guests: 2,
};

function setup(options: {
  rpcResult?: unknown;
  insertResult?: unknown;
  requestedTurn?: string | null;
  specialDates?: Array<{ id: string; date: string; included_guests: number | null; requires_fee: boolean; fee_amount: number | null }>;
  matchingReservations?: Array<{ commercial_turn: string | null; reservation_time: string; num_guests: number; status: string }>;
} = {}) {
  const insert = vi.fn((_payload: unknown) => ({ select: vi.fn(() => ({ single: vi.fn(async () => options.insertResult || ({ data: { id: 'reservation-id' }, error: null })) })) }));
  const adminRpc = vi.fn(async (functionName: string) => functionName === 'get_reservation_commercial_turn'
    ? ({ data: options.requestedTurn ?? 'dinner', error: null })
    : ({ data: true, error: null }));
  const reservationQuery = {
    eq: vi.fn(),
    limit: vi.fn(async () => ({ data: options.matchingReservations || [], error: null })),
  };
  reservationQuery.eq.mockReturnValue(reservationQuery);
  const adminFrom = vi.fn((table: string) => {
    if (table === 'blocked_dates') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    if (table === 'special_dates') return { select: () => ({ eq: async () => ({ data: options.specialDates || [], error: null }) }) };
    if (table === 'reservations') return { insert, select: () => reservationQuery };
    throw new Error(`Unexpected table ${table}`);
  });
  const sessionRpc = vi.fn(async () => options.rpcResult || ({ data: [{ id: 'authorized-id' }], error: null }));
  mocks.createAdminClient.mockReturnValue({ from: adminFrom, rpc: adminRpc });
  mocks.createClient.mockResolvedValue({ rpc: sessionRpc });
  return { insert, adminRpc, adminFrom, sessionRpc, reservationQuery };
}

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/reservations capacity controls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    mocks.createAdminClient.mockReset();
    mocks.createClient.mockReset();
    mocks.isPanelStaff.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('ignores client-supplied source, turn and authorization actor metadata', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, source: 'walk_in', commercialTurn: 'dinner', capacityOverrideAuthorizedBy: 'forged-owner' }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledOnce();
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('source');
    expect(payload).not.toHaveProperty('commercial_turn');
    expect(payload).not.toHaveProperty('capacity_override_authorized_by');
  });

  it('accepts 14 guests without CPF or email and does not search an empty CPF', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert, reservationQuery } = setup();
    const response = await POST(request({ ...standardBody, guests: 14, cpf: undefined, email: undefined }));

    expect(response.status).toBe(201);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ cpf: null, email: null, payment_status: 'not_required', payment_amount: 0 });
    expect(reservationQuery.eq).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ paymentRequired: false, paymentAmount: 0 });
  });

  it('rejects 15 guests without CPF even when the client claims no payment is needed', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, guests: 15, cpf: '', paymentRequired: false, paymentAmount: 0 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_CPF_REQUIRED' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid CPF when one is supplied', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, cpf: '00000000000' }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([15, 30])('requires payment for %i guests with a valid CPF and email', async (guests) => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, guests, email: ' Guest@Example.Invalid ' }));
    expect(response.status).toBe(201);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ payment_status: 'pending', payment_amount: 100, num_guests: guests, email: 'guest@example.invalid' });
    expect(await response.json()).toMatchObject({ paymentRequired: true, paymentAmount: 100 });
  });

  it.each([undefined, '', `${'x'.repeat(49)}@example.invalid`])('rejects paid creation without provider-compatible email: %s', async (email) => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, guests: 15, email, paymentRequired: false }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_EMAIL_REQUIRED' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('requires email for a paid event with fewer than 15 guests', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({ specialDates: [{ id: 'event', date: standardBody.date, included_guests: 2, requires_fee: true, fee_amount: 75 }] });
    const response = await POST(request({ ...standardBody, email: '', specialDateId: 'event' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_EMAIL_REQUIRED' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('requires CPF for a paid special date even for two guests', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({ specialDates: [{ id: 'synthetic-event', date: standardBody.date, included_guests: 2, requires_fee: true, fee_amount: 75 }] });
    const response = await POST(request({ ...standardBody, cpf: undefined, specialDateId: 'synthetic-event' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_CPF_REQUIRED' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('uses the special-date price without adding the group fee', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({ specialDates: [{ id: 'synthetic-event', date: standardBody.date, included_guests: 20, requires_fee: true, fee_amount: 75 }] });
    const response = await POST(request({ ...standardBody, specialDateId: 'synthetic-event', guests: 2, paymentAmount: 1 }));
    expect(response.status).toBe(201);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ num_guests: 20, payment_status: 'pending', payment_amount: 75 });
    expect(await response.json()).toMatchObject({ paymentRequired: true, paymentAmount: 75 });
  });

  it('requires CPF based on the effective number of guests in the event', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({ specialDates: [{ id: 'synthetic-event', date: standardBody.date, included_guests: 15, requires_fee: false, fee_amount: null }] });
    const response = await POST(request({ ...standardBody, cpf: undefined, specialDateId: 'synthetic-event' }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('allows a free special date below 15 guests without CPF', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({ specialDates: [{ id: 'synthetic-event', date: standardBody.date, included_guests: 4, requires_fee: false, fee_amount: null }] });
    const response = await POST(request({ ...standardBody, cpf: undefined, email: undefined, specialDateId: 'synthetic-event' }));
    expect(response.status).toBe(201);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ cpf: null, email: null, num_guests: 4, payment_status: 'not_required' });
  });

  it('returns a WhatsApp-choice conflict for an active reservation with the same CPF and turn', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert, adminRpc } = setup({
      matchingReservations: [{ commercial_turn: 'dinner', reservation_time: '18:00:00', num_guests: 4, status: 'confirmed' }],
    });

    const response = await POST(request(standardBody));
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result).toEqual({
      code: 'ACTIVE_CPF_RESERVATION_EXISTS',
      existingReservation: { time: '18:00:00', guests: 4, turn: 'dinner' },
    });
    expect(JSON.stringify(result)).not.toContain(standardBody.cpf);
    expect(adminRpc).toHaveBeenCalledWith('get_reservation_commercial_turn', { p_reservation_date: standardBody.date, p_reservation_time: standardBody.time });
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not consider a reservation from the other commercial turn a duplicate', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup({
      matchingReservations: [{ commercial_turn: 'lunch', reservation_time: '12:00:00', num_guests: 4, status: 'confirmed' }],
    });

    const response = await POST(request(standardBody));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledOnce();
  });

  it('does not allow public callers to claim a capacity exception', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { sessionRpc, insert } = setup();
    const response = await POST(request({ ...standardBody, capacityOverrideReason: 'Forged exception' }));
    expect(response.status).toBe(403);
    expect(sessionRpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(['2026-09-09', '2026-11-08'])('accepts the public horizon boundary %s', async (date) => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, date }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reservation_date: date }));
  });

  it.each(['2026-09-08', '2026-11-09'])('rejects a public reservation outside today through day +60: %s', async (date) => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert, adminRpc } = setup();
    const response = await POST(request({ ...standardBody, date }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('preserves the extended creation horizon for panel staff', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const { insert } = setup();
    expect((await POST(request({ ...standardBody, date: '2026-11-09' }))).status).toBe(201);
    expect(insert).toHaveBeenCalledOnce();
  });

  it('reports the two-hour minimum when the database rejects the lead time', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    setup({ insertResult: { data: null, error: { message: 'RESERVATION_LEAD_TIME_NOT_MET' } } });
    const response = await POST(request(standardBody));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'A reserva precisa ser feita com pelo menos 2 horas de antecedência.' });
  });

  it.each([['2027-03-01', 201], ['2027-03-02', 400]] as const)('uses Porto Velho today and the year-crossing horizon: %s', async (date, status) => {
    vi.setSystemTime(new Date('2027-01-01T02:00:00Z'));
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    expect((await POST(request({ ...standardBody, date }))).status).toBe(status);
    expect(insert).toHaveBeenCalledTimes(status === 201 ? 1 : 0);
  });

  it('revalidates delegated capacity permission in the database', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const { sessionRpc, insert } = setup({ rpcResult: { data: null, error: { message: 'CAPACITY_OVERRIDE_NOT_AUTHORIZED' } } });
    const response = await POST(request({ ...standardBody, capacityOverrideReason: 'Explicit approved request' }));
    expect(response.status).toBe(403);
    expect(sessionRpc).toHaveBeenCalledWith('create_reservation_with_authorized_overrides', expect.objectContaining({ p_capacity_override_reason: 'Explicit approved request' }));
    expect(insert).not.toHaveBeenCalled();
  });

  it('uses an independent schedule exception and commercial turn for admin creation', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const { sessionRpc, adminRpc } = setup();
    const response = await POST(request({ ...standardBody, time: '15:00', scheduleOverrideReason: 'Evento aprovado', commercialTurn: 'dinner' }));
    expect(response.status).toBe(201);
    expect(adminRpc).not.toHaveBeenCalledWith('reservation_time_is_available', expect.anything());
    expect(sessionRpc).toHaveBeenCalledWith('create_reservation_with_authorized_overrides', expect.objectContaining({
      p_capacity_override_reason: null,
      p_schedule_override_reason: 'Evento aprovado',
      p_commercial_turn: 'dinner',
    }));
  });
});
