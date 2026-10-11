import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isPanelStaff: vi.fn(), isReservationOwner: vi.fn(), createAdminClient: vi.fn(), createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ isPanelStaff: mocks.isPanelStaff, isReservationOwner: mocks.isReservationOwner }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { POST } from '@/app/api/admin/operations/route';

describe('POST /api/admin/operations capacity-sensitive actions', () => {
  beforeEach(() => {
    mocks.isPanelStaff.mockReset();
    mocks.isReservationOwner.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.createClient.mockReset();
  });

  it('creates walk-ins only through the protected RPC, without accepting source from the body', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const rpc = vi.fn(async () => ({ data: [{ id: 'walk-in-id' }], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn(async () => ({ data: [], error: null })) });
    const response = await POST(new Request('http://localhost/api/admin/operations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'walk_in', name: 'Walk in', phone: '69912345678', partySize: 2, date: '2026-09-10', time: '18:00', source: 'website' }),
    }));
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('create_walk_in_reservation', expect.objectContaining({ p_num_guests: 2, p_reservation_date: '2026-09-10', p_cpf: null }));
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('source');
  });

  it('accepts a valid optional CPF for a walk-in', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const rpc = vi.fn(async () => ({ data: [{ id: 'walk-in-id' }], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    const response = await POST(new Request('http://localhost/api/admin/operations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'walk_in', name: 'Walk in', phone: '69912345678', cpf: '529.982.247-25', partySize: 2, date: '2026-09-10', time: '18:00' }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('create_walk_in_reservation', expect.objectContaining({ p_cpf: '52998224725', p_email: null }));
  });

  it('rejects an invalid CPF when one is provided for a walk-in', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    const response = await POST(new Request('http://localhost/api/admin/operations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'walk_in', name: 'Walk in', phone: '69912345678', cpf: '11111111111', partySize: 2, date: '2026-09-10', time: '18:00' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('keeps commercial-turn classification owner-only and calls the dedicated RPC', async () => {
    mocks.isPanelStaff.mockResolvedValue(true);
    mocks.isReservationOwner.mockResolvedValue(true);
    const rpc = vi.fn(async () => ({ data: [{ id: 'reservation-id', commercial_turn: 'lunch' }], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    const response = await POST(new Request('http://localhost/api/admin/operations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classify_reservation_turn', reservationId: 'reservation-id', commercialTurn: 'lunch', reason: 'Checked against service log' }),
    }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('classify_reservation_commercial_turn', expect.objectContaining({ p_commercial_turn: 'lunch' }));
  });
});
