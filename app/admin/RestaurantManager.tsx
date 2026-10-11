'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Input, Select } from '@/components/ui/form-controls';
import { EmptyState } from '@/components/ui/empty-state';

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

  return <div className="space-y-5">
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm font-semibold text-[#4A3728]">Dica de organização</p>
        <p className="mt-1 text-sm leading-6 text-[#76695e]">Desative áreas e mesas com histórico em vez de excluí-las.</p>
      </CardContent>
    </Card>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Nova área</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(event) => { event.preventDefault(); void (async () => { if (await create({ kind: 'area', name: areaName })) setAreaName(''); })(); }} className="space-y-4">
            <div><FieldLabel htmlFor="new-area-name">Nome da área</FieldLabel><Input id="new-area-name" required value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Ex.: Varanda" /></div>
            <Button type="submit">Criar área</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Nova mesa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(event) => { event.preventDefault(); void (async () => { if (await create({ kind: 'table', areaId: table.areaId, code: table.code, minCapacity: Number(table.minCapacity), maxCapacity: Number(table.maxCapacity) })) setTable((current) => ({ ...current, code: '' })); })(); }} className="space-y-4">
            <div><FieldLabel htmlFor="table-area">Área</FieldLabel><Select id="table-area" required value={table.areaId} onChange={(event) => setTable({ ...table, areaId: event.target.value })}><option value="">Selecione uma área</option>{areas.filter((area) => area.active).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><FieldLabel htmlFor="table-code">Identificação</FieldLabel><Input id="table-code" required value={table.code} onChange={(event) => setTable({ ...table, code: event.target.value })} placeholder="Mesa 01" /></div>
              <div><FieldLabel htmlFor="table-min">Mínimo de lugares</FieldLabel><Input id="table-min" required type="number" min="1" value={table.minCapacity} onChange={(event) => setTable({ ...table, minCapacity: event.target.value })} /></div>
              <div><FieldLabel htmlFor="table-max">Máximo de lugares</FieldLabel><Input id="table-max" required type="number" min="1" value={table.maxCapacity} onChange={(event) => setTable({ ...table, maxCapacity: event.target.value })} /></div>
            </div>
            <Button type="submit">Criar mesa</Button>
          </form>
        </CardContent>
      </Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {areas.length === 0 && <Card><EmptyState title="Nenhuma área cadastrada" description="Crie uma área para começar a configurar as mesas." /></Card>}
      {areas.map((area) => {
        const areaTables = tables.filter((item) => item.area_id === area.id);
        return <Card key={area.id} className="overflow-hidden">
          <CardHeader>
            <div className="min-w-0"><CardTitle>{area.name}</CardTitle><p className="mt-1 text-xs text-[#76695e]">{areaTables.length} {areaTables.length === 1 ? 'mesa' : 'mesas'} · {area.active ? 'Ativa' : 'Inativa'}</p></div>
            <Button variant="secondary" size="sm" onClick={() => void toggle('area', area.id, !area.active)}>{area.active ? 'Desativar área' : 'Ativar área'}</Button>
          </CardHeader>
          <div className="divide-y divide-[#d9cfc1]/60">
            {areaTables.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div><p className="font-semibold">{item.code}</p><p className="mt-0.5 text-xs text-[#76695e]">{item.min_capacity}–{item.max_capacity} lugares · {item.active ? 'Ativa' : 'Inativa'}</p></div>
              <Button variant="ghost" size="sm" onClick={() => void toggle('table', item.id, !item.active)}>{item.active ? 'Desativar' : 'Ativar'}</Button>
            </div>)}
            {areaTables.length === 0 && <EmptyState title="Sem mesas nesta área" />}
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
