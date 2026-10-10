import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  isPanelStaff: vi.fn(),
  isReservationOwner: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  isPanelStaff: mocks.isPanelStaff,
  isReservationOwner: mocks.isReservationOwner,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { GET, POST } from '@/app/api/admin/operations/route';

function queryBuilder(result: { data: unknown; error: null | { message: string } }) {
  const builder: Record<string, any> = {};
  for (const method of ['select', 'eq', 'in', 'is', 'order', 'update', 'insert']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('/api/admin/operations', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.createClient.mockReset();
    mocks.isPanelStaff.mockReset();
    mocks.isReservationOwner.mockReset();
    mocks.isPanelStaff.mockResolvedValue(true);
    mocks.isReservationOwner.mockResolvedValue(false);
  });

  it('loads assignments only for reservations on the requested operational date', async () => {
    const builders: Record<string, ReturnType<typeof queryBuilder>> = {};
    const results: Record<string, { data: unknown; error: null }> = {
      reservations: { data: [{ id: 'reservation-today' }], error: null },
      restaurant_tables: { data: [], error: null },
      restaurant_areas: { data: [], error: null },
      waitlist_entries: { data: [], error: null },
      reservation_turn_classification_issues: { data: [], error: null },
      reservation_table_assignments: { data: [{ reservation_id: 'reservation-today' }], error: null },
    };
    const from = vi.fn((table: string) => {
      const builder = queryBuilder(results[table] || { data: [], error: null });
      builders[table] = builder;
      return builder;
    });
    mocks.createAdminClient.mockReturnValue({ from, rpc: vi.fn(async () => ({ data: [], error: null })) });

    const response = await GET(new Request('http://localhost/api/admin/operations?date=2026-09-10'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ date: '2026-09-10', reservations: [{ id: 'reservation-today' }], canClassifyHistoricalReservations: false });
    expect(builders.reservation_table_assignments.in).toHaveBeenCalledWith('reservation_id', ['reservation-today']);
    expect(builders.reservation_table_assignments.is).toHaveBeenCalledWith('released_at', null);
  });

  it('rejects an invalid operational date before querying the database', async () => {
    const response = await GET(new Request('http://localhost/api/admin/operations?date=2026-02-31'));

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('explains that database migrations are missing when the capacity RPC is unavailable', async () => {
    const from = vi.fn(() => queryBuilder({ data: [], error: null }));
    mocks.createAdminClient.mockReturnValue({
      from,
      rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } })),
    });

    const response = await GET(new Request('http://localhost/api/admin/operations?date=2026-09-10'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('migrações') });
  });

  it('marks a waiting customer as called using a guarded status update', async () => {
    const builder = queryBuilder({ data: { id: 'waitlist-1', status: 'called' }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const response = await POST(new Request('http://localhost/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call_waitlist', id: 'waitlist-1' }),
    }));

    expect(response.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ status: 'called' });
    expect(builder.in).toHaveBeenCalledWith('status', ['waiting']);
  });
});
