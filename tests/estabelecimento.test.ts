import { describe, expect, it } from 'vitest';
import { resumirFuncionamento, validarConfiguracaoEstabelecimento, type ConfiguracaoEstabelecimento } from '@/lib/estabelecimento';

function configuracao(): ConfiguracaoEstabelecimento {
  return { versao: 0, funcionamento_configurado: false, dias: Array.from({ length: 7 }, (_, dia) => ({
    dia_semana: dia, data_excecao: null, fechado: dia === 1,
    periodos: dia === 1 ? [] : [{ abre_as: '11:30', fecha_as: '23:00', encerra_dia_seguinte: false }],
    reservas: dia === 1 ? [] : [{ starts_at: '12:00', ends_at: '13:30', commercial_turn: 'lunch', slot_interval_minutes: 30, reservation_duration_minutes: 120, turnover_buffer_minutes: 30 }],
  })) };
}

describe('configuração do estabelecimento', () => {
  it('aceita semana completa e vários períodos sem exigir almoço/jantar no funcionamento', () => {
    const config = configuracao();
    config.dias[2].periodos = [{ abre_as: '08:00', fecha_as: '15:30', encerra_dia_seguinte: false }, { abre_as: '18:00', fecha_as: '23:00', encerra_dia_seguinte: false }];
    expect(validarConfiguracaoEstabelecimento(config)).toBeNull();
  });
  it('não confunde última entrada com fechamento ou preparação', () => {
    const config = configuracao();
    config.dias[2].reservas[0].ends_at = '21:00';
    expect(validarConfiguracaoEstabelecimento(config)).toBeNull();
    config.dias[2].reservas[0].ends_at = '21:30';
    expect(validarConfiguracaoEstabelecimento(config)).toContain('permanência');
  });
  it('rejeita semana incompleta, datas inexistentes e duplicatas', () => {
    const config = configuracao();
    config.dias.pop();
    expect(validarConfiguracaoEstabelecimento(config)).toContain('sete dias');
    const invalida = configuracao();
    invalida.dias.push({ dia_semana: null, data_excecao: '2026-99-99', fechado: true, periodos: [], reservas: [] });
    expect(validarConfiguracaoEstabelecimento(invalida)).toContain('data inválida');
    const duplicada = configuracao(); duplicada.dias.push(duplicada.dias[0]);
    expect(validarConfiguracaoEstabelecimento(duplicada)).toContain('repetidos');
  });
  it('aceita madrugada e impede sobreposição no próximo dia', () => {
    const config = configuracao();
    config.dias[5].periodos = [{ abre_as: '18:00', fecha_as: '02:00', encerra_dia_seguinte: true }];
    config.dias[5].reservas = [];
    expect(validarConfiguracaoEstabelecimento(config)).toBeNull();
    config.dias[6].periodos[0].abre_as = '01:00';
    expect(validarConfiguracaoEstabelecimento(config)).toContain('madrugada');
  });
  it('rejeita reservas e períodos sobrepostos', () => {
    const config = configuracao();
    config.dias[2].reservas.push({ ...config.dias[2].reservas[0], starts_at: '13:00' });
    expect(validarConfiguracaoEstabelecimento(config)).toContain('sobrepostas');
    const periodos = configuracao();
    periodos.dias[2].periodos.push({ abre_as: '18:00', fecha_as: '22:00', encerra_dia_seguinte: false });
    expect(validarConfiguracaoEstabelecimento(periodos)).toContain('sobrepostos');
  });
  it('aceita exceção fechada sem confundir com herança semanal', () => {
    const config = configuracao();
    config.dias.push({ dia_semana: null, data_excecao: '2026-12-25', fechado: true, periodos: [], reservas: [] });
    expect(validarConfiguracaoEstabelecimento(config)).toBeNull();
  });
  it('agrupa dias consecutivos sem esconder folgas', () => {
    const config = configuracao();
    expect(resumirFuncionamento(config.dias)).toEqual(['Terça-feira a Domingo: 11:30 às 23:00']);
    config.dias[4] = { ...config.dias[4], fechado: true, periodos: [], reservas: [] };
    expect(resumirFuncionamento(config.dias)).toEqual(['Terça-feira e Quarta-feira: 11:30 às 23:00', 'Sexta-feira a Domingo: 11:30 às 23:00']);
  });
});
