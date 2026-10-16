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
  it.each(['CONFIGURACAO_DESATUALIZADA', 'AGENDA_CONFLITO_RESERVAS:3'])('retorna conflito sem expor dados pessoais: %s', async (message) => {
    mocks.client.mockResolvedValue({ rpc: vi.fn(async () => ({ data: null, error: { message } })) });
    expect((await PUT(request(config()))).status).toBe(409);
  });
});
