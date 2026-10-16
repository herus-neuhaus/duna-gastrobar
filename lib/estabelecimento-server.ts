import { createAdminClient } from '@/lib/supabase/admin';
import type { ConfiguracaoEstabelecimento, DiaFuncionamento, JanelaReserva } from '@/lib/estabelecimento';

export async function consultarFuncionamento(): Promise<ConfiguracaoEstabelecimento> {
  const supabase = createAdminClient();
  const [configuracao, dias, periodos, reservas] = await Promise.all([
    supabase.from('configuracoes_estabelecimento').select('versao,funcionamento_configurado').eq('id', true).single(),
    supabase.from('dias_funcionamento').select('id,dia_semana,data_excecao,fechado').eq('ativo', true).order('data_excecao'),
    supabase.from('periodos_funcionamento').select('id,dia_funcionamento_id,abre_as,fecha_as,encerra_dia_seguinte').eq('ativo', true).order('abre_as'),
    supabase.from('reservation_schedule_slots').select('*').eq('active', true).order('starts_at'),
  ]);
  if (configuracao.error || dias.error || periodos.error || reservas.error) throw new Error('FUNCIONAMENTO_INDISPONIVEL');
  const resultado: DiaFuncionamento[] = (dias.data || []).map((dia) => ({
    dia_semana: dia.dia_semana,
    data_excecao: dia.data_excecao,
    fechado: dia.fechado,
    periodos: (periodos.data || []).filter((periodo) => periodo.dia_funcionamento_id === dia.id).map((periodo) => ({
      id: periodo.id,
      abre_as: periodo.abre_as.slice(0, 5),
      fecha_as: periodo.fecha_as.slice(0, 5),
      encerra_dia_seguinte: periodo.encerra_dia_seguinte,
    })),
    reservas: (reservas.data || []).filter((janela) => dia.data_excecao === null && janela.day_of_week === dia.dia_semana).map((janela) => ({
      id: janela.id,
      starts_at: janela.starts_at.slice(0, 5),
      ends_at: janela.ends_at.slice(0, 5),
      commercial_turn: janela.commercial_turn as JanelaReserva['commercial_turn'],
      slot_interval_minutes: janela.slot_interval_minutes,
      reservation_duration_minutes: janela.reservation_duration_minutes,
      turnover_buffer_minutes: janela.turnover_buffer_minutes,
    })),
  }));
  return { ...configuracao.data, dias: resultado };
}
