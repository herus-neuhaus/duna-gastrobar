'use client';

import { useEffect, useState } from 'react';

type FuncionamentoPublico = { resumo: string[]; dias: Array<{ data_excecao: string | null; fechado: boolean; periodos: Array<{ abre_as: string; fecha_as: string; encerra_dia_seguinte: boolean }> }> };

export default function HorariosFuncionamento() {
  const [dados, setDados] = useState<FuncionamentoPublico | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/estabelecimento/funcionamento', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('Indisponível'); setDados(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setIndisponivel(true); });
    return () => controller.abort();
  }, []);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
  const excecoes = dados?.dias.filter((dia) => dia.data_excecao && dia.data_excecao >= hoje).sort((a, b) => a.data_excecao!.localeCompare(b.data_excecao!)).slice(0, 3) || [];
  return <div className="mt-1 space-y-1 text-sm text-white/90" aria-live="polite">
    {!dados && <p>{indisponivel ? 'Consulte os horários pelo WhatsApp.' : 'Carregando horários…'}</p>}
    {dados && (dados.resumo.length ? dados.resumo.map((texto) => <p key={texto}>{texto}</p>) : <p>Sem funcionamento semanal no momento.</p>)}
    {excecoes.map((dia) => <p key={dia.data_excecao} className="text-xs text-[#f8e3b2]">{dia.data_excecao!.split('-').reverse().join('/')}: {dia.fechado ? 'Fechado' : dia.periodos.map((periodo) => `${periodo.abre_as} às ${periodo.fecha_as}${periodo.encerra_dia_seguinte ? ' (+1 dia)' : ''}`).join(' e ')}</p>)}
  </div>;
}
