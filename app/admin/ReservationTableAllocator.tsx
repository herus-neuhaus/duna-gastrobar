'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, TableProperties } from 'lucide-react';

type TableAvailability = {
  table_id: string;
  area_id: string;
  area_name: string;
  table_code: string;
  min_capacity: number;
  max_capacity: number;
  active: boolean;
  available: boolean;
  reason: string | null;
};

export default function ReservationTableAllocator({ reservationId, onSaved }: { reservationId: string; onSaved: () => void }) {
  const [tables, setTables] = useState<TableAvailability[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [guests, setGuests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}/tables`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Não foi possível consultar as mesas.');
      else {
        setTables(data.tables || []);
        setSelected(data.assignedTableIds || []);
        setSuggested(data.suggestedTableIds || []);
        setGuests(data.reservation?.num_guests || 0);
      }
    } catch {
      setMessage('Falha de conexão ao consultar as mesas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);
  useEffect(() => { const timeout = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timeout); }, [load]);
  const toggle = (table: TableAvailability) => {
    if (!table.available && !selected.includes(table.table_id)) return;
    setSelected((current) => current.includes(table.table_id) ? current.filter((id) => id !== table.table_id) : [...current, table.table_id]);
  };
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}/tables`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableIds: selected }) });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Não foi possível salvar a alocação.');
      else { setMessage('Mesas alocadas.'); onSaved(); await load(); }
    } catch {
      setMessage('Falha de conexão ao salvar a alocação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };
  const byArea = tables.reduce<Record<string, TableAvailability[]>>((groups, table) => ({ ...groups, [table.area_name]: [...(groups[table.area_name] || []), table] }), {});

  return <section className="mt-4 min-w-0 rounded-2xl border border-[#D9CFC1] bg-[#FDFBF7] p-3 sm:p-4">
    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-bold"><TableProperties size={16} /> Alocação de mesas</p><p className="break-words text-xs text-[#4A3728]/60">Reserva para {guests} pessoas. Mesas indisponíveis exibem o motivo.</p></div><button type="button" onClick={() => setSelected(suggested)} disabled={!suggested.length || loading} className="min-h-11 w-full rounded-xl border border-[#4A3728]/20 px-3 py-2 text-xs font-bold uppercase text-[#4A3728] disabled:opacity-40 xl:w-auto"><RotateCcw size={13} className="mr-1 inline" /> Usar sugestão</button></div>
    {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto animate-spin" /></div> : Object.entries(byArea).map(([area, items]) => <div key={area} className="mb-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">{area}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map((table) => { const checked = selected.includes(table.table_id); return <button type="button" key={table.table_id} disabled={!table.available && !checked} onClick={() => toggle(table)} className={`min-h-11 min-w-0 break-words rounded-xl border p-3 text-left text-xs transition-colors ${checked ? 'border-green-500 bg-green-50 text-green-800' : table.available ? 'border-[#D9CFC1] bg-white text-[#4A3728]' : 'border-red-100 bg-red-50 text-red-700 opacity-70'}`}><span className="flex items-center justify-between font-bold">{table.table_code}{checked && <Check size={14} />}</span><span className="mt-1 block text-[10px]">{table.min_capacity}-{table.max_capacity} lugares</span><span className="mt-1 block break-words text-[10px]">{table.available ? 'Livre' : table.reason}</span></button>; })}</div></div>)}
    {message && <p className="mt-2 text-xs text-[#4A3728]/70">{message}</p>}
    <button type="button" disabled={!selected.length || saving} onClick={() => void save()} className="mt-3 min-h-11 w-full rounded-xl bg-[#4A3728] px-4 py-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50 sm:w-auto sm:text-[10px] sm:tracking-widest">{saving ? 'Salvando...' : 'Salvar alocação'}</button>
  </section>;
}
