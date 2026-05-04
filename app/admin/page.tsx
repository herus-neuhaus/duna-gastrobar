'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Search, MessageCircle, CheckCircle, XCircle, Clock, AlertCircle, LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';

type Reservation = Database['public']['Tables']['reservations']['Row'];
type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('Hoje');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchReservations();
  }, [dateFilter]);

  const fetchReservations = async () => {
    setLoading(true);
    let query = supabase
      .from('reservations')
      .select('*')
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });

    // Simple date filtering logic
    const today = new Date().toISOString().split('T')[0];
    if (dateFilter === 'Hoje') {
      query = query.eq('reservation_date', today);
    } else if (dateFilter === 'Amanhã') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      query = query.eq('reservation_date', tomorrow.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reservations:', error);
    } else {
      setReservations(data || []);
    }
    setLoading(false);
  };

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const totalReservations = reservations.filter(r => r.status !== 'cancelled').length;
  const totalGuests = reservations.filter(r => r.status !== 'cancelled').reduce((acc, curr) => acc + curr.num_guests, 0);
  const pendingPayments = reservations.filter(r => r.num_guests >= 15 && r.payment_status === 'pending').length;

  const filteredReservations = reservations.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || res.whatsapp.includes(searchTerm);
    return matchesSearch;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold uppercase tracking-wider border border-green-200">Confirmado</span>;
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-bold uppercase tracking-wider border border-amber-200">Pendente</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold uppercase tracking-wider border border-red-200">Cancelado</span>;
      case 'completed':
        return <span className="px-2.5 py-1 bg-[#EBE3D5] text-[#4A3728] rounded-md text-xs font-bold uppercase tracking-wider border border-[#D9CFC1]">Concluído</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-md text-xs font-bold uppercase tracking-wider border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728] p-4 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold tracking-wide">Duna Cozinha & Bar</h1>
          <p className="text-sm font-medium tracking-widest uppercase opacity-70 mt-1">Controle de Reservas</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-sm font-bold uppercase tracking-wider bg-white px-5 py-3 rounded-xl shadow-sm border border-[#D9CFC1] flex items-center gap-2 flex-1 sm:flex-none">
            <Calendar size={16} />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <button 
            onClick={handleLogout}
            className="p-3 bg-white text-red-500 rounded-xl shadow-sm border border-[#D9CFC1] hover:bg-red-50 transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className="w-14 h-14 flex items-center justify-center bg-[#EBE3D5] text-[#4A3728] rounded-xl"><Calendar size={24} strokeWidth={2.5} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Total de Reservas ({dateFilter})</p>
            <p className="text-3xl font-bold">{loading ? '...' : totalReservations}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className="w-14 h-14 flex items-center justify-center bg-[#EBE3D5] text-[#4A3728] rounded-xl"><Users size={24} strokeWidth={2.5} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Pessoas Esperadas</p>
            <p className="text-3xl font-bold">{loading ? '...' : totalGuests}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className={`w-14 h-14 flex items-center justify-center rounded-xl ${pendingPayments > 0 ? 'bg-red-100 text-red-600' : 'bg-[#EBE3D5] text-[#4A3728]'}`}>
            <DollarSign size={24} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Pagos Pendentes (15+)</p>
            <p className="text-3xl font-bold flex items-center gap-2">
              {loading ? '...' : pendingPayments}
              {pendingPayments > 0 && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#D9CFC1] overflow-hidden flex flex-col">
        
        {/* Filters bar */}
        <div className="p-5 border-b border-[#D9CFC1] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#FDFBF7]">
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {['Hoje', 'Amanhã', 'Geral'].map(filter => (
              <button 
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  dateFilter === filter ? 'bg-[#4A3728] text-white' : 'bg-white border border-[#D9CFC1] text-[#4A3728] hover:bg-[#EBE3D5]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A3728]/50" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente ou telefone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#D9CFC1] rounded-lg text-sm focus:outline-none focus:border-[#4A3728] focus:ring-1 focus:ring-[#4A3728] placeholder:text-[#4A3728]/40"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
            <thead className="bg-[#EBE3D5]/50 text-[#4A3728]">
              <tr>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Data & Hora</th>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Pessoas</th>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9CFC1]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-[#4A3728]/50" size={32} />
                  </td>
                </tr>
              ) : filteredReservations.map((res) => (
                <tr key={res.id} className={`hover:bg-[#FDFBF7] transition-colors ${res.num_guests >= 15 ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[13px]">{res.name}</p>
                    {res.notes && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-amber-700 bg-amber-100/50 w-fit px-2 py-0.5 rounded-md">
                        <AlertCircle size={10} />
                        {res.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[13px]">{res.whatsapp}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[13px] ">{new Date(res.reservation_date).toLocaleDateString('pt-BR')}</p>
                    <p className="text-[#4A3728]/70 text-xs flex items-center gap-1.5 mt-1 font-medium bg-[#EBE3D5] w-fit px-2 py-0.5 rounded-md"><Clock size={10}/> {res.reservation_time.slice(0, 5)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{res.num_guests}</span>
                      {res.num_guests >= 15 && <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Grupo</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(res.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => updateStatus(res.id, 'confirmed')}
                        className="p-2 text-green-600 bg-white hover:bg-green-50 rounded-lg transition-colors border border-green-200 shadow-sm"
                        title="Confirmar"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button 
                        onClick={() => updateStatus(res.id, 'cancelled')}
                        className="p-2 text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-red-200 shadow-sm"
                        title="Cancelar"
                      >
                        <XCircle size={16} />
                      </button>
                      <button 
                        className="p-2 text-[#4A3728] bg-white hover:bg-[#EBE3D5] rounded-lg transition-colors border border-[#D9CFC1] shadow-sm ml-2"
                        title="WhatsApp"
                        onClick={() => window.open(`https://wa.me/${res.whatsapp.replace(/\D/g, '')}`, '_blank')}
                      >
                        <MessageCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredReservations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#4A3728]/50">
                    Nenhuma reserva encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
