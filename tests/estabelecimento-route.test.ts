import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ owner: vi.fn(), client: vi.fn(), consultar: vi.fn() }));
vi.mock('@/lib/auth', () => ({ isReservationOwner: mocks.owner }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }));
vi.mock('@/lib/estabelecimento-server', () => ({ consultarFuncionamento: mocks.consultar }));
import { GET, PUT } from '@/app/api/admin/estabelecimento/route';

const config = () => ({ versao: 0, dias: Array.from({ length: 7 }, (_, dia_semana) => ({ dia_semana, data_excecao: null, fechado: true, periodos: [], reservas: [] })) });
const request = (body: unknown) => new Request('http://localhost/api/admin/estabelecimento', { method: 'PUT', body: JSON.stringify(body) });
describe('configurações do estabelecimento', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue(true); });
  it('protege leitura e escrita antes de consultar o banco', async () => {
    mocks.owner.mockResolvedValue(false);
    expect((await GET()).status).toBe(403);
    expect((await PUT(request(config()))).status).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.consultar).not.toHaveBeenCalled();
  });
  it('retorna erro acionável quando falta a migração', async () => {
    mocks.consultar.mockRejectedValue(new Error('missing table'));
    expect((await GET()).status).toBe(503);
  });
  it('valida o corpo antes de chamar a RPC', async () => {
    expect((await PUT(request({ versao: 0, dias: [] }))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('salva com cliente autenticado e controle de versão', async () => {
    const rpc = vi.fn(async () => ({ data: 1, error: null })); mocks.client.mockResolvedValue({ rpc });
    const response = await PUT(request(config()));
    expect(response.status).toBe(200); expect(rpc).toHaveBeenCalledWith('salvar_funcionamento_estabelecimento', { p_configuracao: config().dias, p_versao: 0 });
  });
  it('salva segunda só almoço e domingo só jantar com preparação depois do fechamento', async () => {
    const body = config();
    const janela = { starts_at: '12:00', ends_at: '14:00', commercial_turn: 'lunch', slot_interval_minutes: 30, reservation_duration_minutes: 60, turnover_buffer_minutes: 120 };
    const dias = body.dias.map((dia) => dia.dia_semana === 1 ? {
      ...dia, fechado: false,
      periodos: [{ abre_as: '11:30', fecha_as: '15:00', encerra_dia_seguinte: false }],
      reservas: [janela],
    } : dia.dia_semana === 0 ? {
      ...dia, fechado: false,
      periodos: [{ abre_as: '18:00', fecha_as: '22:00', encerra_dia_seguinte: false }],
      reservas: [{ ...janela, starts_at: '19:00', ends_at: '21:00', commercial_turn: 'dinner' }],
    } : dia);
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    mocks.client.mockResolvedValue({ rpc });
    expect((await PUT(request({ ...body, dias }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('salvar_funcionamento_estabelecimento', { p_configuracao: dias, p_versao: 0 });
  });
  it('não aceita permanência prevista depois do fechamento, mesmo sem preparação', async () => {
    const body = config();
    const dias = body.dias.map((dia) => dia.dia_semana === 1 ? {
      ...dia, fechado: false,
      periodos: [{ abre_as: '18:00', fecha_as: '22:00', encerra_dia_seguinte: false }],
      reservas: [{ starts_at: '19:00', ends_at: '21:30', commercial_turn: 'dinner', slot_interval_minutes: 30, reservation_duration_minutes: 60, turnover_buffer_minutes: 0 }],
    } : dia);
    const response = await PUT(request({ ...body, dias }));
    expect(response.status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(['CONFIGURACAO_DESATUALIZADA', 'AGENDA_CONFLITO_RESERVAS:3'])('retorna conflito sem expor dados pessoais: %s', async (message) => {
    mocks.client.mockResolvedValue({ rpc: vi.fn(async () => ({ data: null, error: { message } })) });
    expect((await PUT(request(config()))).status).toBe(409);
  });
});
