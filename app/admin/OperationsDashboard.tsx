'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Loader2, RefreshCw, Search, TableProperties, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ReservationTableAllocator from './ReservationTableAllocator';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { Feedback } from '@/components/ui/feedback';

type CapacitySlot = {
  reservation_time: string;
  commercial_turn: 'lunch' | 'dinner';
  occupied_guests: number;
  has_unclassified_reservation: boolean;
};

type Reservation = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  num_guests: number;
  reservation_time: string;
  commercial_turn: string | null;
  status: string;
  payment_status: string | null;
  payment_amount: number | null;
  notes: string | null;
  source: string;
  arrived_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
};

type Assignment = {
  reservation_id: string;
  table_id: string;
  starts_at: string;
  ends_at: string;
  restaurant_tables: {
    code: string;
    restaurant_areas: { name: string } | null;
  } | null;
};

type WaitlistEntry = {
  id: string;
  name: string;
  phone: string;
  party_size: number;
  status: 'waiting' | 'called';
  created_at: string;
  preferred_area_id: string | null;
  notes: string | null;
};

type ClassificationIssue = {
  id: string;
  reservation_date: string;
  reservation_time: string;
  num_guests: number;
  status: string;
  source: string;
  commercial_turn: string | null;
  created_at: string;
};

type OperationsData = {
  date: string;
  reservations: Reservation[];
  assignments: Assignment[];
  tables: Array<{ id: string; area_id: string; code: string; min_capacity: number; max_capacity: number; active: boolean; restaurant_areas: { name: string; active: boolean } | null }>;
  areas: Array<{ id: string; name: string }>;
  waitlist: WaitlistEntry[];
  capacity: CapacitySlot[];
  classificationIssues: ClassificationIssue[];
  canClassifyHistoricalReservations: boolean;
};

type WaitlistForm = { name: string; phone: string; partySize: string; preferredAreaId: string; notes: string };
type WalkInForm = { name: string; phone: string; cpf: string; partySize: string; time: string; notes: string };

function currentLocalTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Porto_Velho',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmada',
    seated: 'Sentada',
    completed: 'Concluída',
    no_show: 'Não compareceu',
    cancelled: 'Cancelada',
    cancelado: 'Cancelada',
    pendente: 'Pendente',
    confirmado: 'Confirmada',
    concluido: 'Concluída',
  };
  return labels[status] || status;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export default function OperationsDashboard() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyKey, setBusyKey] = useState('');
  const [expandedReservationId, setExpandedReservationId] = useState('');
  const [activeEntryForm, setActiveEntryForm] = useState<'walk-in' | 'waitlist' | null>(null);
  const [walkInWaitlistId, setWalkInWaitlistId] = useState('');
  const [waitlistForm, setWaitlistForm] = useState<WaitlistForm>({ name: '', phone: '', partySize: '2', preferredAreaId: '', notes: '' });
  const [walkInForm, setWalkInForm] = useState<WalkInForm>({ name: '', phone: '', cpf: '', partySize: '2', time: '', notes: '' });
  const [classifications, setClassifications] = useState<Record<string, { turn: string; reason: string }>>({});
  const requestInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const loadRef = useRef<(quiet?: boolean) => Promise<boolean>>(async () => false);
  const operationInFlight = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (requestInFlight.current) {
      if (quiet) refreshQueued.current = true;
      return false;
    }
    requestInFlight.current = true;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/admin/operations', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a operação.');
      setData(result as OperationsData);
      setLoadError('');
      return true;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar a operação.');
      return false;
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      if (refreshQueued.current) {
        refreshQueued.current = false;
        window.setTimeout(() => void loadRef.current(true), 0);
      }
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('daily-operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_table_assignments' }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries' }, () => void load(true))
      .subscribe();

    // Keep the board fresh even when the database has no Realtime publication.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const reservations = data?.reservations || [];
  const count = (statuses: string[]) => reservations.filter((item) => statuses.includes(item.status.toLowerCase())).length;
  const people = reservations
    .filter((item) => item.source !== 'walk_in' && !['cancelled', 'cancelado'].includes(item.status.toLowerCase()))
    .reduce((sum, item) => sum + item.num_guests, 0);
  const capacityByTurn = new Map<string, CapacitySlot>();
  for (const slot of data?.capacity || []) {
    if (!capacityByTurn.has(slot.commercial_turn)) capacityByTurn.set(slot.commercial_turn, slot);
  }
  const assignmentsByReservation = new Map<string, Assignment[]>();
  for (const assignment of data?.assignments || []) {
    const current = assignmentsByReservation.get(assignment.reservation_id) || [];
    current.push(assignment);
    assignmentsByReservation.set(assignment.reservation_id, current);
  }

  const runOperation = async (key: string, request: () => Promise<Response>, successMessage: string) => {
    if (operationInFlight.current) return null;
    operationInFlight.current = true;
    setBusyKey(key);
    setFeedback('');
    try {
      const response = await request();
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
      setFeedback(response.status === 202 ? result.error || successMessage : successMessage);
      await load(true);
      return result;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
      return null;
    } finally {
      operationInFlight.current = false;
      setBusyKey('');
    }
  };

  const action = async (reservation: Reservation, actionName: string) => {
    if (actionName === 'cancel' && !window.confirm(`Cancelar a reserva de ${reservation.name}?`)) return;
    await runOperation(`${reservation.id}:${actionName}`, () => fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName }),
    }), actionName === 'arrive' ? 'Chegada registrada.' : `Reserva atualizada: ${statusLabel(actionName === 'confirm' ? 'confirmed' : actionName === 'seat' ? 'seated' : actionName === 'complete' ? 'completed' : actionName === 'no_show' ? 'no_show' : 'cancelled')}.`);
  };

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const statusMatches: Record<string, string[]> = {
    pending: ['pending', 'pendente'],
    confirmed: ['confirmed', 'confirmado'],
    completed: ['completed', 'concluido'],
    cancelled: ['cancelled', 'cancelado'],
  };
  const visible = reservations.filter((item) => (
    (statusFilter === 'all' || (statusMatches[statusFilter] || [statusFilter]).includes(item.status.toLowerCase()))
    && `${item.name} ${item.whatsapp} ${item.reservation_time} ${item.status}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
  ));
  const receptionVisible = reservations.filter((item) => (
    `${item.name} ${item.whatsapp} ${item.reservation_time} ${item.status}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
  ));
  const awaitingArrival = receptionVisible.filter((item) => !item.arrived_at && ['pending', 'confirmed'].includes(item.status.toLowerCase()));
  const arrivedWaiting = receptionVisible.filter((item) => item.arrived_at && ['pending', 'confirmed'].includes(item.status.toLowerCase()));
  const seatedReservations = receptionVisible.filter((item) => item.status.toLowerCase() === 'seated');
  const receptionLanes = [
    { key: 'expected', title: 'Aguardando chegada', items: awaitingArrival },
    { key: 'arrived', title: 'Chegaram · aguardando mesa', items: arrivedWaiting },
    { key: 'seated', title: 'Sentados', items: seatedReservations },
  ];

  const submitWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await runOperation('waitlist:create', () => fetch('/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'waitlist', name: waitlistForm.name, phone: waitlistForm.phone, partySize: Number(waitlistForm.partySize), preferredAreaId: waitlistForm.preferredAreaId || null, notes: waitlistForm.notes }),
    }), 'Pessoa adicionada à lista de espera.');
    if (result) {
      setWaitlistForm({ name: '', phone: '', partySize: '2', preferredAreaId: '', notes: '' });
      setActiveEntryForm(null);
    }
  };

  const openWalkIn = (entry?: WaitlistEntry) => {
    setWalkInWaitlistId(entry?.id || '');
    setWalkInForm({ name: entry?.name || '', phone: entry?.phone || '', cpf: '', partySize: String(entry?.party_size || 2), time: currentLocalTime(), notes: entry?.notes || '' });
    setActiveEntryForm('walk-in');
  };

  const submitWalkIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    const result = await runOperation('walk-in:create', () => fetch('/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'walk_in', name: walkInForm.name, phone: walkInForm.phone, cpf: walkInForm.cpf, partySize: Number(walkInForm.partySize), date: data.date, time: walkInForm.time, notes: walkInForm.notes, ...(walkInWaitlistId ? { waitlistId: walkInWaitlistId } : {}) }),
    }), 'Chegada registrada. Agora indique uma mesa nos atendimentos do dia.');
    if (result) {
      setActiveEntryForm(null);
      setWalkInWaitlistId('');
    }
  };

  const updateWaitlist = async (entry: WaitlistEntry, actionName: string) => {
    const labels: Record<string, string> = { call_waitlist: 'Pessoa chamada para a mesa.', return_waitlist: 'Pessoa voltou para aguardando mesa.', leave_waitlist: 'Saída registrada.', cancel_waitlist: 'Cadastro removido da lista de espera.' };
    if (actionName === 'cancel_waitlist' && !window.confirm(`Remover ${entry.name} da lista de espera?`)) return;
    await runOperation(`${entry.id}:${actionName}`, () => fetch('/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, id: entry.id }),
    }), labels[actionName]);
  };

  const classifyReservation = async (issue: ClassificationIssue) => {
    const input = classifications[issue.id] || { turn: '', reason: '' };
    const result = await runOperation(`${issue.id}:classify`, () => fetch('/api/admin/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'classify_reservation_turn', reservationId: issue.id, commercialTurn: input.turn, reason: input.reason }),
    }), 'Turno histórico classificado.');
    if (result) setClassifications((current) => { const next = { ...current }; delete next[issue.id]; return next; });
  };

  if (!data) return <div className="space-y-4 p-8 text-sm">
    {loading ? <p>Carregando operação...</p> : <>
      <p>{loadError || 'Não foi possível carregar a operação.'}</p>
      <Button type="button" onClick={() => void load()}>Tentar novamente</Button>
    </>}
  </div>;

  return <div className="space-y-4 sm:space-y-6">
    <div className="rounded-2xl border border-[#D9CFC1] bg-white p-4 sm:rounded-3xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Operação de hoje</h2>
          <p className="break-words text-xs text-[#4A3728]/60 sm:text-sm">{formatDate(data.date)} · Recepção, mesas e capacidade por turno comercial.</p>
        </div>
        <Button type="button" onClick={() => void load()} disabled={refreshing} variant="secondary" size="icon" aria-label="Atualizar operação">
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#D9CFC1] bg-white px-3 sm:flex-row sm:items-center sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Search size={16} className="shrink-0 text-[#4A3728]/50" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone ou horário" className="min-w-0 border-0 bg-transparent shadow-none focus:ring-0" />
        </div>
        <Select aria-label="Filtrar reservas por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 w-full border-t border-[#D9CFC1]/60 bg-transparent py-2 sm:w-auto sm:max-w-40 sm:border-0 sm:text-xs">
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="confirmed">Confirmadas</option>
          <option value="seated">Sentadas</option>
          <option value="completed">Concluídas</option>
          <option value="no_show">Não compareceu</option>
          <option value="cancelled">Canceladas</option>
        </Select>
      </div>
      {(loadError || feedback) && <Feedback className="mt-3" tone={loadError ? 'error' : 'success'} role={loadError ? 'alert' : 'status'}>{feedback || loadError}</Feedback>}
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <Button type="button" aria-pressed={activeEntryForm === 'walk-in'} aria-expanded={activeEntryForm === 'walk-in'} aria-controls="walk-in-form" onClick={() => setActiveEntryForm((current) => current === 'walk-in' ? null : 'walk-in')} className="w-full uppercase tracking-wide sm:w-auto">Registrar pessoa sem reserva</Button>
        <Button type="button" variant="secondary" aria-pressed={activeEntryForm === 'waitlist'} aria-expanded={activeEntryForm === 'waitlist'} aria-controls="waitlist-form" onClick={() => setActiveEntryForm((current) => current === 'waitlist' ? null : 'waitlist')} className="w-full uppercase tracking-wide sm:w-auto">Adicionar à lista de espera</Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#4A3728]/60">Chegou sem reserva e já há mesa? Registre o atendimento. Se o grupo precisar esperar, adicione-o à lista de espera. Quando uma mesa liberar, chame o grupo e registre o atendimento.</p>
    </div>

    {activeEntryForm === 'walk-in' && <form id="walk-in-form" onSubmit={(event) => void submitWalkIn(event)} className="rounded-2xl border border-[#D9CFC1] bg-white p-4 sm:rounded-3xl sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-bold">{walkInWaitlistId ? 'Registrar atendimento da lista de espera' : 'Registrar chegada sem reserva'}</h3><Button type="button" variant="ghost" size="icon" onClick={() => setActiveEntryForm(null)} aria-label="Fechar formulário de chegada" title="Fechar"><X size={18} /></Button></div>
      <p className="mb-4 text-xs text-[#4A3728]/60">Use para registrar uma pessoa que chegou sem reserva ou um grupo da lista de espera que agora será atendido. Depois, indique a mesa nos atendimentos do dia.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Input required minLength={2} maxLength={120} value={walkInForm.name} onChange={(event) => setWalkInForm({ ...walkInForm, name: event.target.value })} placeholder="Nome" className="min-w-0" />
        <Input required type="tel" value={walkInForm.phone} onChange={(event) => setWalkInForm({ ...walkInForm, phone: event.target.value })} placeholder="Telefone / WhatsApp" className="min-w-0" />
        <Input type="text" inputMode="numeric" value={walkInForm.cpf} onChange={(event) => setWalkInForm({ ...walkInForm, cpf: event.target.value })} placeholder="CPF (opcional)" className="min-w-0" />
        <Input required type="number" min="1" max="30" value={walkInForm.partySize} onChange={(event) => setWalkInForm({ ...walkInForm, partySize: event.target.value })} aria-label="Quantidade de pessoas" className="min-w-0" />
        <Input required type="time" value={walkInForm.time} onChange={(event) => setWalkInForm({ ...walkInForm, time: event.target.value })} aria-label="Horário de chegada" className="min-w-0" />
        <Input value={walkInForm.notes} onChange={(event) => setWalkInForm({ ...walkInForm, notes: event.target.value })} maxLength={1000} placeholder="Observações (opcional)" className="min-w-0 sm:col-span-2" />
        <Button type="submit" disabled={busyKey === 'walk-in:create'} className="w-full uppercase sm:col-span-2 xl:col-span-1">{busyKey === 'walk-in:create' ? 'Registrando...' : 'Registrar chegada'}</Button>
      </div>
      <p className="mt-3 text-xs text-[#4A3728]/60">Este atendimento será registrado para {formatDate(data.date)}.</p>
    </form>}

    {activeEntryForm === 'waitlist' && <form id="waitlist-form" onSubmit={(event) => void submitWaitlist(event)} className="rounded-2xl border border-[#D9CFC1] bg-white p-4 sm:rounded-3xl sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-bold">Adicionar grupo à lista de espera</h3><Button type="button" variant="ghost" size="icon" onClick={() => setActiveEntryForm(null)} aria-label="Fechar formulário da lista de espera" title="Fechar"><X size={18} /></Button></div>
      <p className="mb-4 text-xs text-[#4A3728]/60">Use quando o grupo chegou, mas ainda não há mesa disponível. Quando uma mesa liberar, chame o grupo e registre o atendimento.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Input required minLength={2} maxLength={120} value={waitlistForm.name} onChange={(event) => setWaitlistForm({ ...waitlistForm, name: event.target.value })} placeholder="Nome" className="min-w-0" />
        <Input required type="tel" value={waitlistForm.phone} onChange={(event) => setWaitlistForm({ ...waitlistForm, phone: event.target.value })} placeholder="Telefone / WhatsApp" className="min-w-0" />
        <Input required type="number" min="1" max="30" value={waitlistForm.partySize} onChange={(event) => setWaitlistForm({ ...waitlistForm, partySize: event.target.value })} aria-label="Quantidade de pessoas" className="min-w-0" />
        <Select value={waitlistForm.preferredAreaId} onChange={(event) => setWaitlistForm({ ...waitlistForm, preferredAreaId: event.target.value })} className="min-w-0"><option value="">Qualquer área</option>{data.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</Select>
        <Input value={waitlistForm.notes} onChange={(event) => setWaitlistForm({ ...waitlistForm, notes: event.target.value })} maxLength={1000} placeholder="Observações (opcional)" className="min-w-0" />
        <Button type="submit" disabled={busyKey === 'waitlist:create'} className="w-full uppercase">{busyKey === 'waitlist:create' ? 'Adicionando...' : 'Adicionar à lista de espera'}</Button>
      </div>
    </form>}

    <section className="grid gap-3 sm:grid-cols-2">
      {(['lunch', 'dinner'] as const).map((turn) => {
        const slot = capacityByTurn.get(turn);
        const occupied = slot?.occupied_guests || 0;
        const full = slot?.has_unclassified_reservation || occupied >= 80;
        return <div key={turn} className="rounded-2xl border border-[#D9CFC1] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">{turn === 'lunch' ? 'Almoço' : 'Jantar'}</p>
            <span className={`text-xs font-bold ${full ? 'text-red-700' : 'text-[#4A3728]'}`}>{occupied} / 80</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EBE3D5]">
            <div className={`h-full ${full ? 'bg-red-600' : 'bg-[#4A3728]'}`} style={{ width: `${Math.min(100, occupied / 80 * 100)}%` }} />
          </div>
          {slot?.has_unclassified_reservation && <p className="mt-2 text-xs font-bold text-red-700">Há reserva histórica sem turno classificado.</p>}
        </div>;
      })}
    </section>

    <section aria-label="Acompanhamento da portaria" className="space-y-3">
      <div>
        <h3 className="text-lg font-bold">Portaria</h3>
        <p className="text-xs text-[#4A3728]/60">Acompanhe a chegada e o atendimento dos grupos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {receptionLanes.map((lane) => {
          const guests = lane.items.reduce((sum, item) => sum + item.num_guests, 0);
          return <section key={lane.key} className="overflow-hidden rounded-2xl border border-[#D9CFC1] bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9CFC1] p-3 sm:p-4">
              <h4 className="text-sm font-bold">{lane.title}</h4>
              <span className="rounded-full bg-[#F5F2ED] px-2.5 py-1 text-xs font-bold">{lane.items.length} grupos · {guests} pessoas</span>
            </header>
            {lane.items.length === 0 ? <p className="p-4 text-xs text-[#4A3728]/55">Nenhum grupo nesta etapa.</p> : lane.items.map((item) => {
              const itemStatus = item.status.toLowerCase();
              const assignments = assignmentsByReservation.get(item.id) || [];
              const busy = busyKey !== '';
              return <article key={item.id} className="border-b border-[#D9CFC1]/50 p-3 last:border-b-0 sm:p-4">
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0 break-words">
                    <p className="font-bold">{item.reservation_time.slice(0, 5)} · {item.name}</p>
              <p className="mt-1 text-xs text-[#4A3728]/65">{item.num_guests} pessoas · {item.source === 'walk_in' ? 'Chegou sem reserva' : 'Com reserva'}</p>
                    {item.arrived_at && <p className="mt-1 text-xs text-[#4A3728]/60">Chegou às {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Porto_Velho', hour: '2-digit', minute: '2-digit' }).format(new Date(item.arrived_at))}</p>}
                    {assignments.length > 0 && <p className="mt-1 text-xs font-bold text-[#4A3728]">Mesa: {assignments.map((assignment) => assignment.restaurant_tables?.code || assignment.table_id).join(', ')}</p>}
                  </div>
                  {lane.key === 'expected' && <Button type="button" disabled={busy} onClick={() => void action(item, 'arrive')} className="w-full">{busyKey === `${item.id}:arrive` ? 'Registrando…' : 'Registrar chegada'}</Button>}
                  {lane.key === 'arrived' && itemStatus === 'confirmed' && <Button type="button" disabled={busy} onClick={() => void action(item, 'seat')} className="w-full">Sentar</Button>}
                  {lane.key === 'arrived' && itemStatus === 'pending' && <Button type="button" variant="secondary" disabled={busy} onClick={() => void action(item, 'confirm')} className="w-full">Confirmar</Button>}
                  {lane.key === 'seated' && <Button type="button" variant="secondary" disabled={busy} onClick={() => void action(item, 'complete')} className="w-full">Finalizar</Button>}
                </div>
                {item.notes && <p className="mt-2 text-xs text-[#4A3728]/60">Obs.: {item.notes}</p>}
              </article>;
            })}
          </section>;
        })}
      </div>
    </section>

    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <MetricCard label="Reservas" value={reservations.length} />
      <MetricCard label="Pessoas com reserva" value={people} />
      <MetricCard label="Chegaram" value={reservations.filter((item) => item.arrived_at).length} />
      <MetricCard label="Sentadas" value={count(['seated'])} />
      <MetricCard label="Concluídas" value={count(['completed', 'concluido'])} tone="success" />
      <MetricCard label="Não compareceram" value={count(['no_show'])} tone="warning" />
      <MetricCard label="Canceladas" value={count(['cancelled', 'cancelado'])} tone="danger" />
      <MetricCard label="Lista de espera" value={data.waitlist.length} />
    </div>

    <section className="rounded-3xl border border-[#D9CFC1] bg-white">
      <header className="flex items-center justify-between border-b border-[#D9CFC1] p-5 font-bold"><span><Clock className="mr-2 inline" size={17} />Timeline</span><span className="text-xs font-normal text-[#4A3728]/60">{visible.length} de {reservations.length}</span></header>
      {visible.length === 0 ? <p className="p-6 text-sm text-[#4A3728]/60">{reservations.length ? 'Nenhuma reserva corresponde à busca ou ao filtro.' : 'Não há reservas para este dia.'}</p> : visible.map((item) => {
        const status = item.status.toLowerCase();
        const assignments = assignmentsByReservation.get(item.id) || [];
        const busy = busyKey !== '';
        return <article key={item.id} className="border-b border-[#D9CFC1]/50 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="font-bold">{item.reservation_time.slice(0, 5)} · {item.name}</span>
              <p className="mt-1 text-xs text-[#4A3728]/70">{item.num_guests} pessoas · {statusLabel(status)} · {item.source === 'walk_in' ? 'Chegou sem reserva' : 'Com reserva'}</p>
              <p className="mt-1 text-xs text-[#4A3728]/60">{item.whatsapp}{item.commercial_turn ? ` · ${item.commercial_turn === 'lunch' ? 'Almoço' : item.commercial_turn === 'dinner' ? 'Jantar' : item.commercial_turn}` : ''}</p>
              {item.arrived_at && <p className="mt-1 text-xs text-[#4A3728]/60">Chegada registrada às {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Porto_Velho', hour: '2-digit', minute: '2-digit' }).format(new Date(item.arrived_at))}</p>}
              {item.notes && <p className="mt-1 text-xs text-[#4A3728]/60">Obs.: {item.notes}</p>}
              {assignments.length > 0 && <p className="mt-1 text-xs font-bold text-[#4A3728]">Mesas: {assignments.map((assignment) => `${assignment.restaurant_tables?.restaurant_areas?.name || 'Área'} · ${assignment.restaurant_tables?.code || assignment.table_id}`).join(', ')}</p>}
            </div>
            <span className="text-xs text-[#4A3728]/50">{item.payment_status === 'paid' ? 'Pago' : item.payment_status === 'pending' ? 'Pagamento pendente' : ''}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status === 'pending' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void action(item, 'confirm')}>Confirmar</Button>}
            {!item.arrived_at && ['pending', 'confirmed'].includes(status) && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void action(item, 'arrive')}>Registrar chegada</Button>}
            {status === 'confirmed' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void action(item, 'seat')}>Sentar</Button>}
            {status === 'seated' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void action(item, 'complete')}>Finalizar</Button>}
            {status === 'confirmed' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void action(item, 'no_show')}>Não compareceu</Button>}
            {['pending', 'confirmed'].includes(status) && <Button variant="danger" size="sm" disabled={busy} onClick={() => void action(item, 'cancel')}>Cancelar</Button>}
            {['pending', 'confirmed', 'seated'].includes(status) && <Button type="button" variant="ghost" size="icon" onClick={() => setExpandedReservationId((current) => current === item.id ? '' : item.id)} title="Ver e alocar mesas" aria-label={`Alocar mesas para ${item.name}`}><TableProperties size={18} /></Button>}
          </div>
          {expandedReservationId === item.id && <ReservationTableAllocator reservationId={item.id} onSaved={() => void load(true)} />}
        </article>;
      })}
    </section>

    <section className="rounded-3xl border border-[#D9CFC1] bg-white">
      <header className="flex items-center justify-between border-b border-[#D9CFC1] p-5 font-bold"><span><Users className="mr-2 inline" size={17} />Lista de espera</span><span className="text-xs font-normal text-[#4A3728]/60">{data.waitlist.length}</span></header>
      <p className="px-5 pt-3 text-xs text-[#4A3728]/60">Aqui ficam os grupos que estão esperando mesa. Quando uma mesa liberar, clique em “Chamar para a mesa”. Quando o grupo vier, clique em “Registrar atendimento”; depois, indique a mesa.</p>
      {data.waitlist.length === 0 ? <p className="p-6 text-sm text-[#4A3728]/60">Ninguém aguardando mesa.</p> : data.waitlist.map((entry) => {
        const busy = busyKey !== '';
        const areaName = data.areas.find((area) => area.id === entry.preferred_area_id)?.name;
        return <div key={entry.id} className="border-b border-[#D9CFC1]/50 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{entry.name} · {entry.party_size} pessoas</p><p className="mt-1 text-xs text-[#4A3728]/60">{entry.phone} · {entry.status === 'called' ? 'Chamado para a mesa' : 'Aguardando mesa'}{areaName ? ` · Preferência: ${areaName}` : ''}</p>{entry.notes && <p className="mt-1 text-xs text-[#4A3728]/60">Obs.: {entry.notes}</p>}</div><span className="text-xs text-[#4A3728]/50">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Porto_Velho', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.created_at))}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.status === 'waiting' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void updateWaitlist(entry, 'call_waitlist')}>Chamar para a mesa</Button>}
            {entry.status === 'called' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void updateWaitlist(entry, 'return_waitlist')}>Voltar para aguardando</Button>}
            <Button size="sm" disabled={busy} onClick={() => openWalkIn(entry)}>Registrar atendimento</Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void updateWaitlist(entry, 'leave_waitlist')}>Registrar saída</Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void updateWaitlist(entry, 'cancel_waitlist')}>Remover da lista</Button>
          </div>
        </div>;
      })}
    </section>

    {data.classificationIssues.length > 0 && <section className="rounded-3xl border border-[#D9CFC1] bg-white">
      <header className="border-b border-[#D9CFC1] p-5 font-bold">Reservas sem turno classificado ({data.classificationIssues.length})</header>
      <p className="px-5 pt-4 text-xs text-[#4A3728]/60">A classificação exige revisão de um administrador. Escolha o turno confirmado pela equipe e registre o motivo.</p>
      {data.classificationIssues.map((issue) => {
        const value = classifications[issue.id] || { turn: '', reason: '' };
        return <div key={issue.id} className="grid gap-3 border-b border-[#D9CFC1]/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="font-bold">{formatDate(issue.reservation_date)}</p><p className="mt-1 text-xs text-[#4A3728]/60">{issue.reservation_time.slice(0, 5)} · {issue.num_guests} pessoas · {statusLabel(issue.status)}</p></div>
          <Select disabled={!data.canClassifyHistoricalReservations} value={value.turn} onChange={(event) => setClassifications((current) => ({ ...current, [issue.id]: { ...value, turn: event.target.value } }))}><option value="">Selecione o turno</option><option value="lunch">Almoço</option><option value="dinner">Jantar</option></Select>
          <Input disabled={!data.canClassifyHistoricalReservations} value={value.reason} onChange={(event) => setClassifications((current) => ({ ...current, [issue.id]: { ...value, reason: event.target.value } }))} maxLength={1000} placeholder="Motivo da revisão" />
          <Button disabled={!data.canClassifyHistoricalReservations || !value.turn || value.reason.trim().length < 3 || busyKey !== ''} onClick={() => void classifyReservation(issue)} className="uppercase">{data.canClassifyHistoricalReservations ? 'Classificar' : 'Somente administradores'}</Button>
        </div>;
      })}
    </section>}
  </div>;
}
