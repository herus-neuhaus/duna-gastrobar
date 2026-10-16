export const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export type PeriodoFuncionamento = {
  id?: string;
  abre_as: string;
  fecha_as: string;
  encerra_dia_seguinte: boolean;
};

export type JanelaReserva = {
  id?: string;
  starts_at: string;
  ends_at: string;
  commercial_turn: 'lunch' | 'dinner';
  slot_interval_minutes: number;
  reservation_duration_minutes: number;
  turnover_buffer_minutes: number;
};

export type DiaFuncionamento = {
  dia_semana: number | null;
  data_excecao: string | null;
  fechado: boolean;
  periodos: PeriodoFuncionamento[];
  reservas: JanelaReserva[];
};

export type ConfiguracaoEstabelecimento = {
  versao: number;
  funcionamento_configurado: boolean;
  dias: DiaFuncionamento[];
};

export function minutos(horario: string) {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

const horarioValido = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const uuidValido = (value: unknown) => value === undefined || (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

export function validarConfiguracaoEstabelecimento(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Configuração inválida.';
  const config = value as ConfiguracaoEstabelecimento;
  if (!Number.isInteger(config.versao) || config.versao < 0 || !Array.isArray(config.dias) || config.dias.length > 107) return 'Configuração inválida.';
  const chaves = new Set<string>();
  const idsPeriodos = new Set<string>();
  const idsReservas = new Set<string>();
  for (const dia of config.dias) {
    if (!dia || typeof dia !== 'object' || typeof dia.fechado !== 'boolean' || !Array.isArray(dia.periodos) || !Array.isArray(dia.reservas)) return 'Confira os dias e os períodos.';
    const semanal = dia.data_excecao === null && Number.isInteger(dia.dia_semana) && dia.dia_semana !== null && dia.dia_semana >= 0 && dia.dia_semana <= 6;
    const dataExcecao = typeof dia.data_excecao === 'string' ? new Date(`${dia.data_excecao}T12:00:00Z`) : null;
    const excepcional = dia.dia_semana === null && typeof dia.data_excecao === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dia.data_excecao) && dataExcecao !== null && Number.isFinite(dataExcecao.getTime()) && dataExcecao.toISOString().slice(0, 10) === dia.data_excecao;
    if (!semanal && !excepcional) return 'Dia da semana ou data inválida.';
    const chave = semanal ? `semana:${dia.dia_semana}` : `data:${dia.data_excecao}`;
    if (chaves.has(chave)) return 'Existem dias repetidos.';
    chaves.add(chave);
    if (dia.periodos.length > 6 || dia.reservas.length > 12 || (excepcional && dia.reservas.length)) return 'Quantidade de períodos inválida.';
    if (dia.fechado && dia.periodos.length) return 'Um dia fechado não pode ter períodos de funcionamento.';
    if (!dia.fechado && !dia.periodos.length) return 'Informe pelo menos um período para os dias abertos.';
    const intervalos: Array<[number, number]> = [];
    for (const periodo of dia.periodos) {
      if (!periodo || !uuidValido(periodo.id) || !horarioValido(periodo.abre_as) || !horarioValido(periodo.fecha_as) || typeof periodo.encerra_dia_seguinte !== 'boolean') return 'Horário de funcionamento inválido.';
      if (periodo.id && idsPeriodos.has(periodo.id)) return 'Existem períodos repetidos.';
      if (periodo.id) idsPeriodos.add(periodo.id);
      const inicio = minutos(periodo.abre_as);
      const fim = minutos(periodo.fecha_as) + (periodo.encerra_dia_seguinte ? 1440 : 0);
      if (fim <= inicio || fim - inicio > 1440) return 'O fechamento deve ocorrer após a abertura, em até 24 horas.';
      intervalos.push([inicio, fim]);
    }
    intervalos.sort((a, b) => a[0] - b[0]);
    if (intervalos.some((item, index) => index > 0 && item[0] < intervalos[index - 1][1])) return 'Existem períodos de funcionamento sobrepostos.';
    const janelas: Array<[number, number]> = [];
    for (const janela of dia.reservas) {
      if (!janela || !uuidValido(janela.id) || !horarioValido(janela.starts_at) || !horarioValido(janela.ends_at) || !['lunch', 'dinner'].includes(janela.commercial_turn)) return 'Confira os horários e turnos das reservas.';
      if (janela.id && idsReservas.has(janela.id)) return 'Existem janelas de reserva repetidas.';
      if (janela.id) idsReservas.add(janela.id);
      if (!Number.isInteger(janela.slot_interval_minutes) || janela.slot_interval_minutes < 5 || janela.slot_interval_minutes > 240 || !Number.isInteger(janela.reservation_duration_minutes) || janela.reservation_duration_minutes < 30 || janela.reservation_duration_minutes > 480 || !Number.isInteger(janela.turnover_buffer_minutes) || janela.turnover_buffer_minutes < 0 || janela.turnover_buffer_minutes > 120) return 'Intervalo, permanência ou tempo de preparação inválido.';
      const inicio = minutos(janela.starts_at), fim = minutos(janela.ends_at);
      if (fim < inicio) return 'As janelas de reserva devem começar e terminar na mesma data.';
      if (dia.fechado || !intervalos.some(([abre, fecha]) => inicio >= abre && fim + janela.reservation_duration_minutes <= fecha)) return 'A última reserva e sua permanência devem caber no funcionamento. O tempo de preparação pode terminar depois.';
      janelas.push([inicio, fim]);
    }
    janelas.sort((a, b) => a[0] - b[0]);
    if (janelas.some((item, index) => index > 0 && item[0] <= janelas[index - 1][1])) return 'Existem janelas de reserva sobrepostas.';
  }
  if (ORDEM_SEMANA.some((dia) => !chaves.has(`semana:${dia}`))) return 'Configure os sete dias da semana.';
  // A madrugada de um dia não pode se sobrepor à abertura do próximo.
  const semana = config.dias.filter((dia) => dia.dia_semana !== null);
  for (const dia of semana) {
    const proximo = semana.find((item) => item.dia_semana === (dia.dia_semana! + 1) % 7);
    for (const periodo of dia.periodos.filter((item) => item.encerra_dia_seguinte)) {
      if (proximo?.periodos.some((item) => minutos(item.abre_as) < minutos(periodo.fecha_as))) return 'O funcionamento na madrugada se sobrepõe ao dia seguinte.';
    }
  }
  return null;
}

export function resumirFuncionamento(dias: DiaFuncionamento[]) {
  const grupos: Array<{ dias: string[]; horarios: string }> = [];
  for (const numero of ORDEM_SEMANA) {
    const dia = dias.find((item) => item.dia_semana === numero && item.data_excecao === null);
    if (!dia || dia.fechado) {
      // Não agrupa dias separados por uma folga como se fossem consecutivos.
      grupos.push({ dias: [], horarios: '' });
      continue;
    }
    const horarios = dia.periodos.map((periodo) => `${periodo.abre_as.slice(0, 5)} às ${periodo.fecha_as.slice(0, 5)}${periodo.encerra_dia_seguinte ? ' do dia seguinte' : ''}`).join(' e ');
    const anterior = grupos[grupos.length - 1];
    if (anterior?.horarios === horarios) anterior.dias.push(DIAS_SEMANA[numero]);
    else grupos.push({ dias: [DIAS_SEMANA[numero]], horarios });
  }
  return grupos.filter((grupo) => grupo.dias.length).map((grupo) => `${grupo.dias.length > 2 ? `${grupo.dias[0]} a ${grupo.dias[grupo.dias.length - 1]}` : grupo.dias.join(' e ')}: ${grupo.horarios}`);
}
