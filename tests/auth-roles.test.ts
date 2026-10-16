import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }));
import { isAdmin, isFinanceStaff, isPanelStaff, isReservationOwner } from '@/lib/auth';

function profile(role: string, force_password_change = false) {
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role, force_password_change } }) }) }) }) });
}
describe('autorização de servidor por nível de acesso', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(['admin', 'dono'])('%s tem acesso administrativo, financeiro e às antigas ações de dono', async (role) => {
    profile(role);
    expect(await isAdmin()).toBe(true); expect(await isFinanceStaff()).toBe(true); expect(await isReservationOwner()).toBe(true); expect(await isPanelStaff()).toBe(true);
  });
  it.each(['employee', 'gerente', 'receptionist', 'portaria'])('%s tem operação sem gestão', async (role) => {
    profile(role);
    expect(await isAdmin()).toBe(false); expect(await isFinanceStaff()).toBe(false); expect(await isReservationOwner()).toBe(false); expect(await isPanelStaff()).toBe(true);
  });
  it('não libera acesso antes da troca obrigatória de senha', async () => {
    profile('admin', true);
    expect(await isAdmin()).toBe(false); expect(await isPanelStaff()).toBe(false);
  });
  it('nega sessões ausentes', async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect(await isAdmin()).toBe(false); expect(await isPanelStaff()).toBe(false);
  });
});
