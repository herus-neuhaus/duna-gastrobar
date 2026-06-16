'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, MessageSquare, User, CheckCircle2, ChevronDown, AlertCircle, Loader2, MapPin, Instagram, MessageCircle, AlertTriangle, Utensils, Search, History, CalendarCheck, XCircle, CalendarOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, parse, isAfter, addHours, differenceInHours, getDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DunaGastrobarReservation() {
  // Dropdown Open States
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [isPessoasOpen, setIsPessoasOpen] = useState(false);
  const [isHorarioOpen, setIsHorarioOpen] = useState(false);

  // Form Fields
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [customGuestCount, setCustomGuestCount] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', whatsapp: '' });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', whatsapp: '' });
  
  // Status States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [capacityError, setCapacityError] = useState(false);
  const [totalGuestsForDate, setTotalGuestsForDate] = useState(0);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [allSpecialDates, setAllSpecialDates] = useState<any[]>([]);
  const [allBlockedDates, setAllBlockedDates] = useState<any[]>([]);
  const [specialDateInfo, setSpecialDateInfo] = useState<any>(null);
  const [specialDatesOptions, setSpecialDatesOptions] = useState<any[]>([]);
  
  // States for "My Reservations"
  const [viewMode, setViewMode] = useState<'reserve' | 'check'>('reserve');
  const [searchPhone, setSearchPhone] = useState('');
  const [userReservations, setUserReservations] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [newQuantityValue, setNewQuantityValue] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [paymentPolicyAccepted, setPaymentPolicyAccepted] = useState(false);
  
  const supabase = createClient();

  const CAPACITY_LIMIT = 80;
  const WHATSAPP_NUMBER = "5569992564637";

  // Formata a data em português com as primeiras letras maiúsculas
  const formatDisplayDate = (d: Date) => {
    const formatted = format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
    return formatted
      .split(' ')
      .map(word => {
        if (word.toLowerCase() === 'de') return word;
        return word
          .split('-')
          .map(sub => sub.charAt(0).toUpperCase() + sub.slice(1))
          .join('-');
      })
      .join(' ');
  };

  // Gera as datas disponíveis (próximos 45 dias, pulando segundas-feiras)
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 45; i++) {
      const d = addDays(today, i);
      const dayOfWeek = getDay(d); // 0 = Domingo, 1 = Segunda, ...
      if (dayOfWeek !== 1) {
        dates.push(d);
      }
    }
    return dates;
  };

  const datesList = generateAvailableDates();

  const validateForm = () => {
    let valid = true;
    const errors = { name: '', email: '', whatsapp: '' };

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório.';
      valid = false;
    }

    if (!formData.email.trim()) {
      errors.email = 'E-mail é obrigatório.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'E-mail inválido.';
      valid = false;
    }

    if (!formData.whatsapp.trim()) {
      errors.whatsapp = 'WhatsApp é obrigatório.';
      valid = false;
    } else if (!/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(formData.whatsapp)) {
      errors.whatsapp = 'Formato inválido. Ex: (11) 99999-9999';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const getAvailableTimes = (selectedDate: string) => {
    if (!selectedDate) return [];
    
    const dateObj = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const dayOfWeek = getDay(dateObj); // 0 = Domingo, 1 = Segunda, ...
    
    // Terça a quinta: 2, 3, 4
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      return ['12:00', '12:30', '13:00', '13:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
    }
    
    // Sexta a domingo: 5, 6, 0
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      return ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];
    }
    
    return []; // Segunda ou erro
  };

  const checkLeadTime = (selectedDate: string, selectedTime: string) => {
    if (!selectedDate || !selectedTime) return true;
    
    const reservationDateTime = parse(`${selectedDate} ${selectedTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const now = new Date();
    const diff = differenceInHours(reservationDateTime, now);
    
    return diff >= 8;
  };

  const fetchCapacity = async (selectedDate: string) => {
    const { data, error } = await supabase
      .from('reservations')
      .select('num_guests, status')
      .eq('reservation_date', selectedDate);
    
    if (!error && data) {
      const activeReservations = data.filter(r => {
        const s = (r.status || 'pending').toLowerCase();
        return s !== 'cancelled' && s !== 'cancelado';
      });
      
      const total = activeReservations.reduce((acc, curr) => acc + (curr.num_guests || 0), 0);
      setTotalGuestsForDate(total);
      setCapacityError(total >= CAPACITY_LIMIT);
    }
  };

  const fetchFullDates = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('reservation_date, num_guests, status');
    
    if (!error && data) {
      const dateTotals: Record<string, number> = {};
      
      data.forEach(res => {
        const s = (res.status || 'pending').toLowerCase();
        if (s !== 'cancelled' && s !== 'cancelado') {
          dateTotals[res.reservation_date] = (dateTotals[res.reservation_date] || 0) + (res.num_guests || 0);
        }
      });
      
      const fullDates = Object.keys(dateTotals).filter(date => dateTotals[date] >= CAPACITY_LIMIT);
      setFullyBookedDates(fullDates);
    }

    const { data: sdData } = await supabase.from('special_dates').select('*');
    if (sdData) {
      setAllSpecialDates(sdData);
    }

    const { data: bdData } = await supabase.from('blocked_dates').select('*');
    if (bdData) {
      setAllBlockedDates(bdData);
    }
  };

  useEffect(() => {
    fetchFullDates();
  }, []);

  const fetchSpecialDate = async (selectedDate: string) => {
    const { data, error } = await supabase
      .from('special_dates')
      .select('*')
      .eq('date', selectedDate);
    
    if (!error && data && data.length > 0) {
      setSpecialDatesOptions(data);
      setSpecialDateInfo(null);
    } else {
      setSpecialDatesOptions([]);
      setSpecialDateInfo(null);
    }
  };

  const handleWhatsAppRedirect = (reason: 'lead_time' | 'success' | 'capacity_overflow', overrideGuests?: number) => {
    let message = "";
    const displayGuests = overrideGuests || guests;
    
    if (reason === 'lead_time') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} às ${time} para ${displayGuests} pessoas, mas o sistema informou que é necessário agendar com 8h de antecedência. Poderia me ajudar?`;
    } else if (reason === 'capacity_overflow') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} para ${displayGuests} pessoas, mas o sistema informou que a capacidade online foi atingida. Teria alguma disponibilidade interna?`;
    } else {
      let paymentInfo = "";
      if (specialDateInfo?.requires_fee) {
        paymentInfo = `\n\n*Observação:* Estou ciente da taxa de reserva de R$ ${Number(specialDateInfo.fee_amount).toFixed(2)} para esta data. Vou realizar o pagamento do link e enviar o comprovante em seguida.`;
      } else if (displayGuests && displayGuests >= 15) {
        paymentInfo = "\n\n*Observação:* Minha reserva é de grupo (15+ pessoas). Vou realizar o pagamento do link de R$ 100,00 e enviar o comprovante em seguida.";
      }
      message = `Confirmação de Reserva – Duna Cozinha & Bar\n\nOlá! Acabei de realizar uma reserva pelo site e gostaria de confirmar os detalhes:\n\nNome: ${formData.name}\nData: ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}\nHorário: ${time}\nPessoas: ${displayGuests} convidados${paymentInfo}\n\nFico no aguardo da confirmação de vocês. Obrigado!`;
    }
    
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    
    try {
      window.open(url, '_blank');
    } catch (e) {
      window.location.assign(url);
    }
  };

  const resetForm = () => {
    setDate('');
    setGuests(null);
    setTime('');
    setNotes('');
    setFormData({ name: '', email: '', whatsapp: '' });
    setFormErrors({ name: '', email: '', whatsapp: '' });
    setIsSuccess(false);
    setCapacityError(false);
    setTotalGuestsForDate(0);
    setCustomGuestCount('');
    setPolicyAccepted(false);
    setSpecialDateInfo(null);
    setSpecialDatesOptions([]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const { data: currentData } = await supabase
      .from('reservations')
      .select('num_guests')
      .eq('reservation_date', date)
      .not('status', 'ilike', 'cancelled')
      .not('status', 'ilike', 'cancelado');
    
    const currentTotal = (currentData || []).reduce((acc, curr) => acc + (curr.num_guests || 0), 0);
    const finalGuests = guests || 0;
    
    if (finalGuests && (currentTotal + finalGuests > CAPACITY_LIMIT)) {
      setCapacityError(true);
      setTotalGuestsForDate(currentTotal);
      setIsSubmitting(false);
      alert('Lamentamos, mas a capacidade para este dia acabou de ser atingida. Por favor, escolha outra data.');
      return;
    }

    const { error } = await supabase
      .from('reservations')
      .insert([
        {
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          reservation_date: date,
          reservation_time: time,
          num_guests: finalGuests,
          notes: notes,
          status: 'pending',
          payment_status: (specialDateInfo?.requires_fee || (finalGuests && finalGuests >= 15)) ? 'pending' : 'not_required',
          payment_amount: specialDateInfo?.requires_fee ? specialDateInfo.fee_amount : ((finalGuests && finalGuests >= 15) ? 100 : 0),
        },
      ]);

    if (error) {
      if (error.message.includes('CAPACITY_EXCEEDED')) {
        setCapacityError(true);
        alert('Capacidade Esgotada: Não foi possível finalizar pois o limite de 80 pessoas foi atingido para este dia.');
      } else {
        alert('Erro ao enviar reserva: ' + error.message);
      }
    } else {
      setIsSuccess(true);
      if (finalGuests < 15 && !specialDateInfo?.requires_fee) {
        handleWhatsAppRedirect('success');
      }
    }
    setIsSubmitting(false);
  };

  const fetchUserReservations = async () => {
    const cleanPhone = searchPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) return;
    
    setIsSearching(true);
    setHasSearched(true);
    
    const { data, error } = await supabase
      .rpc('get_customer_reservations', { phone_param: cleanPhone });
    
    if (!error && data) {
      setUserReservations(data);
    } else {
      console.error("Erro na busca:", error);
      setUserReservations([]);
    }
    setIsSearching(false);
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    
    setIsCancelling(true);
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationToCancel);
    
    if (!error) {
      fetchUserReservations();
      setShowCancelModal(false);
      setReservationToCancel(null);
    } else {
      alert('Erro ao cancelar reserva: ' + error.message);
    }
    setIsCancelling(false);
  };

  const handleChangeQuantity = async (res: any) => {
    const newVal = parseInt(newQuantityValue);
    if (!newQuantityValue || newVal <= 0) {
      alert('Por favor, informe uma quantidade válida.');
      return;
    }
    
    const oldVal = res.num_guests;

    const { error } = await supabase
      .from('reservations')
      .update({ 
        num_guests: newVal, 
        status: 'pending',
        payment_status: (newVal >= 15 && res.payment_status === 'not_required') ? 'pending' : res.payment_status,
        payment_amount: (newVal >= 15 && res.payment_amount === 0) ? 100 : res.payment_amount
      })
      .eq('id', res.id);

    if (error) {
      alert('Erro ao solicitar alteração: ' + error.message);
      return;
    }

    fetchUserReservations();
    
    let paymentNote = "";
    if (newVal >= 15 && oldVal < 15) {
      paymentNote = "Baseado nas regras de grupo, essa alteração requer pagamento de taxa.";
    } else if (newVal >= 15 && oldVal >= 15) {
      paymentNote = "Já possuo uma reserva de grupo, alterando apenas a quantidade final.";
    }

    const paymentStatus = res.payment_status === 'paid' ? ' (Pagamento já realizado)' : '';
    const message = `Olá, gostaria de solicitar uma alteração na minha reserva:\n\n*Data:* ${format(parse(res.reservation_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}\n*Horário:* ${res.reservation_time}\n*Pessoas Atual:* ${oldVal}${paymentStatus}\n\n*Nova quantidade solicitada:* ${newVal}\n\n${paymentNote ? paymentNote + "\n\n" : ""}Fico no aguardo da confirmação de vocês. Obrigado!`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    
    if (newVal >= 15 && oldVal < 15) {
      setPaymentModalData({ res, newVal, url });
      setShowPaymentInfo(true);
    } else {
      window.open(url, '_blank');
    }
    
    setEditingQuantityId(null);
    setNewQuantityValue('');
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const getConfirmationText = () => {
    const finalGuests = guests || 0;
    if (finalGuests >= 15 || specialDateInfo?.requires_fee) return "Reservar e Pagar";
    return "Confirmar Reserva";
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#EBE3D5] flex items-center justify-center p-4 font-sans text-[#4A3728]">
        <div className="w-full max-w-[420px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden border border-[#D9CFC1] p-12 text-center">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl font-serif font-bold mb-2">Reserva Solicitada!</h1>
          <p className="text-sm opacity-70 mb-8">Recebemos seu pedido. Enviamos os detalhes para o nosso WhatsApp para agilizar sua confirmação.</p>
          
          {(guests && (guests >= 15 || specialDateInfo?.requires_fee)) && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[24px] text-left animate-in fade-in zoom-in duration-500">
              <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={16} /> {specialDateInfo?.requires_fee ? `Pagamento: ${specialDateInfo.description || 'Data Especial'}` : 'Pagamento de Grupo'}
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed mb-4">
                {specialDateInfo?.requires_fee 
                  ? `Para reservas nesta data especial, é necessário o pagamento de taxa de reserva de ` 
                  : `Para reservas acima de 15 pessoas, é necessário o pagamento de `}
                <strong>R$ {specialDateInfo?.requires_fee ? Number(specialDateInfo.fee_amount).toFixed(2).replace('.', ',') : '100,00'}</strong> (revertido em consumação).
              </p>
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-[9px] text-red-800 font-bold uppercase mb-1">⚠️ Política de Atraso e Cancelamento</p>
                <p className="text-[9px] text-red-700 leading-tight">
                  Tolerância máxima de <strong>20 minutos</strong>. Após esse prazo, a reserva é cancelada e o valor da taxa <strong>não será devolvido</strong>.
                </p>
              </div>
              <a 
                href="https://payment-link-v3.stone.com.br/pl_xa7k1LDo6qzO8Z7FyVheNpG9YMvrX2Q5" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full py-3 bg-[#4A3728] text-white rounded-xl font-bold text-center text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all mb-3"
              >
                Pagar com Stone (R$ {specialDateInfo?.requires_fee ? Number(specialDateInfo.fee_amount).toFixed(2).replace('.', ',') : '100,00'})
              </a>
              <p className="text-[9px] text-amber-700/60 text-center italic">
                *Após o pagamento, clique no botão abaixo para nos enviar o comprovante.
              </p>
            </div>
          )}

          <button 
            onClick={() => handleWhatsAppRedirect('success', guests || 0)}
            className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold uppercase tracking-wider text-xs mb-3 flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-all"
          >
            <MessageCircle size={18} />
            { (guests && (guests >= 15 || specialDateInfo?.requires_fee)) ? 'Enviar Comprovante de Pagamento' : 'Confirmar no WhatsApp' }
          </button>
          <p className="text-center text-[9px] opacity-60 mb-6 px-4">
            { (guests && (guests >= 15 || specialDateInfo?.requires_fee))
              ? 'Após realizar o pagamento, clique acima para enviar o comprovante e finalizar sua reserva.' 
              : 'Clique acima para notificar nossa equipe sobre sua reserva.' }
          </p>
          <a 
            href="https://dunacozinhabar.cfshop.com.br/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-4 bg-[#4A3728] text-white rounded-2xl font-bold uppercase tracking-wider text-xs mb-6 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Utensils size={18} />
            Ver Cardápio Digital
          </a>
          <button 
            onClick={resetForm}
            className="w-full py-4 bg-transparent text-[#4A3728]/60 rounded-2xl font-bold uppercase tracking-wider text-[10px] hover:bg-[#F5F2ED] transition-colors"
          >
            Fazer outra reserva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBE3D5] flex flex-col items-center justify-start py-6 px-4 font-sans text-[#4A3728] overflow-x-hidden">
      <div className="w-full max-w-[420px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden border border-[#D9CFC1] flex flex-col shrink-0">
        
        {/* Banner de Capa */}
        <div className="h-44 sm:h-52 w-full relative">
          <img 
            src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=1200" 
            alt="Duna Gastrobar" 
            className="w-full h-full object-cover"
          />
          {/* Logo sobreposta */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg border border-[#D9CFC1] flex items-center justify-center p-2">
              <img src="/Favicon-D.png" alt="Duna Logo" className="w-16 h-16 object-contain rounded-xl" />
            </div>
          </div>
        </div>

        {/* Informações da Unidade */}
        <div className="text-center mt-12 mb-2 px-4">
          <h2 className="text-xl font-serif font-bold text-[#4A3728] uppercase tracking-wider">Duna Cozinha & Bar 🍹</h2>
          <p className="text-[10px] text-[#4A3728]/60 font-bold uppercase tracking-widest mt-1">
            Reserva • Porto Velho, RO
          </p>
        </div>

        {/* Badge de Tolerância */}
        <div className="flex justify-center mb-6">
          <span className="bg-amber-100 border border-amber-200 text-amber-900 font-bold text-[9px] px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            ⏰ TOLERÂNCIA 20MIN - CARDÁPIO À LA CARTE
          </span>
        </div>

        {/* Benefícios */}
        {viewMode === 'reserve' && (
          <div className="grid grid-cols-3 gap-2 px-4 mb-6">
            <div className="bg-white p-3 rounded-2xl border border-[#D9CFC1] shadow-sm text-center flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-[#4A3728]/10 text-[#4A3728] flex items-center justify-center mb-1">
                <CheckCircle2 size={14} />
              </div>
              <span className="text-[9px] font-bold text-[#4A3728] block">Reserva Rápida ⚡</span>
              <span className="text-[7px] text-[#4A3728]/50 uppercase tracking-wider">Em 1 minuto</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D9CFC1] shadow-sm text-center flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-[#4A3728]/10 text-[#4A3728] flex items-center justify-center mb-1">
                <AlertCircle size={14} />
              </div>
              <span className="text-[9px] font-bold text-[#4A3728] block">Tempo Real 🕒</span>
              <span className="text-[7px] text-[#4A3728]/50 uppercase tracking-wider">Mesas ao vivo</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-[#D9CFC1] shadow-sm text-center flex flex-col items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-[#4A3728]/10 text-[#4A3728] flex items-center justify-center mb-1">
                <MessageCircle size={14} />
              </div>
              <span className="text-[9px] font-bold text-[#4A3728] block">Confirmação ✅</span>
              <span className="text-[7px] text-[#4A3728]/50 uppercase tracking-wider">No WhatsApp</span>
            </div>
          </div>
        )}

        {/* Endereço */}
        {viewMode === 'reserve' && (
          <div className="mx-4 mb-6 p-4 bg-white rounded-2xl border border-[#D9CFC1] shadow-sm flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#4A3728]/10 text-[#4A3728] flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={16} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-[#4A3728] uppercase tracking-wide">Duna Gastrobar</h4>
              <p className="text-[10px] text-[#4A3728]/70 leading-normal mt-0.5">
                Av. Pinheiro Machado, 1356 - São Cristóvão, Porto Velho - RO, 76820-838
              </p>
            </div>
          </div>
        )}

        {/* Alternador de Modos (Abas) */}
        <div className="flex p-1 bg-[#EBE3D5]/30 border-b border-[#D9CFC1]">
          <button 
            onClick={() => setViewMode('reserve')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              viewMode === 'reserve' 
              ? 'bg-[#FDFBF7] text-[#4A3728] shadow-sm' 
              : 'text-[#4A3728]/50 hover:text-[#4A3728]'
            }`}
          >
            <Calendar size={14} />
            Nova Reserva
          </button>
          <button 
            onClick={() => setViewMode('check')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              viewMode === 'check' 
              ? 'bg-[#FDFBF7] text-[#4A3728] shadow-sm' 
              : 'text-[#4A3728]/50 hover:text-[#4A3728]'
            }`}
          >
            <Search size={14} />
            Minhas Reservas
          </button>
        </div>

        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'reserve' ? (
            <div className="p-4">
              <div className="bg-white border border-[#D9CFC1] rounded-[28px] shadow-sm flex flex-col">
                
                {/* Banner de tolerância do form */}
                <div className="bg-amber-50 p-4 border-b border-[#D9CFC1] text-[#4A3728] rounded-t-[28px]">
                  <p className="text-[10px] font-semibold text-amber-900 leading-relaxed text-center uppercase tracking-wider">
                    ⚠️ Tolerância de 20min. Cardápio à la carte (sem rodízio).
                  </p>
                </div>

                {/* CAMPO 1: DATA */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsDataOpen(!isDataOpen);
                      setIsPessoasOpen(false);
                      setIsHorarioOpen(false);
                    }}
                    className={`w-full p-4 flex items-center justify-between text-left hover:bg-[#F5F2ED]/40 transition-colors ${
                      isDataOpen ? 'border-l-4 border-[#4A3728]' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[#4A3728]/70">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-[#4A3728]/50">Data</p>
                        <p className="text-xs font-bold text-[#4A3728] mt-0.5">
                          {date ? formatDisplayDate(parse(date, 'yyyy-MM-dd', new Date())) : 'Selecione o dia'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-[#4A3728]/45 transition-transform ${isDataOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDataOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDataOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-[#D9CFC1] rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-[#F5F2ED] mx-2">
                        {datesList.map((dObj) => {
                          const dateValue = format(dObj, 'yyyy-MM-dd');
                          const isFull = fullyBookedDates.includes(dateValue);
                          const displayLabel = formatDisplayDate(dObj);
                          
                          return (
                            <button
                              key={dateValue}
                              disabled={isFull}
                              onClick={() => {
                                setDate(dateValue);
                                fetchCapacity(dateValue);
                                fetchSpecialDate(dateValue);
                                setIsDataOpen(false);
                                setGuests(null);
                                setTime('');
                              }}
                              className={`w-full text-left px-5 py-3 hover:bg-[#F5F2ED] transition-colors flex items-center justify-between font-medium ${
                                date === dateValue ? 'bg-[#F5F2ED] font-bold text-[#4A3728]' : 'text-[#4A3728]/80'
                              } ${isFull ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs">{displayLabel}</span>
                                {allSpecialDates.filter(s => s.date === dateValue).map(s => (
                                  <span key={s.id} className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">{s.description || 'Evento'}</span>
                                ))}
                              </div>
                              {isFull && <span className="text-[9px] font-bold text-red-600 uppercase">Lotado</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {date && allBlockedDates.find(b => b.date === date) ? (
                  <div className="p-8 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CalendarOff size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-[#4A3728] mb-2">Reservas Bloqueadas</h3>
                    <p className="text-sm text-[#4A3728]/70 mb-6">
                      As reservas pelo site para este dia estão bloqueadas. Por favor, entre em contato pelo WhatsApp para tentar realizar a sua reserva.
                    </p>
                    <a 
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá, vi no site que as reservas para o dia ' + formatDisplayDate(parse(date, 'yyyy-MM-dd', new Date())) + ' estão bloqueadas. Teria alguma disponibilidade?')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#20b858] transition-colors"
                    >
                      <MessageCircle size={18} />
                      Chamar no WhatsApp
                    </a>
                  </div>
                ) : (
                  <>

                {/* CAMPO 2: PESSOAS / PACOTES */}
                <div className="relative border-t border-[#D9CFC1]">
                  <button
                    disabled={!date}
                    onClick={() => {
                      setIsPessoasOpen(!isPessoasOpen);
                      setIsDataOpen(false);
                      setIsHorarioOpen(false);
                    }}
                    className={`w-full p-4 flex items-center justify-between text-left transition-colors disabled:opacity-40 ${
                      !date ? 'cursor-not-allowed bg-stone-50' : 'hover:bg-[#F5F2ED]/40'
                    } ${isPessoasOpen ? 'border-l-4 border-[#4A3728]' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[#4A3728]/70">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-[#4A3728]/50">
                          {specialDateInfo ? (specialDateInfo.description || 'Evento Especial') : (specialDatesOptions.length > 0 ? 'Pacote / Evento' : 'Pessoas')}
                        </p>
                        <p className="text-xs font-bold text-[#4A3728] mt-0.5">
                          {specialDateInfo && specialDateInfo.included_guests 
                            ? `${specialDateInfo.included_guests} pessoas (Fixo)`
                            : (guests ? `${guests} ${guests === 1 ? 'pessoa' : 'pessoas'}` : 'Selecione')}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-[#4A3728]/45 transition-transform ${isPessoasOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isPessoasOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPessoasOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-[#D9CFC1] rounded-2xl shadow-xl z-50 mx-2 flex flex-col max-h-72 overflow-y-auto custom-scrollbar">
                        
                        {specialDatesOptions.length > 0 && !specialDateInfo ? (
                          <div className="p-2 space-y-2">
                            {specialDatesOptions.map((pkg) => (
                              <button
                                key={pkg.id}
                                onClick={() => {
                                  setSpecialDateInfo(pkg);
                                  if (pkg.included_guests) {
                                    setGuests(pkg.included_guests);
                                    setCustomGuestCount('');
                                    setIsPessoasOpen(false);
                                    setTime('');
                                  } else {
                                    setGuests(null);
                                  }
                                }}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${
                                  specialDateInfo?.id === pkg.id
                                    ? 'border-[#4A3728] bg-[#F5F2ED]'
                                    : 'border-[#D9CFC1] hover:bg-[#F5F2ED]'
                                }`}
                              >
                                <div className="font-bold text-sm text-[#4A3728]">
                                  {pkg.description || `Evento`} {pkg.included_guests ? `(Mesa p/ ${pkg.included_guests})` : ''}
                                </div>
                                {pkg.requires_fee && (
                                  <div className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle size={10} /> Taxa: R$ {Number(pkg.fee_amount).toFixed(2).replace('.', ',')}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            {specialDateInfo && !specialDateInfo.included_guests && (
                              <div className="bg-[#F5F2ED] p-3 border-b border-[#D9CFC1] flex justify-between items-center shrink-0">
                                <div>
                                  <span className="text-[8px] uppercase font-bold text-[#4A3728]/70 block">Evento Selecionado</span>
                                  <span className="text-xs font-bold text-[#4A3728]">{specialDateInfo.description || 'Especial'}</span>
                                </div>
                                {specialDatesOptions.length > 1 && (
                                  <button 
                                    onClick={() => setSpecialDateInfo(null)}
                                    className="text-[9px] text-[#4A3728] font-bold bg-[#D9CFC1]/50 px-2 py-1 rounded hover:bg-[#D9CFC1]"
                                  >
                                    Trocar
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="grid grid-cols-5 gap-2 p-4 shrink-0">
                          {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
                            const isOverflow = (totalGuestsForDate + num) > CAPACITY_LIMIT;
                            return (
                              <button
                                key={num}
                                disabled={isOverflow}
                                onClick={() => {
                                  setGuests(num);
                                  setCustomGuestCount('');
                                  setIsPessoasOpen(false);
                                  setTime('');
                                }}
                                className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                                  guests === num
                                    ? 'border-[#4A3728] bg-[#4A3728] text-white'
                                    : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED] disabled:opacity-20 disabled:cursor-not-allowed'
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={() => {
                            handleWhatsAppRedirect('capacity_overflow', 30);
                            setIsPessoasOpen(false);
                          }}
                          className="m-4 mt-0 p-3 border border-dashed border-[#25D366]/40 rounded-xl flex items-center justify-between text-[10px] font-bold text-[#128C7E] bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-all text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">💬</span>
                            <span>Mais de 30 pessoas? Fale com o Duna</span>
                          </div>
                          <span className="text-[8px] uppercase tracking-widest text-[#128C7E]">WhatsApp →</span>
                        </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* CAMPO 3: HORÁRIO */}
                <div className="relative border-t border-[#D9CFC1]">
                  <button
                    disabled={!date || !guests}
                    onClick={() => {
                      setIsHorarioOpen(!isHorarioOpen);
                      setIsDataOpen(false);
                      setIsPessoasOpen(false);
                    }}
                    className={`w-full p-4 flex items-center justify-between text-left transition-colors disabled:opacity-40 ${
                      (!date || !guests) ? 'cursor-not-allowed bg-stone-50' : 'hover:bg-[#F5F2ED]/40'
                    } ${isHorarioOpen ? 'border-l-4 border-[#4A3728]' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[#4A3728]/70">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-[#4A3728]/50">Horário</p>
                        <p className="text-xs font-bold text-[#4A3728] mt-0.5">
                          {(!date || !guests) ? 'Escolha data e pessoas primeiro' : (time ? time : 'Selecione')}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-[#4A3728]/45 transition-transform ${isHorarioOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isHorarioOpen && date && guests && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsHorarioOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-[#D9CFC1] rounded-2xl shadow-xl z-50 mx-2 p-4 grid grid-cols-3 gap-2">
                        {getAvailableTimes(date).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setTime(t);
                              setIsHorarioOpen(false);
                            }}
                            className={`py-2.5 rounded-lg border text-xs font-bold transition-all ${
                              time === t
                                ? 'border-[#4A3728] bg-[#4A3728] text-white'
                                : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED]'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Avisos de Antecedência e Capacidade */}
                {time && !checkLeadTime(date, time) && (
                  <div className="p-4 bg-amber-50 border-t border-[#D9CFC1] flex flex-col gap-3 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                        Reservas para hoje com menos de 8 horas de antecedência devem ser feitas diretamente via WhatsApp.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleWhatsAppRedirect('lead_time')}
                      className="w-full bg-[#25D366] text-white rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={14} />
                      Solicitar via WhatsApp
                    </button>
                  </div>
                )}

                {guests && (totalGuestsForDate + guests > CAPACITY_LIMIT) && (
                  <div className="p-4 bg-red-50 border-t border-[#D9CFC1] flex flex-col gap-3 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-red-800 font-medium">
                        A capacidade para este dia foi atingida no sistema. Fale conosco no WhatsApp para verificar disponibilidades extras.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleWhatsAppRedirect('capacity_overflow')}
                      className="w-full bg-[#25D366] text-white rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={14} />
                      Falar no WhatsApp
                    </button>
                  </div>
                )}

                {/* Aviso sobre Eventos Especiais ou Taxas de Grupo */}
                {guests && (guests >= 15 || specialDateInfo?.requires_fee) && (
                  <div className="p-4 bg-amber-50 border-t border-[#D9CFC1] flex flex-col gap-2 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                        {specialDateInfo?.requires_fee 
                          ? <span><strong>{specialDateInfo.description || 'Data Especial'}:</strong> Requer pagamento de taxa de reserva de R$ {Number(specialDateInfo.fee_amount).toFixed(2).replace('.', ',')} (100% revertido em consumação).</span>
                          : <span><strong>Reserva de Grupo:</strong> Acima de 15 pessoas requer pagamento de taxa de R$ 100,00 (100% revertido em consumação).</span>
                        }
                      </p>
                    </div>
                    <p className="text-[9px] text-red-700 font-bold leading-tight pl-8">
                      *Tolerância de 20 min. O valor não é reembolsável em caso de atraso ou cancelamento.
                    </p>
                  </div>
                )}

                {/* CAMPO 4: ALGUMA OBSERVAÇÃO? (OPCIONAL) */}
                {date && guests && time && checkLeadTime(date, time) && (
                  <div className="p-4 border-t border-[#D9CFC1]">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4A3728]/60 mb-2">
                      Alguma Observação? (Opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex.: Aniversário, alergia, cadeirinha de bebê..."
                      className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#D9CFC1] rounded-xl text-sm focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none resize-none h-20 placeholder:text-[#4A3728]/45 text-[#4A3728]"
                    />
                  </div>
                )}

                {/* DADOS DO CLIENTE */}
                {date && guests && time && checkLeadTime(date, time) && (totalGuestsForDate + guests <= CAPACITY_LIMIT) && (
                  <div className="p-4 border-t border-[#D9CFC1] bg-stone-50/50 space-y-3 animate-in fade-in duration-500">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">
                      Seus Dados
                    </p>
                    <div>
                      <input
                        type="text"
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:ring-1 outline-none placeholder:text-[#4A3728]/40 text-[#4A3728] ${
                          formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728]'
                        }`}
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({...formData, name: e.target.value});
                          if (formErrors.name) setFormErrors({...formErrors, name: ''});
                        }}
                        placeholder="Nome completo"
                      />
                      {formErrors.name && <p className="text-red-500 text-[9px] mt-1 ml-1 font-medium">{formErrors.name}</p>}
                    </div>
                    <div>
                      <input
                        type="email"
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:ring-1 outline-none placeholder:text-[#4A3728]/40 text-[#4A3728] ${
                          formErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728]'
                        }`}
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({...formData, email: e.target.value});
                          if (formErrors.email) setFormErrors({...formErrors, email: ''});
                        }}
                        placeholder="E-mail: joao@email.com"
                      />
                      {formErrors.email && <p className="text-red-500 text-[9px] mt-1 ml-1 font-medium">{formErrors.email}</p>}
                    </div>
                    <div>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:ring-1 outline-none placeholder:text-[#4A3728]/40 text-[#4A3728] ${
                          formErrors.whatsapp ? 'border-red-500 focus:ring-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728]'
                        }`}
                        value={formData.whatsapp}
                        onChange={(e) => {
                          setFormData({...formData, whatsapp: formatPhoneNumber(e.target.value)});
                          if (formErrors.whatsapp) setFormErrors({...formErrors, whatsapp: ''});
                        }}
                        placeholder="WhatsApp: (69) 99999-9999"
                      />
                      {formErrors.whatsapp && <p className="text-red-500 text-[9px] mt-1 ml-1 font-medium">{formErrors.whatsapp}</p>}
                    </div>
                  </div>
                )}

                {/* POLÍTICA DE ATRASO / CONCORDÂNCIA */}
                {date && guests && time && formData.name && formData.email && formData.whatsapp && (
                  <div className="p-4 bg-amber-50 border-t border-[#D9CFC1] flex items-start gap-3 animate-in fade-in duration-300">
                    <input
                      id="terms-check"
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="w-5 h-5 rounded-md border-amber-300 text-[#4A3728] focus:ring-[#4A3728] cursor-pointer mt-0.5"
                    />
                    <label htmlFor="terms-check" className="text-[11px] leading-normal text-amber-900 cursor-pointer font-medium">
                      Estou ciente da política de <strong className="text-red-700">20 min de tolerância</strong> e que a taxa de reserva {specialDateInfo?.requires_fee ? 'desta data especial' : 'de grupo'} <strong className="text-red-700">não é reembolsável</strong> em caso de atraso ou cancelamento.
                    </label>
                  </div>
                )}

                {/* BOTÃO DE CONFIRMAÇÃO */}
                <div className="p-4 border-t border-[#D9CFC1] bg-white rounded-b-[28px]">
                  <button
                    disabled={!date || !guests || !time || !formData.name || !formData.email || !formData.whatsapp || !policyAccepted || isSubmitting}
                    onClick={async () => {
                      if (validateForm()) {
                        await handleSubmit();
                      }
                    }}
                    className={`w-full py-4 text-white rounded-2xl font-bold uppercase tracking-[2px] text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                      policyAccepted && date && guests && time && formData.name && formData.whatsapp
                      ? 'bg-[#4A3728] hover:bg-[#3d2d21] active:scale-[0.98]'
                      : 'bg-stone-300 cursor-not-allowed shadow-none text-stone-500'
                    }`}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : getConfirmationText()}
                  </button>
                </div>
                  </>
                )}

              </div>
              <p className="text-center text-[9px] opacity-60 mt-3">
                Disponibilidade em tempo real • Confirmação no WhatsApp
              </p>
            </div>
          ) : (
            /* VISUALIZAÇÃO: MINHAS RESERVAS */
            <div className="p-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-lg font-serif font-bold mb-2 text-[#4A3728]">Consultar Reservas 🔎</h2>
                <p className="text-[11px] opacity-60 leading-relaxed uppercase tracking-widest text-[#4A3728]">
                  Informe seu WhatsApp para acompanhar o status da sua reserva.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="(69) 99999-9999"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(formatPhoneNumber(e.target.value))}
                    className="w-full px-5 py-4 bg-white border border-[#D9CFC1] rounded-2xl text-base focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none shadow-sm transition-all"
                  />
                  <button 
                    onClick={fetchUserReservations}
                    disabled={isSearching || searchPhone.length < 10}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-[#4A3728] text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {hasSearched && userReservations.length === 0 && !isSearching && (
                  <div className="text-center py-12 px-6 bg-white/50 rounded-[32px] border border-dashed border-[#D9CFC1]">
                    <div className="w-12 h-12 bg-[#F5F2ED] rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle size={24} className="text-[#4A3728]/30" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma reserva encontrada</p>
                    <p className="text-[10px] opacity-50 mt-1">Verifique se o número está correto.</p>
                  </div>
                )}

                {userReservations.map((res) => (
                  <div key={res.id} className="bg-white p-5 rounded-[24px] border border-[#D9CFC1] shadow-sm animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-bold text-[#4A3728]">
                            {format(parse(res.reservation_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                          </p>
                          <span className="text-[8px] opacity-30">•</span>
                          <p className="text-xs font-bold text-[#4A3728]">{res.reservation_time}</p>
                        </div>
                        <p className="text-[10px] opacity-60 uppercase tracking-wider">{res.num_guests} Convidados</p>
                      </div>
                      
                      {/* Status Badge */}
                      <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
                        (res.status || 'pending') === 'confirmed' ? 'bg-green-100 text-green-700' :
                        (res.status || 'pending') === 'cancelled' ? 'bg-red-100 text-red-700' :
                        (res.status || 'pending') === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {(res.status || 'pending') === 'confirmed' ? <CalendarCheck size={10} /> :
                         (res.status || 'pending') === 'cancelled' ? <XCircle size={10} /> :
                         (res.status || 'pending') === 'completed' ? <History size={10} /> :
                         <Clock size={10} />}
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                          {res.status === 'confirmed' ? 'Confirmada' :
                           res.status === 'cancelled' ? 'Cancelada' :
                           res.status === 'completed' ? 'Concluída' :
                           'Pendente'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#F5F2ED]">
                      <a 
                        href="https://dunacozinhabar.cfshop.com.br/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 bg-[#F5F2ED] text-[#4A3728] rounded-xl text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all"
                      >
                        <Utensils size={14} />
                        Cardápio
                      </a>
                      <a 
                        href="https://maps.app.goo.gl/2zmtd2zZ4wrSxxCT7" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 bg-[#F5F2ED] text-[#4A3728] rounded-xl text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all"
                      >
                        <MapPin size={14} />
                        Localização
                      </a>
                    </div>

                    {res.status !== 'cancelled' && res.status !== 'cancelado' && (
                      <div className="mt-4 pt-4 border-t border-[#F5F2ED]">
                        {editingQuantityId === res.id ? (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/60 ml-1">Nova Quantidade de Pessoas</label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="1"
                                  value={newQuantityValue}
                                  onChange={(e) => setNewQuantityValue(e.target.value)}
                                  placeholder="Ex: 12"
                                  className="flex-1 px-4 py-2.5 bg-[#F5F2ED] border-none rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-[#4A3728] text-[#4A3728]"
                                />
                                <button 
                                  onClick={() => handleChangeQuantity(res)}
                                  className="px-4 bg-[#4A3728] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                                >
                                  OK
                                </button>
                                <button 
                                  onClick={() => { setEditingQuantityId(null); setNewQuantityValue(''); }}
                                  className="px-4 bg-[#F5F2ED] text-[#4A3728] rounded-xl text-[10px] font-bold uppercase tracking-widest"
                                >
                                  X
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                setEditingQuantityId(res.id);
                                setNewQuantityValue(res.num_guests.toString());
                              }}
                              className="flex items-center justify-center gap-2 py-2.5 bg-white border border-[#4A3728]/20 text-[#4A3728] rounded-xl text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all"
                            >
                              <MessageSquare size={14} />
                              Alterar Qtd
                            </button>
                            <button 
                              onClick={() => {
                                setReservationToCancel(res.id);
                                setShowCancelModal(true);
                              }}
                              className="flex items-center justify-center gap-2 py-2.5 bg-white border border-red-100 text-red-600 rounded-xl text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all"
                            >
                              <XCircle size={14} />
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE PAGAMENTO (Para Alteração de Quantidade) */}
      {showPaymentInfo && paymentModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3728]/60 backdrop-blur-sm" onClick={() => setShowPaymentInfo(false)} />
          <div className="relative w-full max-w-[380px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-[#4A3728] p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-white font-serif text-xl uppercase tracking-widest">Reserva de Grupo</h3>
            </div>
            <div className="p-8 text-center">
              <p className="text-sm text-[#4A3728]/70 mb-6 leading-relaxed">
                Você está alterando sua reserva para <strong className="text-[#4A3728]">{paymentModalData.newVal} pessoas</strong>. 
                Para grupos (15+), é necessário o pagamento da taxa de reserva.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-left">
                <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-2">Instruções de Pagamento</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-4">
                  Taxa de <strong>R$ 100,00</strong> (100% revertido em consumação).
                </p>
                <div className="mb-4 p-2 bg-red-100/50 rounded-lg border border-red-200">
                  <p className="text-[9px] text-red-800 leading-tight">
                    <strong>⚠️ Importante:</strong> Tolerância de 20 min. O valor da taxa não é reembolsável em caso de atraso superior a 20 min ou cancelamento.
                  </p>
                </div>
                <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-200 flex items-start gap-3 text-left">
                  <div className="relative flex items-center h-5">
                    <input
                      id="payment-policy"
                      type="checkbox"
                      checked={paymentPolicyAccepted}
                      onChange={(e) => setPaymentPolicyAccepted(e.target.checked)}
                      className="w-5 h-5 rounded-md border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                  </div>
                  <label htmlFor="payment-policy" className="text-[11px] leading-relaxed text-red-800 cursor-pointer font-medium">
                    Estou ciente da política de <strong className="text-red-700">20 min de tolerância</strong> e que a taxa de reserva de grupo <strong className="text-red-700">não é reembolsável</strong> em caso de atraso ou cancelamento.
                  </label>
                </div>

                <a 
                  href={paymentPolicyAccepted ? "https://payment-link-v3.stone.com.br/pl_xa7k1LDo6qzO8Z7FyVheNpG9YMvrX2Q5" : "#"} 
                  target={paymentPolicyAccepted ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => !paymentPolicyAccepted && e.preventDefault()}
                  className={`block w-full py-3 text-white rounded-xl font-bold text-center text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all mb-3 ${
                    paymentPolicyAccepted ? 'bg-[#4A3728] shadow-amber-200' : 'bg-stone-300 cursor-not-allowed shadow-none'
                  }`}
                >
                  Pagar com Stone (R$ 100,00)
                </a>
              </div>

              <button 
                disabled={!paymentPolicyAccepted}
                onClick={() => {
                  window.open(paymentModalData.url, '_blank');
                  setShowPaymentInfo(false);
                  setPaymentPolicyAccepted(false);
                }}
                className={`w-full py-4 text-white rounded-2xl font-bold uppercase tracking-wider text-xs mb-3 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
                  paymentPolicyAccepted ? 'bg-[#25D366] shadow-green-200' : 'bg-stone-200 text-[#4A3728]/30 cursor-not-allowed shadow-none'
                }`}
              >
                <MessageCircle size={18} />
                Enviar Comprovante no WhatsApp
              </button>
              
              <button 
                onClick={() => { setShowPaymentInfo(false); setPaymentPolicyAccepted(false); }}
                className="w-full py-2 text-[10px] font-bold text-[#4A3728]/40 uppercase tracking-widest hover:text-[#4A3728] transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3728]/60 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative w-full max-w-[340px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-[#4A3728] font-serif text-xl font-bold mb-2">Cancelar Reserva?</h3>
              <p className="text-xs text-[#4A3728]/70 mb-6 leading-relaxed">
                Tem certeza que deseja cancelar? Esta ação não pode ser desfeita e segue as políticas da casa.
              </p>
              
              <div className="space-y-3">
                <button 
                  disabled={isCancelling}
                  onClick={handleCancelReservation}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCancelling ? <Loader2 size={18} className="animate-spin" /> : "Sim, Cancelar Reserva"}
                </button>
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-4 bg-[#F5F2ED] text-[#4A3728] rounded-2xl font-bold uppercase tracking-wider text-xs active:scale-95 transition-all"
                >
                  Manter Reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* links de rodapé adicionais */}
      <div className="mt-12 w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <a 
          href="https://wa.me/5569992564637" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-[#25D366]/10 backdrop-blur-sm rounded-2xl border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-all group shadow-sm"
        >
          <div className="w-12 h-12 flex items-center justify-center bg-[#25D366] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <MessageCircle size={24} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#128C7E] mb-1 flex items-center gap-1">
              WhatsApp
            </p>
            <p className="text-sm font-bold text-[#4A3728] tracking-tight">Reservas mesas Copa 🇧🇷</p>
          </div>
        </a>

        <a 
          href="https://chat.whatsapp.com/DGOBrxpcniEG8WSOTn0J6i?mode=gi_t" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-[#25D366]/10 backdrop-blur-sm rounded-2xl border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-all group shadow-sm"
        >
          <div className="w-12 h-12 flex items-center justify-center bg-[#25D366] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform text-2xl">
            ⚽
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#128C7E] mb-1 flex items-center gap-1">
              Grupo Vip - Copa do Brasil
            </p>
            <p className="text-sm font-bold text-[#4A3728] tracking-tight">Acesse o link para entrar no grupo!</p>
          </div>
        </a>

        <a 
          href="https://dunacozinhabar.cfshop.com.br/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#4A3728] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <Utensils size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">Cardápio Digital</p>
            <p className="text-sm font-bold tracking-tight">Ver Menu Completo</p>
          </div>
        </a>

        <a 
          href="https://maps.app.goo.gl/2zmtd2zZ4wrSxxCT7" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#4A3728] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">Localização</p>
            <p className="text-xs font-medium leading-relaxed">
              Av. Pinheiro Machado, 1356 - São Cristóvão, Porto Velho - RO, 76820-838
            </p>
          </div>
        </a>

        <a 
          href="https://www.instagram.com/dunacozinhabar/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <Instagram size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">Instagram</p>
            <p className="text-sm font-bold tracking-tight">@dunacozinhabar</p>
          </div>
        </a>
        
        <p className="text-center text-[10px] opacity-40 uppercase tracking-[4px] mt-4 mb-8">
          Experiência Gastronômica • Porto Velho
        </p>
      </div>
    </div>
  );
}
