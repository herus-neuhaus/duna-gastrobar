'use client';

import React, { useEffect, useState } from 'react';

type Area = { id: string; name: string; active: boolean };
type Table = { id: string; area_id: string; code: string; min_capacity: number; max_capacity: number; active: boolean };

export default function RestaurantManager() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [areaName, setAreaName] = useState('');
  const [table, setTable] = useState({ areaId: '', code: '', minCapacity: '1', maxCapacity: '2' });

  const load = async () => {
    try {
      const response = await fetch('/api/admin/restaurant', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar áreas e mesas.');

      const loadedAreas: Area[] = data.areas || [];
      const activeAreas = loadedAreas.filter((area) => area.active);
      setAreas(loadedAreas);
      setTables(data.tables || []);
      setTable((current) => activeAreas.some((area) => area.id === current.areaId)
        ? current
        : activeAreas[0] ? { ...current, areaId: activeAreas[0].id } : { ...current, areaId: '' });
      return true;
    } catch (error) {
      console.error('Erro ao carregar áreas e mesas:', error);
      return false;
    }
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  const create = async (body: unknown) => {
    try {
      const response = await fetch('/api/admin/restaurant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Não foi possível salvar.');
        return false;
      }

      await load();
      return true;
    } catch {
      alert('Não foi possível salvar. Verifique sua conexão e tente novamente.');
      return false;
    }
  };
  const toggle = async (kind: string, id: string, active: boolean) => {
    try {
      const response = await fetch('/api/admin/restaurant', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, active }) });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Não foi possível atualizar.');
        return;
      }
      await load();
    } catch {
      alert('Não foi possível atualizar. Verifique sua conexão e tente novamente.');
    }
  };

  return <div className="space-y-6">
    <div className="rounded-3xl border border-[#D9CFC1] bg-white p-6"><h2 className="text-xl font-bold">Áreas e Mesas</h2><p className="mt-1 text-sm text-[#4A3728]/60">Desative itens com histórico em vez de excluí-los.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={(event) => { event.preventDefault(); void (async () => { if (await create({ kind: 'area', name: areaName })) setAreaName(''); })(); }} className="rounded-3xl border border-[#D9CFC1] bg-white p-6 space-y-3"><h3 className="font-bold">Nova área</h3><input required value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Ex.: Varanda" className="w-full rounded-xl bg-[#F5F2ED] px-4 py-3 outline-none"/><button className="rounded-xl bg-[#4A3728] px-4 py-3 text-xs font-bold uppercase text-white">Criar área</button></form>
      <form onSubmit={(event) => { event.preventDefault(); void (async () => { if (await create({ kind: 'table', areaId: table.areaId, code: table.code, minCapacity: Number(table.minCapacity), maxCapacity: Number(table.maxCapacity) })) setTable((current) => ({ ...current, code: '' })); })(); }} className="rounded-3xl border border-[#D9CFC1] bg-white p-6 space-y-3"><h3 className="font-bold">Nova mesa</h3><select required value={table.areaId} onChange={(event) => setTable({ ...table, areaId: event.target.value })} className="w-full rounded-xl bg-[#F5F2ED] px-4 py-3">{areas.filter((area) => area.active).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><div className="grid grid-cols-3 gap-2"><input required value={table.code} onChange={(event) => setTable({ ...table, code: event.target.value })} placeholder="Mesa 01" className="rounded-xl bg-[#F5F2ED] px-3 py-3"/><input required type="number" min="1" value={table.minCapacity} onChange={(event) => setTable({ ...table, minCapacity: event.target.value })} className="rounded-xl bg-[#F5F2ED] px-3 py-3"/><input required type="number" min="1" value={table.maxCapacity} onChange={(event) => setTable({ ...table, maxCapacity: event.target.value })} className="rounded-xl bg-[#F5F2ED] px-3 py-3"/></div><button className="rounded-xl bg-[#4A3728] px-4 py-3 text-xs font-bold uppercase text-white">Criar mesa</button></form>
    </div>
    {areas.map((area) => <section key={area.id} className="rounded-3xl border border-[#D9CFC1] bg-white overflow-hidden"><header className="flex items-center justify-between border-b border-[#D9CFC1] px-6 py-4"><h3 className="font-bold">{area.name}</h3><button onClick={() => void toggle('area', area.id, !area.active)} className="text-xs font-bold text-[#4A3728]">{area.active ? 'Desativar área' : 'Ativar área'}</button></header><div className="divide-y divide-[#D9CFC1]/50">{tables.filter((table) => table.area_id === area.id).map((item) => <div key={item.id} className="flex items-center justify-between px-6 py-4"><span>{item.code} · {item.min_capacity}-{item.max_capacity} lugares</span><button onClick={() => void toggle('table', item.id, !item.active)} className="text-xs font-bold text-[#4A3728]">{item.active ? 'Desativar' : 'Ativar'}</button></div>)}{!tables.some((table) => table.area_id === area.id) && <p className="px-6 py-4 text-sm text-[#4A3728]/50">Sem mesas.</p>}</div></section>)}
  </div>;
}
