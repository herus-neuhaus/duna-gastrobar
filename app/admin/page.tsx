'use client';

import React, { useState } from 'react';
import { Calendar, Users, DollarSign, Search, MessageCircle, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

type ReservationStatus = 'Confirmado' | 'Pendente' | 'Cancelado' | 'Concluído';

interface Reservation {
  id: string;
  name: string;
  whatsapp: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  notes?: string;
}

const initialMockData: Reservation[] = [
  { id: '1', name: 'João Silva', whatsapp: '(11) 98765-4321', date: '04/05/2026', time: '19:00', guests: 2, status: 'Confirmado' },
  { id: '2', name: 'Maria Fernandes', whatsapp: '(11) 91234-5678', date: '04/05/2026', time: '20:00', guests: 4, status: 'Confirmado', notes: 'Aniversário' },
  { id: '3', name: 'Carlos Roberto', whatsapp: '(11) 99999-8888', date: '04/05/2026', time: '19:30', guests: 18, status: 'Pendente', notes: 'Pagamento pendente R$100' },
  { id: '4', name: 'Ana Oliveira', whatsapp: '(11) 97777-6666', date: '04/05/2026', time: '21:00', guests: 6, status: 'Confirmado' },
  { id: '5', name: 'Pedro Souza', whatsapp: '(11) 96666-5555', date: '04/05/2026', time: '20:30', guests: 2, status: 'Cancelado' },
];

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>(initialMockData);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('Hoje');

  const updateStatus = (id: string, newStatus: ReservationStatus) => {
    setReservations(reservations.map(res => res.id === id ? { ...res, status: newStatus } : res));
  };

  const totalReservations = reservations.filter(r => r.status !== 'Cancelado').length;
  const totalGuests = reservations.filter(r => r.status !== 'Cancelado').reduce((acc, curr) => acc + curr.guests, 0);
  const pendingPayments = reservations.filter(r => r.guests >= 15 && r.status === 'Pendente').length;

  const filteredReservations = reservations.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || res.whatsapp.includes(searchTerm);
    return matchesSearch;
  });

  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'Confirmado':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold uppercase tracking-wider border border-green-200">Confirmado</span>;
      case 'Pendente':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-bold uppercase tracking-wider border border-amber-200">Pendente</span>;
      case 'Cancelado':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold uppercase tracking-wider border border-red-200">Cancelado</span>;
      case 'Concluído':
        return <span className="px-2.5 py-1 bg-[#EBE3D5] text-[#4A3728] rounded-md text-xs font-bold uppercase tracking-wider border border-[#D9CFC1]">Concluído</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728] p-4 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold tracking-wide">Duna Gastrobar</h1>
          <p className="text-sm font-medium tracking-widest uppercase opacity-70 mt-1">Controle de Reservas</p>
        </div>
        <div className="text-sm font-bold uppercase tracking-wider bg-white px-5 py-3 rounded-xl shadow-sm border border-[#D9CFC1] flex items-center gap-2">
          <Calendar size={16} />
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className="w-14 h-14 flex items-center justify-center bg-[#EBE3D5] text-[#4A3728] rounded-xl"><Calendar size={24} strokeWidth={2.5} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Total de Reservas (Hoje)</p>
            <p className="text-3xl font-bold">{totalReservations}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className="w-14 h-14 flex items-center justify-center bg-[#EBE3D5] text-[#4A3728] rounded-xl"><Users size={24} strokeWidth={2.5} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Pessoas Esperadas</p>
            <p className="text-3xl font-bold">{totalGuests}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D9CFC1] flex items-center gap-5">
          <div className={`w-14 h-14 flex items-center justify-center rounded-xl ${pendingPayments > 0 ? 'bg-red-100 text-red-600' : 'bg-[#EBE3D5] text-[#4A3728]'}`}>
            <DollarSign size={24} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A3728]/60 mb-1">Pagamentos Pendentes (15+)</p>
            <p className="text-3xl font-bold flex items-center gap-2">
              {pendingPayments}
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
            {['Hoje', 'Amanhã', 'Esta Semana'].map(filter => (
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
              {filteredReservations.map((res) => (
                <tr key={res.id} className={`hover:bg-[#FDFBF7] transition-colors ${res.guests >= 15 ? 'bg-amber-50/50' : ''}`}>
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
                    <p className="font-semibold text-[13px] ">{res.date}</p>
                    <p className="text-[#4A3728]/70 text-xs flex items-center gap-1.5 mt-1 font-medium bg-[#EBE3D5] w-fit px-2 py-0.5 rounded-md"><Clock size={10}/> {res.time}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{res.guests}</span>
                      {res.guests >= 15 && <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">Grupo</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(res.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => updateStatus(res.id, 'Confirmado')}
                        className="p-2 text-green-600 bg-white hover:bg-green-50 rounded-lg transition-colors border border-green-200 shadow-sm"
                        title="Confirmar/Check-in"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button 
                        onClick={() => updateStatus(res.id, 'Cancelado')}
                        className="p-2 text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-red-200 shadow-sm"
                        title="Cancelar"
                      >
                        <XCircle size={16} />
                      </button>
                      <button 
                        className="p-2 text-[#4A3728] bg-white hover:bg-[#EBE3D5] rounded-lg transition-colors border border-[#D9CFC1] shadow-sm ml-2"
                        title="WhatsApp"
                      >
                        <MessageCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReservations.length === 0 && (
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
