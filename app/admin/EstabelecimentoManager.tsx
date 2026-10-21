'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, Copy, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Feedback } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form-controls';
import { DIAS_SEMANA, ORDEM_SEMANA, resumirFuncionamento, validarConfiguracaoEstabelecimento, type ConfiguracaoEstabelecimento, type DiaFuncionamento, type JanelaReserva, type PeriodoFuncionamento } from '@/lib/estabelecimento';

const periodoInicial = (): PeriodoFuncionamento => ({ abre_as: '11:30', fecha_as: '23:00', encerra_dia_seguinte: false });
const reservaInicial = (): JanelaReserva => ({ starts_at: '12:00', ends_at: '13:30', commercial_turn: 'lunch', slot_interval_minutes: 30, reservation_duration_minutes: 120, turnover_buffer_minutes: 30 });

export default function EstabelecimentoManager() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEstabelecimento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [aba, setAba] = useState<'funcionamento' | 'reservas' | 'excecoes'>('funcionamento');
  const [origemCopia, setOrigemCopia] = useState('2');
  const [destinosCopia, setDestinosCopia] = useState<number[]>([]);
  const [copiando, setCopiando] = useState(false);
  const [novaData, setNovaData] = useState('');
  const salvamentoEmAndamento = useRef(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const response = await fetch('/api/admin/estabelecimento', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as configurações.');
      setConfiguracao(data);
      setAlterado(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar as configurações.');
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void carregar(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [carregar]);
  useEffect(() => {
    if (!alterado) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [alterado]);

  const editar = (operacao: (config: ConfiguracaoEstabelecimento) => ConfiguracaoEstabelecimento) => {
    setConfiguracao((atual) => atual ? operacao(atual) : atual);
    setAlterado(true);
    setErro('');
    setSucesso('');
  };
  const editarDia = (indice: number, atualizacao: Partial<DiaFuncionamento>) => editar((atual) => ({ ...atual, dias: atual.dias.map((dia, i) => i === indice ? { ...dia, ...atualizacao } : dia) }));
  const editarPeriodo = (indice: number, numero: number, atualizacao: Partial<PeriodoFuncionamento>) => {
    if (!configuracao) return;
    editarDia(indice, { periodos: configuracao.dias[indice].periodos.map((periodo, i) => i === numero ? { ...periodo, ...atualizacao } : periodo) });
  };
  const editarReserva = (indice: number, numero: number, atualizacao: Partial<JanelaReserva>) => {
    if (!configuracao) return;
    editarDia(indice, { reservas: configuracao.dias[indice].reservas.map((janela, i) => i === numero ? { ...janela, ...atualizacao } : janela) });
  };

  const salvar = async () => {
    if (!configuracao || salvamentoEmAndamento.current) return;
    const mensagem = validarConfiguracaoEstabelecimento(configuracao);
    if (mensagem) { setErro(mensagem); return; }
    salvamentoEmAndamento.current = true;
    setSalvando(true); setErro(''); setSucesso('');
    try {
      const response = await fetch('/api/admin/estabelecimento', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configuracao) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar as configurações.');
      setAlterado(false);
      setSucesso('Funcionamento e agenda de reservas atualizados.');
      await carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSalvando(false); salvamentoEmAndamento.current = false; }
  };

  const copiar = () => {
    const origem = configuracao?.dias.find((dia) => dia.dia_semana === Number(origemCopia));
    if (!origem || !destinosCopia.length) return;
    editar((atual) => ({ ...atual, dias: atual.dias.map((dia) => dia.dia_semana !== null && destinosCopia.includes(dia.dia_semana) ? {
      ...dia, fechado: origem.fechado,
      periodos: origem.periodos.map(({ id: _id, ...periodo }) => ({ ...periodo })),
      reservas: origem.reservas.map(({ id: _id, ...reserva }) => ({ ...reserva })),
    } : dia) }));
    setCopiando(false); setDestinosCopia([]);
  };

  const renderizarPeriodos = (dia: DiaFuncionamento, indice: number) => <div className="space-y-3">
    {dia.periodos.map((periodo, numero) => <div key={numero} className="rounded-xl border border-[#D9CFC1]/70 bg-[#FDFBF7] p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-28 flex-1 text-xs font-medium">Abre às<Input aria-label={`Abertura do período ${numero + 1}`} type="time" value={periodo.abre_as} onChange={(event) => editarPeriodo(indice, numero, { abre_as: event.target.value })} /></label>
        <label className="min-w-28 flex-1 text-xs font-medium">Fecha às<Input aria-label={`Fechamento do período ${numero + 1}`} type="time" value={periodo.fecha_as} onChange={(event) => editarPeriodo(indice, numero, { fecha_as: event.target.value })} /></label>
        <Button type="button" variant="danger" size="icon" aria-label={`Remover período ${numero + 1}`} onClick={() => editarDia(indice, { periodos: dia.periodos.filter((_, i) => i !== numero) })}><Trash2 size={16} /></Button>
      </div>
      <label className="mt-3 flex min-h-9 items-center gap-2 text-xs"><input type="checkbox" checked={periodo.encerra_dia_seguinte} onChange={(event) => editarPeriodo(indice, numero, { encerra_dia_seguinte: event.target.checked })} /> Encerra no dia seguinte</label>
    </div>)}
    <Button type="button" variant="secondary" size="sm" disabled={dia.periodos.length >= 6} onClick={() => editarDia(indice, { periodos: [...dia.periodos, periodoInicial()] })}><Plus size={14} /> Adicionar período</Button>
  </div>;

  if (carregando) return <Card className="flex justify-center p-12"><Loader2 className="animate-spin" aria-label="Carregando configurações" /></Card>;
  if (!configuracao) return <Card className="space-y-4 p-6"><Feedback tone="error">{erro}</Feedback><Button onClick={() => void carregar()}>Tentar novamente</Button></Card>;

  const diasVisiveis = aba === 'excecoes'
    ? configuracao.dias.map((dia, indice) => ({ dia, indice })).filter(({ dia }) => dia.data_excecao !== null).sort((a, b) => a.dia.data_excecao!.localeCompare(b.dia.data_excecao!))
    : ORDEM_SEMANA.map((numero) => ({ dia: configuracao.dias.find((dia) => dia.dia_semana === numero)!, indice: configuracao.dias.findIndex((dia) => dia.dia_semana === numero) })).filter(({ dia }) => dia);

  return <fieldset disabled={salvando} aria-label="Configurações do estabelecimento" className="min-w-0 space-y-6">
    {!configuracao.funcionamento_configurado && <Feedback tone="warning">Os horários abaixo são uma sugestão baseada no site atual. Confira os sete dias e salve para ativar a integração com as reservas.</Feedback>}
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="flex items-center gap-2 text-lg font-bold"><Clock size={20} /> Funcionamento e reservas</h2><p className="mt-1 text-sm text-[#4A3728]/65">Horários locais de Porto Velho. Abrir a casa não libera reservas automaticamente.</p></div>
        <Button type="button" variant="secondary" onClick={() => setCopiando(!copiando)}><Copy size={16} /> Copiar para outros dias</Button>
      </div>
      {copiando && <div className="mt-5 space-y-4 rounded-xl bg-[#F5F2ED] p-4">
        <label className="block text-xs font-bold">Copiar funcionamento e reservas de<Select value={origemCopia} onChange={(event) => { setOrigemCopia(event.target.value); setDestinosCopia([]); }}>{ORDEM_SEMANA.map((numero) => <option key={numero} value={numero}>{DIAS_SEMANA[numero]}</option>)}</Select></label>
        <fieldset><legend className="text-xs font-bold">Substituir nos dias selecionados</legend><div className="mt-2 flex flex-wrap gap-3">{ORDEM_SEMANA.filter((numero) => numero !== Number(origemCopia)).map((numero) => <label key={numero} className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={destinosCopia.includes(numero)} onChange={(event) => setDestinosCopia((atual) => event.target.checked ? [...atual, numero] : atual.filter((dia) => dia !== numero))} />{DIAS_SEMANA[numero]}</label>)}</div></fieldset>
        <Button type="button" size="sm" disabled={!destinosCopia.length} onClick={copiar}>Aplicar cópia</Button>
      </div>}
      <nav aria-label="Configurações de horários" className="mt-5 flex flex-wrap gap-2">{([
        ['funcionamento', 'Funcionamento semanal'], ['reservas', 'Horários de reservas'], ['excecoes', 'Datas excepcionais'],
      ] as const).map(([valor, label]) => <Button key={valor} type="button" variant={aba === valor ? 'primary' : 'secondary'} size="sm" aria-pressed={aba === valor} onClick={() => setAba(valor)}>{label}</Button>)}</nav>
    </Card>

    {aba === 'reservas' && <Feedback tone="info">Configure cada dia e turno separadamente. O intervalo de 30 minutos espaça as entradas, não limita a duração do atendimento. A permanência prevista precisa caber no funcionamento; a preparação da mesa pode terminar depois. Os 80 lugares por turno consideram pessoas com reservas ativas e só são liberados ao concluir, cancelar ou registrar não comparecimento, nunca automaticamente pelo tempo previsto.</Feedback>}
    {aba === 'excecoes' && <Card className="space-y-4 p-5">
      <div><h3 className="flex items-center gap-2 font-bold"><CalendarDays size={18} /> Exceções de funcionamento</h3><p className="mt-1 text-sm text-[#4A3728]/65">Substituem o funcionamento semanal naquela data. Bloqueios de reservas e taxas de eventos continuam nas telas próprias.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium">Data<Input type="date" value={novaData} onChange={(event) => setNovaData(event.target.value)} /></label><Button type="button" variant="secondary" disabled={!novaData || configuracao.dias.some((dia) => dia.data_excecao === novaData)} onClick={() => { editar((atual) => ({ ...atual, dias: [...atual.dias, { dia_semana: null, data_excecao: novaData, fechado: true, periodos: [], reservas: [] }] })); setNovaData(''); }}><Plus size={16} /> Adicionar data</Button></div>
    </Card>}

    <div className="space-y-4">{diasVisiveis.map(({ dia, indice }) => <Card key={dia.data_excecao || `semana-${dia.dia_semana}`} className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div><h3 className="font-bold">{dia.data_excecao ? dia.data_excecao.split('-').reverse().join('/') : DIAS_SEMANA[dia.dia_semana!]}</h3>
          {aba !== 'reservas' && <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!dia.fechado} onChange={(event) => {
            if (!event.target.checked && !window.confirm('Fechar este dia bloqueará novas reservas. As reservas já cadastradas serão mantidas e deverão ser atendidas normalmente. Continuar?')) return;
            editarDia(indice, { fechado: !event.target.checked, periodos: event.target.checked ? [periodoInicial()] : [], reservas: event.target.checked ? dia.reservas : [] });
          }} />{dia.fechado ? 'Fechado' : 'Aberto'}</label>}
          {aba === 'reservas' && <p className="mt-2 text-xs text-[#4A3728]/60">{dia.fechado ? 'Estabelecimento fechado' : dia.periodos.map((periodo) => `${periodo.abre_as}–${periodo.fecha_as}${periodo.encerra_dia_seguinte ? ' (+1 dia)' : ''}`).join(' / ')}</p>}
          {dia.data_excecao && <Button type="button" variant="danger" size="sm" className="mt-2" onClick={() => editar((atual) => ({ ...atual, dias: atual.dias.filter((_, i) => i !== indice) }))}><Trash2 size={14} /> Usar padrão semanal</Button>}
        </div>
        {aba !== 'reservas' ? (dia.fechado ? <p className="self-center text-sm text-[#4A3728]/55">Fechado para novas reservas. Reservas já cadastradas continuam válidas.</p> : renderizarPeriodos(dia, indice)) : <div className="space-y-3">
          {dia.reservas.map((janela, numero) => <fieldset key={numero} className="rounded-xl border border-[#D9CFC1]/70 bg-[#FDFBF7] p-3">
            <legend className="px-1 text-xs font-bold">Janela {numero + 1}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs">Turno<Select value={janela.commercial_turn} onChange={(event) => editarReserva(indice, numero, { commercial_turn: event.target.value as JanelaReserva['commercial_turn'] })}><option value="lunch">Almoço</option><option value="dinner">Jantar</option></Select></label>
              <label className="text-xs">Primeira entrada<Input type="time" value={janela.starts_at} onChange={(event) => editarReserva(indice, numero, { starts_at: event.target.value })} /></label>
              <label className="text-xs">Última entrada<Input type="time" value={janela.ends_at} onChange={(event) => editarReserva(indice, numero, { ends_at: event.target.value })} /></label>
              <label className="text-xs">Intervalo (min)<Input type="number" min={5} max={240} value={janela.slot_interval_minutes} onChange={(event) => editarReserva(indice, numero, { slot_interval_minutes: Number(event.target.value) })} /></label>
              <label className="text-xs">Permanência prevista (min)<Input type="number" min={30} max={480} value={janela.reservation_duration_minutes} onChange={(event) => editarReserva(indice, numero, { reservation_duration_minutes: Number(event.target.value) })} /></label>
              <label className="text-xs">Preparação (min)<Input type="number" min={0} max={120} value={janela.turnover_buffer_minutes} onChange={(event) => editarReserva(indice, numero, { turnover_buffer_minutes: Number(event.target.value) })} /></label>
            </div>
            <Button type="button" variant="danger" size="sm" className="mt-3" onClick={() => editarDia(indice, { reservas: dia.reservas.filter((_, i) => i !== numero) })}><Trash2 size={14} /> Remover janela</Button>
          </fieldset>)}
          {!dia.fechado && <Button type="button" variant="secondary" size="sm" disabled={dia.reservas.length >= 12} onClick={() => editarDia(indice, { reservas: [...dia.reservas, reservaInicial()] })}><Plus size={14} /> Adicionar janela de reserva</Button>}
          {!dia.fechado && !dia.reservas.length && <p className="text-xs text-[#4A3728]/60">Aberto, sem reservas online neste dia.</p>}
        </div>}
      </div>
    </Card>)}</div>

    <Card className="space-y-4 p-5">
      <div><h3 className="text-sm font-bold">Como aparece no site</h3>{resumirFuncionamento(configuracao.dias).map((texto) => <p key={texto} className="mt-1 text-sm text-[#4A3728]/70">{texto}</p>)}{!resumirFuncionamento(configuracao.dias).length && <p className="mt-1 text-sm">Fechado em todos os dias da semana.</p>}</div>
      <p className="text-xs text-[#4A3728]/60">Alterações de funcionamento e de janelas valem para novas reservas e reagendamentos. As reservas já cadastradas mantêm seus horários, mesas e decorações, mesmo que o horário seja removido. A madrugada é suportada no funcionamento; as entradas de reserva continuam na mesma data civil.</p>
    </Card>
    <div className="sticky bottom-0 z-10 space-y-3 rounded-2xl border border-[#D9CFC1] bg-[#FDFBF7] p-4 shadow-lg" aria-live="polite">
      {erro && <Feedback tone="error">{erro}</Feedback>}{sucesso && <Feedback tone="success">{sucesso}</Feedback>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#4A3728]/65">{alterado ? 'Há alterações não salvas.' : 'As alterações são aplicadas juntas e registradas em auditoria.'}</p><div className="flex gap-2"><Button type="button" variant="secondary" disabled={salvando} onClick={() => { if (!alterado || window.confirm('Descartar as alterações não salvas?')) void carregar(); }}>Recarregar</Button><Button type="button" disabled={salvando || (!alterado && configuracao.funcionamento_configurado)} onClick={() => void salvar()}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar alterações</Button></div></div>
    </div>
  </fieldset>;
}
