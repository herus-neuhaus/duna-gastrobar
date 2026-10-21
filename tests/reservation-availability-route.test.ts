import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from '@/app/api/reservations/availability/route';

function dateQuery(data: unknown[]) {
  return { select: vi.fn(() => ({ gte: vi.fn(() => ({ lte: vi.fn(async () => ({ data, error: null })) })) })) };
}

describe('GET /api/reservations/availability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    mocks.createAdminClient.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('rejects invalid periods without querying Supabase', async () => {
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=invalid'));
    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('shares totals across same-turn slots and only marks dates full when every turn is full', async () => {
    const rpc = vi.fn(async () => ({ data: [
      { reservation_date: '2026-09-10', reservation_time: '12:00:00', service_starts_at: '12:00:00', commercial_turn: 'lunch', occupied_guests: 80, has_unclassified_reservation: false },
      { reservation_date: '2026-09-10', reservation_time: '13:00:00', service_starts_at: '13:00:00', commercial_turn: 'lunch', occupied_guests: 80, has_unclassified_reservation: false },
      { reservation_date: '2026-09-10', reservation_time: '18:00:00', service_starts_at: '18:00:00', commercial_turn: 'dinner', occupied_guests: 70, has_unclassified_reservation: false },
    ], error: null }));
    mocks.createAdminClient.mockReturnValue({ from: () => dateQuery([]), rpc });

    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2026-09-10&to=2026-09-11'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_reservation_capacity_availability', { p_from: '2026-09-10', p_to: '2026-09-11' });
    await expect(response.json()).resolves.toMatchObject({
      turnTotals: { '2026-09-10|lunch': 80, '2026-09-10|dinner': 70 },
      timeTurns: { '2026-09-10': { '12:00': 'lunch', '13:00': 'lunch', '18:00': 'dinner' } },
      fullDates: [],
      availableTimes: { '2026-09-10': ['18:00'] },
    });
  });

  it('clips public availability to today through today plus ten days', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    mocks.createAdminClient.mockReturnValue({ from: () => dateQuery([]), rpc });
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2026-09-01&to=2026-12-31'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_reservation_capacity_availability', { p_from: '2026-09-09', p_to: '2026-09-19' });
  });

  it('keeps successive 30-minute arrivals available while there are places for active guests', async () => {
    const rpc = vi.fn(async () => ({ data: ['19:00:00', '19:30:00', '20:00:00'].map((time) => ({
      reservation_date: '2026-09-10', reservation_time: time, service_starts_at: '18:00:00',
      commercial_turn: 'dinner', occupied_guests: 10, has_unclassified_reservation: false,
    })), error: null }));
    mocks.createAdminClient.mockReturnValue({ from: () => dateQuery([]), rpc });
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2026-09-10'));
    await expect(response.json()).resolves.toMatchObject({
      turnTotals: { '2026-09-10|dinner': 10 },
      fullDates: [], availableTimes: { '2026-09-10': ['19:00', '19:30', '20:00'] },
    });
  });

  it('returns empty turn fields for a period entirely in the past', async () => {
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2000-01-01&to=2000-01-31'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ turnTotals: {}, timeTurns: {}, fullDates: [], specialDates: [], blockedDates: [], availableTimes: {} });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
