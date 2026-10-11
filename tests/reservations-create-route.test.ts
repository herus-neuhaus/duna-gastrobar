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
    if (table === 'special_dates') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    if (table === 'reservations') return { insert, select: () => reservationQuery };
    throw new Error(`Unexpected table ${table}`);
  });
  const sessionRpc = vi.fn(async () => options.rpcResult || ({ data: [{ id: 'authorized-id' }], error: null }));
  mocks.createAdminClient.mockReturnValue({ from: adminFrom, rpc: adminRpc });
  mocks.createClient.mockResolvedValue({ rpc: sessionRpc });
  return { insert, adminRpc, adminFrom, sessionRpc };
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

  it('requires a valid CPF for every reservation and accepts an omitted email', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, email: undefined }));

    expect(response.status).toBe(201);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ cpf: '52998224725', email: null });
  });

  it('rejects a reservation without a valid CPF before inserting it', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert } = setup();
    const response = await POST(request({ ...standardBody, cpf: '' }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
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

  it('keeps the public create horizon at today plus ten days', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);
    const { insert, adminRpc } = setup();
    const response = await POST(request({ ...standardBody, date: '2026-09-20' }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
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
