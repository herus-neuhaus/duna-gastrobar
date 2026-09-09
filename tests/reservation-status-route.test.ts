import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  isPanelStaff: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/auth', () => ({
  isPanelStaff: mocks.isPanelStaff,
}));

import { GET, PATCH } from '@/app/api/reservations/[id]/route';

const accessToken = 'a'.repeat(64);

describe('reservation access and status routes', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.isPanelStaff.mockReset();
  });

  it('reads only the reservation represented by a bearer access token', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ id: '11111111-1111-4111-8111-111111111111', status: 'pending', num_guests: 2 }],
      error: null,
    }));
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await GET(new Request('http://localhost/api/reservations/11111111-1111-4111-8111-111111111111', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_reservation_with_access_token', expect.objectContaining({ p_reservation_id: '11111111-1111-4111-8111-111111111111' }));
  });

  it('rejects a public cancellation without a reservation access token', async () => {
    mocks.isPanelStaff.mockResolvedValue(false);

    const response = await PATCH(new Request('http://localhost/api/reservations/11111111-1111-4111-8111-111111111111', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });

    expect(response.status).toBe(401);
  });

  it('cancels with the token through one conditional database transition', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'reservation-id', status: 'cancelled' }], error: null }));
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await PATCH(new Request('http://localhost/api/reservations/11111111-1111-4111-8111-111111111111', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel', accessToken }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('cancel_reservation_with_access_token', expect.objectContaining({ p_reservation_id: '11111111-1111-4111-8111-111111111111' }));
  });

  it('confirms through a conditional pending-to-confirmed transition', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const rpc = vi.fn(async () => ({ data: [{ id: 'reservation-id', status: 'confirmed' }], error: null }));
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await PATCH(new Request('http://localhost/api/reservations/11111111-1111-4111-8111-111111111111', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'confirm' }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('transition_reservation_status', {
      p_reservation_id: '11111111-1111-4111-8111-111111111111',
      p_expected_statuses: ['pending'],
      p_next_status: 'confirmed',
    });
  });
});
