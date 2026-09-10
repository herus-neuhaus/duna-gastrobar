import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from '@/app/api/decorations/route';

describe('GET /api/decorations', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
  });

  it('rejects an incomplete availability period', async () => {
    const response = await GET(new Request('http://localhost/api/decorations?date=2026-09-10'));

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('marks tables already reserved in the selected period as unavailable', async () => {
    const order = vi.fn(async () => ({
      data: [
        { id: 'table-1', name: 'Mesa 1', image_url: 'https://example.com/mesa-1.jpg' },
        { id: 'table-2', name: 'Mesa 2', image_url: 'https://example.com/mesa-2.jpg' },
      ],
      error: null,
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ order })),
      })),
    }));
    const rpc = vi.fn(async () => ({
      data: [
        { decoration_id: 'table-1', available: false },
        { decoration_id: 'table-2', available: true },
      ],
      error: null,
    }));
    mocks.createAdminClient.mockReturnValue({ from, rpc });

    const response = await GET(new Request('http://localhost/api/decorations?date=2026-09-10&time=13:00'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      decorations: [
        { id: 'table-1', name: 'Mesa 1', image_url: 'https://example.com/mesa-1.jpg', available: false },
        { id: 'table-2', name: 'Mesa 2', image_url: 'https://example.com/mesa-2.jpg', available: true },
      ],
    });
    expect(rpc).toHaveBeenCalledWith('get_reservation_decoration_availability', {
      p_reservation_date: '2026-09-10',
      p_reservation_time: '13:00',
    });
  });
});
