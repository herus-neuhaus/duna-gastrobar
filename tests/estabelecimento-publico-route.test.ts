import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), staff: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/estabelecimento-server', () => ({ consultarFuncionamento: mocks.consultar }));
vi.mock('@/lib/auth', () => ({ isPanelStaff: mocks.staff }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }));
import { GET as PUBLIC } from '@/app/api/estabelecimento/funcionamento/route';
import { GET as ADMIN } from '@/app/api/admin/reservations/availability/route';

describe('consulta central de horários', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('publica funcionamento sem parâmetros internos de reserva', async () => {
    mocks.consultar.mockResolvedValue({ versao: 1, funcionamento_configurado: true, dias: [{ dia_semana: 2, data_excecao: null, fechado: false, periodos: [{ abre_as: '11:30', fecha_as: '23:00', encerra_dia_seguinte: false }], reservas: [{ reservation_duration_minutes: 120 }] }] });
    const response = await PUBLIC(); const body = await response.json();
    expect(response.status).toBe(200); expect(body.resumo).toEqual(['Terça-feira: 11:30 às 23:00']);
    expect(body.dias[0]).not.toHaveProperty('reservas'); expect(body).not.toHaveProperty('versao');
  });
  it('não inventa horários quando o banco está indisponível', async () => {
    mocks.consultar.mockRejectedValue(new Error('missing table'));
    expect((await PUBLIC()).status).toBe(503);
  });
  it('protege a consulta administrativa antes de acessar o banco', async () => {
    mocks.staff.mockResolvedValue(false);
    expect((await ADMIN(new Request('http://localhost?date=2026-12-01'))).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('valida a data e consulta a mesma RPC usada pelo site, sem limite público de dez dias', async () => {
    mocks.staff.mockResolvedValue(true);
    expect((await ADMIN(new Request('http://localhost?date=2026-02-30'))).status).toBe(400);
    const rpc = vi.fn(async () => ({ data: [{ reservation_time: '12:00:00' }], error: null })); mocks.client.mockReturnValue({ rpc });
    const response = await ADMIN(new Request('http://localhost?date=2028-12-01'));
    expect(rpc).toHaveBeenCalledWith('get_reservation_capacity_availability', { p_from: '2028-12-01', p_to: '2028-12-01' });
    expect(await response.json()).toEqual({ horarios: ['12:00'] });
  });
});
