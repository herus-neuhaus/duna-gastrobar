'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Search, 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ChevronDown,
  CalendarDays,
  Printer,
  CalendarPlus,
  CalendarOff,
  TableProperties,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';
import { 
  format, 
  startOfToday, 
  startOfTomorrow, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  parseISO
} from 'date-fns';

import WhatsAppModal from '@/app/components/WhatsAppModal';
import AdminLayoutShell from './AdminLayoutShell';
import SpecialDatesManager from './SpecialDatesManager';
import BlockedDatesManager from './BlockedDatesManager';
import FuncionariosManager from './FuncionariosManager';
import TarefasManager from './TarefasManager';
import ProdutividadeDashboard from './ProdutividadeDashboard';
import DecorationsManager from './DecorationsManager';
import RestaurantManager from './RestaurantManager';
import ReservationTableAllocator from './ReservationTableAllocator';
import OperationsDashboard from './OperationsDashboard';
import FinanceDashboard from './FinanceDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { ReservationStatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/form-controls';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Card } from '@/components/ui/card';
import { Feedback } from '@/components/ui/feedback';
import { MetricCard } from '@/components/ui/metric-card';

type Reservation = Database['public']['Tables']['reservations']['Row'];
type ReservationStatus = 'confirmed' | 'cancelled' | 'seated' | 'completed' | 'no_show';
type Decoration = Pick<Database['public']['Tables']['decorations']['Row'], 'id' | 'name' | 'image_url'>;
type SpecialDate = Pick<Database['public']['Tables']['special_dates']['Row'], 'id' | 'date' | 'description' | 'requires_fee' | 'fee_amount' | 'included_guests'>;

function ReservationsView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // WhatsApp Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [allocatingReservationId, setAllocatingReservationId] = useState<string | null>(null);
  
  // Date states
  const [startDate, setStartDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [quickFilter, setQuickFilter] = useState('Hoje');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [supabase] = useState(createClient);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const fetchReservations = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('reservation_date', startDate)
      .lte('reservation_date', endDate)
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });

    if (error) {
      console.error('Error fetching reservations:', error);
    } else {
      setReservations(data || []);
    }
    if (!silent) setLoading(false);
  }, [supabase, startDate, endDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchReservations();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchReservations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchReservations(true);
      }
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [fetchReservations]);

  useEffect(() => {
    const channel = supabase
      .channel('reservations-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        void fetchReservations(true);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchReservations, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetch('/api/admin/decorations', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { decorations: [] })
        .then((result) => setDecorations(result.decorations || []));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateStatus = async (id: string, newStatus: ReservationStatus) => {
    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newStatus === 'confirmed' ? 'confirm' : newStatus === 'cancelled' ? 'cancel' : newStatus === 'seated' ? 'seat' : newStatus === 'completed' ? 'complete' : 'no_show',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a reserva.');

      setReservations((currentReservations) => currentReservations.map((reservation) => (
        reservation.id === id ? { ...reservation, status: newStatus } : reservation
      )));
      await fetchReservations(true);
    } catch (error) {
      alert('Erro ao atualizar status: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
    }
  };

  const openWhatsAppModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsWhatsAppModalOpen(true);
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = startOfToday();
    
    switch (filter) {
      case 'Hoje':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'Amanhã':
        const tomorrow = startOfTomorrow();
        setStartDate(format(tomorrow, 'yyyy-MM-dd'));
        setEndDate(format(tomorrow, 'yyyy-MM-dd'));
        break;
      case 'Semana':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        break;
      case 'Mês':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'Geral':
        setStartDate('2024-01-01');
        setEndDate('2030-12-31');
        break;
    }
    setShowDatePicker(false);
  };

  const activeReservations = reservations.filter(r => {
    const s = (r.status || 'pending').toLowerCase();
    return s !== 'cancelled' && s !== 'cancelado';
  });
  const totalReservations = activeReservations.length;
  
  const capacityReservations = reservations.filter((reservation) => (
    reservation.source !== 'walk_in' && !['cancelled', 'cancelado'].includes((reservation.status || 'pending').toLowerCase())
  ));
  const guestsByCommercialTurn = {
    lunch: capacityReservations.filter((reservation) => reservation.commercial_turn === 'lunch').reduce((sum, reservation) => sum + (reservation.num_guests || 0), 0),
    dinner: capacityReservations.filter((reservation) => reservation.commercial_turn === 'dinner').reduce((sum, reservation) => sum + (reservation.num_guests || 0), 0),
  };
  const pendingReservations = activeReservations.filter((reservation) => (
    (reservation.status || 'pending').toLowerCase() === 'pending'
  )).length;

  const reservationFilters = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'seated', label: 'Em atendimento' },
    { key: 'completed', label: 'Concluídas' },
    { key: 'no_show', label: 'Não compareceram' },
    { key: 'cancelled', label: 'Canceladas' },
  ];
  const matchesStatusFilter = (status: string | null, filter: string) => {
    const normalizedStatus = (status || 'pending').toLowerCase();
    if (filter === 'all') return true;
    if (filter === 'cancelled') return ['cancelled', 'cancelado'].includes(normalizedStatus);
    if (filter === 'completed') return ['completed', 'concluido'].includes(normalizedStatus);
    return normalizedStatus === filter;
  };
  const filteredReservations = reservations.filter((reservation) => {
    const matchesStatus = matchesStatusFilter(reservation.status, statusFilter);
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-BR');
    const normalizedPhoneSearch = normalizedSearch.replace(/\D/g, '');
    const matchesSearch = !normalizedSearch
      || reservation.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || (normalizedPhoneSearch.length > 0 && reservation.whatsapp.replace(/\D/g, '').includes(normalizedPhoneSearch))
      || (reservation.email || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string | null) => <ReservationStatusBadge status={status} />;

  const getDecoration = (decorationId: string | null) => decorations.find((decoration) => decoration.id === decorationId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Date Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative" ref={datePickerRef}>
          <button 
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            aria-expanded={showDatePicker}
            aria-haspopup="dialog"
            aria-label={`Selecionar período. Período atual: ${quickFilter === 'Personalizado' ? `${startDate} até ${endDate}` : quickFilter}`}
            className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-[#D9CFC1] hover:border-[#4A3728] transition-all w-full lg:w-auto"
          >
            <CalendarDays size={20} className="text-[#4A3728]/60" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-tighter text-[#4A3728]/40 leading-none mb-1">Período Selecionado</p>
              <p className="text-xs font-bold whitespace-nowrap">
                {quickFilter === 'Personalizado' 
                  ? `${startDate ? format(parseISO(startDate), 'dd/MM') : '--/--'} até ${endDate ? format(parseISO(endDate), 'dd/MM') : '--/--'}`
                  : quickFilter
                }
              </p>
            </div>
            <ChevronDown size={16} className={`ml-2 text-[#4A3728]/40 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
          </button>

          {showDatePicker && (
            <div role="dialog" aria-label="Filtros de período" className="absolute left-0 top-full z-40 mt-2 w-full rounded-3xl border border-[#D9CFC1] bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 lg:w-80">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {['Hoje', 'Amanhã', 'Semana', 'Mês', 'Geral'].map(f => (
                  <Button
                    type="button"
                    key={f}
                    onClick={() => handleQuickFilter(f)}
                    aria-pressed={quickFilter === f}
                    variant={quickFilter === f ? 'primary' : 'secondary'}
                    size="sm"
                    className="py-2.5 uppercase tracking-widest"
                  >
                    {f}
                  </Button>
                ))}
              </div>
              
              <div className="pt-4 border-t border-[#D9CFC1]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/40 mb-3 px-1">Personalizado</p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reservations-start-date" className="text-[9px] font-bold uppercase text-[#4A3728]/60 ml-1">Início</label>
                    <Input
                      id="reservations-start-date"
                      type="date" 
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setQuickFilter('Personalizado');
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reservations-end-date" className="text-[9px] font-bold uppercase text-[#4A3728]/60 ml-1">Fim</label>
                    <Input
                      id="reservations-end-date"
                      type="date" 
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setQuickFilter('Personalizado');
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <label className="sr-only" htmlFor="reservation-search">Buscar reservas por nome, telefone ou e-mail</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4A3728]/40" size={18} />
          <Input
            id="reservation-search"
            type="text" 
            placeholder="Nome, telefone ou e-mail"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-h-12 rounded-2xl pl-12 pr-12 shadow-sm"
          />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#76695e] hover:bg-[#F5F2ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a684d]"><X size={16} /></button>}
        </div>
        <Button
          type="button"
          onClick={() => window.print()}
          variant="secondary"
          size="lg"
          className="rounded-2xl uppercase tracking-widest"
        >
          <Printer size={16} /> Exportar PDF
        </Button>
      </div>

      <section aria-label="Filtrar reservas por status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {reservationFilters.map((filter) => {
          const count = reservations.filter((reservation) => matchesStatusFilter(reservation.status, filter.key)).length;
          return <Button
            key={filter.key}
            type="button"
            variant={statusFilter === filter.key ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={statusFilter === filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className="shrink-0 rounded-full"
          >
            {filter.label}<span aria-label={`${count} reservas`} className={statusFilter === filter.key ? 'text-white/70' : 'text-[#76695e]'}>{count}</span>
          </Button>;
        })}
      </section>
      <p className="-mt-4 text-xs text-[#76695e]" aria-live="polite">
        Exibindo <strong className="text-[#4A3728]">{filteredReservations.length}</strong> de {reservations.length} reservas no período.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Reservas no período" value={loading ? '…' : totalReservations} icon={<CalendarIcon size={20} />} />
        <Card className="p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="p-2.5 bg-[#F5F2ED] rounded-xl text-[#4A3728]"><Users size={20} /></div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A3728]/50">Pessoas por turno {startDate !== endDate && '(período)'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['lunch', 'dinner'] as const).map((turn) => {
              const guests = guestsByCommercialTurn[turn];
              return <div key={turn}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[9px] font-bold uppercase text-[#4A3728]/60">{turn === 'lunch' ? 'Almoço' : 'Jantar'}</span>
                  <span className={`text-lg font-serif font-bold ${guests >= 80 ? 'text-red-600' : 'text-[#4A3728]'}`}>{loading ? '…' : guests}<small className="ml-1 text-[9px] font-medium text-[#4A3728]/40">/ 80</small></span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EBE3D5]">
                  <div className={`h-full ${guests >= 80 ? 'bg-red-500' : guests >= 60 ? 'bg-amber-500' : 'bg-[#4A3728]'}`} style={{ width: `${Math.min(100, guests / 80 * 100)}%` }} />
                </div>
              </div>;
            })}
          </div>
        </Card>
        <MetricCard label="Aguardando confirmação" value={loading ? '…' : pendingReservations} icon={<AlertCircle size={20} />} tone={pendingReservations ? 'warning' : 'default'} />
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
            <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
            <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando reservas...</p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="ui-card shadow-sm">
            <EmptyState
              icon={<AlertCircle size={32} />}
              title={reservations.length ? 'Nenhuma reserva corresponde aos filtros' : 'Nenhuma reserva neste período'}
              description={reservations.length ? 'Tente mudar o status ou limpar a busca.' : 'Escolha outro período para consultar reservas.'}
              action={(searchTerm || statusFilter !== 'all') ? <Button type="button" variant="secondary" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>Limpar filtros</Button> : undefined}
            />
          </div>
        ) : (
          <>
            {/* Desktop View (Tabela) */}
            <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-[#D9CFC1] overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#F5F2ED] text-[#4A3728]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Cliente</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Data & Hora</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Pessoas</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9CFC1]/40">
                  {filteredReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-[#FDFBF7] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{res.name}</span>
                          <span className="text-[11px] text-[#4A3728]/50 mt-0.5">{res.whatsapp}</span>
                          {res.notes && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 w-fit px-2 py-0.5 rounded-lg">
                              <AlertCircle size={10} />
                              {res.notes}
                            </div>
                          )}
                          {getDecoration(res.decoration_id) && (
                            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-[#4A3728]">
                              <Image src={getDecoration(res.decoration_id)!.image_url} alt="" width={28} height={28} unoptimized className="size-7 rounded-lg object-cover" />
                              {getDecoration(res.decoration_id)?.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-[13px]">{format(parseISO(res.reservation_date), 'dd/MM/yyyy')}</span>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#4A3728]/60 mt-1">
                            <Clock size={12} /> {res.reservation_time.slice(0, 5)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className="font-bold text-lg">{res.num_guests}</span>
                          {res.num_guests && res.num_guests >= 15 && (
                            <span className="bg-amber-100 text-amber-800 text-[8px] uppercase font-bold tracking-tighter px-1.5 py-0.5 rounded border border-amber-200">Grupo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(res.status)}
                      </td>
                      <td className="px-6 py-5">
                        <ReservationActions
                          reservation={res}
                          allocating={allocatingReservationId === res.id}
                          onStatusChange={updateStatus}
                          onAllocateTables={() => setAllocatingReservationId(allocatingReservationId === res.id ? null : res.id)}
                          onWhatsApp={() => openWhatsAppModal(res)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allocatingReservationId && <ReservationTableAllocator reservationId={allocatingReservationId} onSaved={() => void fetchReservations(true)} />}

            {/* Mobile View (Cards) */}
            <div className="lg:hidden space-y-4">
              {filteredReservations.map((res) => (
                <div key={res.id} className={`bg-white rounded-3xl p-5 shadow-sm border ${res.num_guests && res.num_guests >= 15 ? 'border-amber-200' : 'border-[#D9CFC1]'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-base leading-tight">{res.name}</h3>
                      <p className="text-xs text-[#4A3728]/50 mt-1 font-medium">{res.whatsapp}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end text-[#4A3728] font-bold">
                        <Users size={16} />
                        <span className="text-lg">{res.num_guests}</span>
                      </div>
                      {res.num_guests && res.num_guests >= 15 && (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Reserva de Grupo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-3 border-y border-[#D9CFC1]/40 mb-4">
                    <div className="flex flex-col">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/40 mb-0.5">Data</p>
                      <p className="text-xs font-bold">{format(parseISO(res.reservation_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="w-px h-6 bg-[#D9CFC1]/40"></div>
                    <div className="flex flex-col">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/40 mb-0.5">Horário</p>
                      <p className="text-xs font-bold">{res.reservation_time.slice(0, 5)}</p>
                    </div>
                    <div className="flex-1 text-right">
                      {getStatusBadge(res.status)}
                    </div>
                  </div>

                  {res.notes && (
                    <div className="mb-4 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700 mb-1">Observações</p>
                      <p className="text-[11px] leading-relaxed text-amber-900">{res.notes}</p>
                    </div>
                  )}
                  {getDecoration(res.decoration_id) && (
                    <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#F5F2ED] p-3 text-[11px] font-bold text-[#4A3728]">
                      <Image src={getDecoration(res.decoration_id)!.image_url} alt="" width={36} height={36} unoptimized className="size-9 rounded-xl object-cover" />
                      {getDecoration(res.decoration_id)?.name}
                    </div>
                  )}

                  <ReservationActions
                    reservation={res}
                    allocating={allocatingReservationId === res.id}
                    compact
                    onStatusChange={updateStatus}
                    onAllocateTables={() => setAllocatingReservationId(allocatingReservationId === res.id ? null : res.id)}
                    onWhatsApp={() => openWhatsAppModal(res)}
                  />
                  {allocatingReservationId === res.id && <ReservationTableAllocator reservationId={res.id} onSaved={() => void fetchReservations(true)} />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        customerName={selectedReservation?.name || ''}
        customerPhone={selectedReservation?.whatsapp || ''}
      />
    </div>
  );
}

function ReservationActions({
  reservation,
  allocating = false,
  compact = false,
  onStatusChange,
  onAllocateTables,
  onWhatsApp,
}: {
  reservation: Reservation;
  allocating?: boolean;
  compact?: boolean;
  onStatusChange: (id: string, status: ReservationStatus) => Promise<void>;
  onAllocateTables: () => void;
  onWhatsApp: () => void;
}) {
  const status = (reservation.status || 'pending').toLowerCase();
  const actions: { label: string; icon: React.ReactNode; variant: 'primary' | 'secondary' | 'danger' | 'success'; onClick: () => void; show: boolean }[] = [
    { label: 'Confirmar', icon: <CheckCircle size={18} />, variant: 'success', onClick: () => void onStatusChange(reservation.id, 'confirmed'), show: status === 'pending' },
    { label: 'Cancelar', icon: <XCircle size={18} />, variant: 'danger', onClick: () => void onStatusChange(reservation.id, 'cancelled'), show: ['pending', 'confirmed'].includes(status) },
    { label: 'Registrar chegada', icon: <Users size={18} />, variant: 'secondary', onClick: () => void onStatusChange(reservation.id, 'seated'), show: status === 'confirmed' },
    { label: 'Não compareceu', icon: <CalendarOff size={18} />, variant: 'secondary', onClick: () => void onStatusChange(reservation.id, 'no_show'), show: status === 'confirmed' },
    { label: 'Finalizar', icon: <CheckCircle size={18} />, variant: 'primary', onClick: () => void onStatusChange(reservation.id, 'completed'), show: status === 'seated' },
  ];
  const visibleActions = actions.filter((action) => action.show);

  return <div className={compact ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'flex justify-end gap-2'}>
    {visibleActions.map((action) => <Button
      key={action.label}
      type="button"
      variant={action.variant}
      size={compact ? 'md' : 'icon'}
      onClick={action.onClick}
      title={action.label}
      aria-label={`${action.label}: ${reservation.name}`}
      className={compact ? 'min-h-14 flex-col gap-1.5 rounded-2xl px-2 py-2 text-[9px] uppercase leading-tight' : ''}
    >
      {action.icon}{compact && <span>{action.label}</span>}
    </Button>)}
    <Button
      type="button"
      variant={allocating ? 'primary' : 'secondary'}
      size={compact ? 'md' : 'icon'}
      onClick={onAllocateTables}
      aria-pressed={allocating}
      aria-label={`${allocating ? 'Fechar alocação de mesas' : 'Alocar mesas'}: ${reservation.name}`}
      title={allocating ? 'Fechar alocação de mesas' : 'Alocar mesas'}
      className={compact ? 'min-h-14 flex-col gap-1.5 rounded-2xl px-2 py-2 text-[9px] uppercase leading-tight' : ''}
    >
      <TableProperties size={18} />{compact && <span>Mesas</span>}
    </Button>
    <Button
      type="button"
      variant="secondary"
      size={compact ? 'md' : 'icon'}
      onClick={onWhatsApp}
      aria-label={`Enviar mensagem para ${reservation.name} pelo WhatsApp`}
      title="WhatsApp"
      className={compact ? 'min-h-14 flex-col gap-1.5 rounded-2xl px-2 py-2 text-[9px] uppercase leading-tight' : ''}
    >
      <MessageCircle size={18} />{compact && <span>WhatsApp</span>}
    </Button>
  </div>;
}

function NewReservationView() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    cpf: '',
    date: format(startOfTomorrow(), 'yyyy-MM-dd'),
    time: '19:00',
    guests: '2',
    notes: '',
    decorationId: '',
    specialDateId: '',
    capacityOverrideReason: '',
    scheduleOverrideReason: '',
    commercialTurn: 'dinner',
  });
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const guests = Number(form.guests);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetch('/api/admin/decorations', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { decorations: [] })
        .then((result) => setDecorations(result.decorations || []));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadSpecialDates = async () => {
      try {
        const response = await fetch(`/api/reservations/availability?from=${form.date}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        const datesForSelection = (result.specialDates || []).filter((specialDate: SpecialDate) => specialDate.date === form.date);
        setSpecialDates(datesForSelection);
        setForm((currentForm) => ({
          ...currentForm,
          specialDateId: datesForSelection.length === 1
            ? datesForSelection[0].id
            : datesForSelection.some((specialDate: SpecialDate) => specialDate.id === currentForm.specialDateId)
              ? currentForm.specialDateId
              : '',
        }));
      } catch (error) {
        if (!controller.signal.aborted) setSpecialDates([]);
      }
    };

    void loadSpecialDates();
    return () => controller.abort();
  }, [form.date]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setMessage('');
  };

  const createReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          cpf: form.cpf,
          date: form.date,
          time: form.time,
          guests,
          notes: form.notes,
          decorationId: form.decorationId || null,
          specialDateId: form.specialDateId || null,
          capacityOverrideReason: form.capacityOverrideReason || null,
          scheduleOverrideReason: form.scheduleOverrideReason || null,
          commercialTurn: form.scheduleOverrideReason ? form.commercialTurn : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a reserva.');

      setMessage('Reserva criada como pendente e disponível no monitor.');
      setForm((currentForm) => ({ ...currentForm, name: '', email: '', whatsapp: '', cpf: '', notes: '', decorationId: '', specialDateId: currentForm.specialDateId, capacityOverrideReason: '', scheduleOverrideReason: '' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl p-5 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-7 flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F2ED] text-[#4A3728]"><CalendarPlus size={22} /></div>
        <div>
          <h3 className="font-serif text-xl font-bold text-[#4A3728]">Criar reserva</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#4A3728]/60">Registre uma reserva feita presencialmente ou pelo WhatsApp. As mesmas regras de disponibilidade e capacidade do site são aplicadas.</p>
        </div>
      </div>

      <form onSubmit={createReservation} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Cliente</span>
          <Input required value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Nome completo" />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">WhatsApp</span>
          <Input required type="tel" value={form.whatsapp} onChange={(event) => updateField('whatsapp', event.target.value)} placeholder="(69) 99999-9999" />
        </label>
        {specialDates.length > 0 && <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Evento especial</span>
          <Select value={form.specialDateId} onChange={(event) => updateField('specialDateId', event.target.value)} required={specialDates.length > 1}>
            {specialDates.length > 1 && <option value="">Selecione o evento</option>}
            {specialDates.map((specialDate) => <option key={specialDate.id} value={specialDate.id}>{specialDate.description || 'Evento especial'}{specialDate.included_guests ? ` (${specialDate.included_guests} pessoas)` : ''}{specialDate.requires_fee ? ` - Taxa R$ ${Number(specialDate.fee_amount || 0).toFixed(2)}` : ''}</option>)}
          </Select>
        </label>}
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">E-mail (opcional)</span>
          <Input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="cliente@email.com" />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Data</span>
          <Input required type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Horário</span>
          <Input required type="time" value={form.time} onChange={(event) => updateField('time', event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Pessoas</span>
          <Input required type="number" min="1" max="30" value={form.guests} onChange={(event) => updateField('guests', event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">CPF do cliente</span>
          <Input required inputMode="numeric" value={form.cpf} onChange={(event) => updateField('cpf', event.target.value)} placeholder="000.000.000-00" />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Ocasião ou observação</span>
          <Textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} maxLength={1000} placeholder="Ex.: Aniversário" />
        </label>
        <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800">Exceções autorizadas</p>
          <p className="mt-1 text-xs text-amber-900/70">Somente o dono pode registrar uma exceção. O motivo e o efeito ficam auditados.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-amber-900/70">Exceder capacidade</span>
              <Input value={form.capacityOverrideReason} onChange={(event) => updateField('capacityOverrideReason', event.target.value)} maxLength={1000} className="border-amber-200 focus:border-amber-700" placeholder="Motivo obrigatório" />
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-amber-900/70">Fora do horário</span>
              <Input value={form.scheduleOverrideReason} onChange={(event) => updateField('scheduleOverrideReason', event.target.value)} maxLength={1000} className="border-amber-200 focus:border-amber-700" placeholder="Motivo obrigatório" />
            </label>
            {form.scheduleOverrideReason && <label>
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-amber-900/70">Turno de referência</span>
              <Select value={form.commercialTurn} onChange={(event) => updateField('commercialTurn', event.target.value)} className="border-amber-200 focus:border-amber-700">
                <option value="lunch">Almoço</option>
                <option value="dinner">Jantar</option>
              </Select>
            </label>}
          </div>
        </div>
        {decorations.length > 0 && <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60">Decoração</span>
          <Select value={form.decorationId} onChange={(event) => updateField('decorationId', event.target.value)}>
            <option value="">Sem decoração</option>
            {decorations.map((decoration) => <option key={decoration.id} value={decoration.id}>{decoration.name}</option>)}
          </Select>
        </label>}
        {message && <Feedback className="sm:col-span-2" tone={message.startsWith('Reserva criada') ? 'success' : 'error'}>{message}</Feedback>}
        <Button disabled={isSubmitting} size="lg" className="sm:col-span-2 w-full rounded-2xl uppercase tracking-widest">
          {isSubmitting && <Loader2 className="animate-spin" size={16} />} Criar reserva pendente
        </Button>
      </form>
    </Card>
  );
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'reservations';
  const pageContent: Record<string, { title: string; description: string }> = {
    reservations: { title: 'Monitor de Reservas', description: 'Acompanhe as reservas do dia.' },
    operations: { title: 'Operação do dia', description: 'Organize chegadas, atendimento e lista de espera.' },
    restaurant: { title: 'Áreas e mesas', description: 'Configure os espaços e a capacidade das mesas.' },
    new_reservation: { title: 'Criar reserva', description: 'Registre reservas feitas diretamente pela equipe.' },
    decorations: { title: 'Espaços e decorações', description: 'Cadastre os espaços e decorações disponíveis para os clientes.' },
    special_dates: { title: 'Datas especiais', description: 'Configure datas com taxas de reserva antecipadas.' },
    blocked_dates: { title: 'Datas bloqueadas', description: 'Bloqueie reservas para datas específicas.' },
    funcionarios: { title: 'Gestão de equipe', description: 'Gerencie funcionários, cargos e permissões.' },
    tarefas: { title: 'Gestão de tarefas', description: 'Crie e organize tarefas e checklists.' },
    produtividade: { title: 'Painel de produtividade', description: 'Monitore a execução das tarefas e aprove conclusões.' },
    finance: { title: 'Financeiro', description: 'Acompanhe pagamentos, confirmações e valores recebidos.' },
  };
  const page = pageContent[view] || pageContent.reservations;

  return (
    <AdminLayoutShell activeItem={view}>
      <div className="min-w-0 space-y-6 p-4 sm:p-6 xl:p-8 2xl:p-10">
        <PageHeader title={page.title} description={page.description} />
        {view === 'reservations' && <ReservationsView />}
         {view === 'new_reservation' && <NewReservationView />}
         {view === 'decorations' && <DecorationsManager />}
         {view === 'restaurant' && <RestaurantManager />}
         {view === 'operations' && <OperationsDashboard />}
        {view === 'special_dates' && <SpecialDatesManager />}
        {view === 'blocked_dates' && <BlockedDatesManager />}
        {view === 'funcionarios' && <FuncionariosManager />}
        {view === 'tarefas' && <TarefasManager />}
         {view === 'produtividade' && <ProdutividadeDashboard />}
         {view === 'finance' && <FinanceDashboard />}
      </div>
    </AdminLayoutShell>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-[#4A3728] animate-spin" />
    </div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
