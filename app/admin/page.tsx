'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  DollarSign, 
  Search, 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ChevronDown,
  CalendarDays
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

type Reservation = Database['public']['Tables']['reservations']['Row'];
type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

function ReservationsView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // WhatsApp Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Date states
  const [startDate, setStartDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [quickFilter, setQuickFilter] = useState('Hoje');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const supabase = createClient();
  const datePickerRef = useRef<HTMLDivElement>(null);

  const fetchReservations = React.useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, [supabase, startDate, endDate]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

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
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      setReservations(reservations.map(res => res.id === id ? { ...res, status: newStatus } : res));
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

  const totalReservations = reservations.length;
  const activeReservations = reservations.filter(r => {
    const s = (r.status || 'pending').toLowerCase();
    return s !== 'cancelled' && s !== 'cancelado';
  });
  
  const totalGuests = activeReservations.reduce((acc, curr) => acc + (curr.num_guests || 0), 0);
  const pendingPayments = activeReservations.filter(r => r.num_guests && r.num_guests >= 15 && r.payment_status === 'pending').length;

  const filteredReservations = reservations.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || res.whatsapp.includes(searchTerm);
    return matchesSearch;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-green-200">Confirmado</span>;
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-amber-200">Pendente</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-red-200">Cancelado</span>;
      case 'completed':
        return <span className="px-2.5 py-1 bg-[#EBE3D5] text-[#4A3728] rounded-md text-[10px] font-bold uppercase tracking-wider border border-[#D9CFC1]">Concluído</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Date Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative" ref={datePickerRef}>
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
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
            <div className="absolute top-full left-0 mt-2 w-full lg:w-80 bg-white rounded-3xl shadow-2xl border border-[#D9CFC1] p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {['Hoje', 'Amanhã', 'Semana', 'Mês', 'Geral'].map(f => (
                  <button 
                    key={f}
                    onClick={() => handleQuickFilter(f)}
                    className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${quickFilter === f ? 'bg-[#4A3728] text-white' : 'bg-[#F5F2ED] text-[#4A3728] hover:bg-[#EBE3D5]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              
              <div className="pt-4 border-t border-[#D9CFC1]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/40 mb-3 px-1">Personalizado</p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase text-[#4A3728]/60 ml-1">Início</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setQuickFilter('Personalizado');
                      }}
                      className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-[#4A3728]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase text-[#4A3728]/60 ml-1">Fim</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setQuickFilter('Personalizado');
                      }}
                      className="w-full bg-[#F5F2ED] border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-[#4A3728]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A3728]/30" size={18} />
          <input 
            type="text" 
            placeholder="Buscar cliente ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#D9CFC1] rounded-2xl text-sm shadow-sm focus:outline-none focus:border-[#4A3728] focus:ring-1 focus:ring-[#4A3728] placeholder:text-[#4A3728]/30 transition-all"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-[#D9CFC1] flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><CalendarIcon size={20} strokeWidth={2.5} /></div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/50">Reservas</p>
            <p className="text-2xl font-bold">{loading ? '...' : totalReservations}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-[#D9CFC1] flex items-center gap-4">
            <div className="flex items-center gap-4 w-full">
              <div className="p-3 bg-[#F5F2ED] rounded-2xl text-[#4A3728]">
                <Users size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A3728]/50 mb-1">Total Pessoas</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-serif font-bold ${(startDate === endDate && totalGuests >= 80) ? 'text-red-600' : 'text-[#4A3728]'}`}>
                    {loading ? '...' : totalGuests}
                  </span>
                  {startDate === endDate ? (
                    <span className="text-[10px] text-[#4A3728]/40 mb-1.5 font-medium">/ 80 limite</span>
                  ) : (
                    <span className="text-[10px] text-[#4A3728]/40 mb-1.5 font-medium">(80 limite/dia)</span>
                  )}
                </div>
                {/* Barra de progresso de capacidade (apenas para um único dia) */}
                {startDate === endDate && (
                  <div className="mt-2 w-full h-1.5 bg-[#EBE3D5] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${totalGuests >= 80 ? 'bg-red-500' : totalGuests >= 60 ? 'bg-amber-500' : 'bg-[#4A3728]'}`}
                      style={{ width: `${Math.min((totalGuests / 80) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
        </div>
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-[#D9CFC1] flex items-center gap-4">
          <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${pendingPayments > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-[#F5F2ED] text-[#4A3728]'}`}>
            <DollarSign size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/50">Pendentes (15+)</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{loading ? '...' : pendingPayments}</p>
              {pendingPayments > 0 && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
            <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
            <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando reservas...</p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
            <AlertCircle size={40} className="mx-auto text-[#4A3728]/10 mb-4" />
            <p className="text-sm font-bold text-[#4A3728]/40">Nenhuma reserva encontrada para este período.</p>
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
                        <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => updateStatus(res.id, 'confirmed')}
                            className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors"
                            title="Confirmar"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => updateStatus(res.id, 'cancelled')}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors"
                            title="Cancelar"
                          >
                            <XCircle size={18} />
                          </button>
                          <button 
                            onClick={() => openWhatsAppModal(res)}
                            className="p-2 text-[#4A3728] bg-[#F5F2ED] hover:bg-[#EBE3D5] rounded-xl border border-[#D9CFC1] transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => updateStatus(res.id, 'confirmed')}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-green-50 text-green-700 border border-green-100 active:scale-95 transition-all"
                    >
                      <CheckCircle size={18} />
                      <span className="text-[9px] font-bold uppercase">Confirmar</span>
                    </button>
                    <button 
                      onClick={() => updateStatus(res.id, 'cancelled')}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-red-50 text-red-700 border border-red-100 active:scale-95 transition-all"
                    >
                      <XCircle size={18} />
                      <span className="text-[9px] font-bold uppercase">Cancelar</span>
                    </button>
                    <button 
                      onClick={() => openWhatsAppModal(res)}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#F5F2ED] text-[#4A3728] border border-[#D9CFC1] active:scale-95 transition-all"
                    >
                      <MessageCircle size={18} />
                      <span className="text-[9px] font-bold uppercase">WhatsApp</span>
                    </button>
                  </div>
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

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'reservations';

  return (
    <AdminLayoutShell activeItem={view}>
      <header className="p-6 lg:p-10 pb-0 flex flex-col gap-2">
        <h2 className="text-3xl font-serif font-bold uppercase tracking-tight text-[#4A3728]">
          {view === 'reservations' && 'Monitor de Reservas'}
          {view === 'special_dates' && 'Gestão de Datas Especiais'}
          {view === 'blocked_dates' && 'Datas Bloqueadas'}
          {view === 'funcionarios' && 'Gestão de Equipe'}
          {view === 'tarefas' && 'Gestão de Tarefas'}
          {view === 'produtividade' && 'Painel de Produtividade'}
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/50">
          {view === 'reservations' && 'Acompanhe as reservas do dia'}
          {view === 'special_dates' && 'Configure datas com taxas de reserva antecipadas'}
          {view === 'blocked_dates' && 'Bloqueie reservas para datas específicas'}
          {view === 'funcionarios' && 'Gerencie funcionários e cargos'}
          {view === 'tarefas' && 'Crie e organize tarefas e checklists'}
          {view === 'produtividade' && 'Monitore a execução das tarefas e aprove conclusões'}
        </p>
      </header>
      <div className="p-6 lg:p-10">
        {view === 'reservations' && <ReservationsView />}
        {view === 'special_dates' && <SpecialDatesManager />}
        {view === 'blocked_dates' && <BlockedDatesManager />}
        {view === 'funcionarios' && <FuncionariosManager />}
        {view === 'tarefas' && <TarefasManager />}
        {view === 'produtividade' && <ProdutividadeDashboard />}
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
