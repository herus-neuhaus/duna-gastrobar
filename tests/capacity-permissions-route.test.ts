import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isReservationOwner: vi.fn(), createAdminClient: vi.fn(), createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ isReservationOwner: mocks.isReservationOwner }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { GET, POST } from '@/app/api/admin/capacity-permissions/route';

describe('/api/admin/capacity-permissions', () => {
  beforeEach(() => {
    mocks.isReservationOwner.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.createClient.mockReset();
  });

  it('denies administrators before reading or changing permission records', async () => {
    mocks.isReservationOwner.mockResolvedValue(false);
    const response = await POST(new Request('http://localhost/api/admin/capacity-permissions', {
      method: 'POST', body: JSON.stringify({ profileId: 'target', granted: true, reason: 'Attempted by admin' }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('lists only through the owner-checked administrative API', async () => {
    mocks.isReservationOwner.mockResolvedValue(true);
    const tableQuery = (data: unknown) => ({ select: () => ({
      in: () => ({ order: async () => ({ data, error: null }) }),
      order: () => ({ limit: async () => ({ data, error: null }) }),
    }) });
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => tableQuery(table === 'profiles' ? [{ id: 'staff' }] : []) });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profiles: [{ id: 'staff' }], permissions: [], audits: [] });
  });

  it('derives actor identity from the authenticated session RPC and records a reason', async () => {
    mocks.isReservationOwner.mockResolvedValue(true);
    const rpc = vi.fn(async () => ({ data: [{ updated_profile_id: 'target', granted: true }], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    const response = await POST(new Request('http://localhost/api/admin/capacity-permissions', {
      method: 'POST', body: JSON.stringify({ profileId: 'target', granted: true, reason: 'Coverage authorization' }),
    }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('set_reservation_capacity_permission', {
      p_profile_id: 'target', p_granted: true, p_reason: 'Coverage authorization',
    });
  });

  it('returns self-assignment rejection from the database authorization function', async () => {
    mocks.isReservationOwner.mockResolvedValue(true);
    mocks.createClient.mockResolvedValue({ rpc: vi.fn(async () => ({ data: null, error: { message: 'CAPACITY_PERMISSION_SELF_ASSIGNMENT_FORBIDDEN' } })) });
    const response = await POST(new Request('http://localhost/api/admin/capacity-permissions', {
      method: 'POST', body: JSON.stringify({ profileId: 'owner', granted: true, reason: 'Self assignment' }),
    }));
    expect(response.status).toBe(409);
  });
});
