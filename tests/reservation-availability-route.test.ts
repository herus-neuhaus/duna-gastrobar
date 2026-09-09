import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from '@/app/api/reservations/availability/route';

function dateQuery(data: unknown[]) {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        lte: vi.fn(async () => ({ data, error: null })),
      })),
    })),
  };
}

describe('GET /api/reservations/availability', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
  });

  it('rejects invalid periods without querying Supabase', async () => {
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=invalid'));

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('returns aggregate totals without cancelled reservations', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'reservations') {
        return dateQuery([
          { reservation_date: '2026-09-10', num_guests: 30, status: 'confirmed' },
          { reservation_date: '2026-09-10', num_guests: 60, status: 'pending' },
          { reservation_date: '2026-09-10', num_guests: 20, status: 'cancelled' },
        ]);
      }
      return dateQuery([]);
    });
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    mocks.createAdminClient.mockReturnValue({ from, rpc });

    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2026-09-10&to=2026-09-11'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totals: { '2026-09-10': 90 },
      fullDates: ['2026-09-10'],
    });
  });

  it('does not expose availability configuration for an entirely past period', async () => {
    const response = await GET(new Request('http://localhost/api/reservations/availability?from=2000-01-01&to=2000-01-31'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totals: {},
      fullDates: [],
      specialDates: [],
      blockedDates: [],
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
