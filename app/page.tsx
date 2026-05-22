'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Calendar, Users, Clock, MessageSquare, User, CheckCircle2, ChevronDown, AlertCircle, Loader2, MapPin, Instagram, MessageCircle, AlertTriangle, Utensils, Search, History, CalendarCheck, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CalendarPicker from './components/CalendarPicker';
import { format, parse, isAfter, addHours, differenceInHours, getDay } from 'date-fns';

export default function DunaGastrobarReservation() {
  const [activeStep, setActiveStep] = useState(1);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [customGuestCount, setCustomGuestCount] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', whatsapp: '' });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', whatsapp: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [capacityError, setCapacityError] = useState(false);
  const [totalGuestsForDate, setTotalGuestsForDate] = useState(0);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  
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
    const dayOfWeek = getDay(dateObj); // 0 = Sunday, 1 = Monday, ...
    
    // Terça a quinta: 1, 2, 3, 4
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
    
    // Diferença em horas
    const diff = differenceInHours(reservationDateTime, now);
    
    return diff >= 8;
  };

  const fetchCapacity = async (selectedDate: string) => {
    // Conta tudo que NÃO é cancelado (trata nulos como pendentes implicitamente pela lógica do trigger)
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
  };

  // Carrega datas lotadas ao iniciar
  React.useEffect(() => {
    fetchFullDates();
  }, []);

  const handleWhatsAppRedirect = (reason: 'lead_time' | 'success' | 'capacity_overflow', overrideGuests?: number) => {
    let message = "";
    const displayGuests = overrideGuests || guests;
    
    if (reason === 'lead_time') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} às ${time} para ${displayGuests} pessoas, mas o sistema informou que é necessário agendar com 8h de antecedência. Poderia me ajudar?`;
    } else if (reason === 'capacity_overflow') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} para ${displayGuests} pessoas, mas o sistema informou que a capacidade online foi atingida. Teria alguma disponibilidade interna?`;
    } else {
      const paymentInfo = (guests && guests >= 15) ? "\n\n*Observação:* Minha reserva é de grupo (15+ pessoas). Vou realizar o pagamento do link de R$ 100,00 e enviar o comprovante em seguida." : "";
      message = `Confirmação de Reserva – Duna Cozinha & Bar\n\nOlá! Acabei de realizar uma reserva pelo site e gostaria de confirmar os detalhes:\n\nNome: ${formData.name}\nData: ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}\nHorário: ${time}\nPessoas: ${displayGuests} convidados${paymentInfo}\n\nFico no aguardo da confirmação de vocês. Obrigado!`;
    }
    
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    
    try {
      window.open(url, '_blank');
    } catch (e) {
      window.location.assign(url);
    }
  };

  const guestOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const resetForm = () => {
    setActiveStep(1);
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
  };

  const handleNext = (step: number) => {
    setActiveStep(step + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Final pre-submit check to avoid race conditions
    const { data: currentData } = await supabase
      .from('reservations')
      .select('num_guests')
      .eq('reservation_date', date)
      .not('status', 'ilike', 'cancelled')
      .not('status', 'ilike', 'cancelado');
    
    const currentTotal = (currentData || []).reduce((acc, curr) => acc + (curr.num_guests || 0), 0);
    const finalGuests = guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0);
    
    if (finalGuests && (currentTotal + finalGuests > CAPACITY_LIMIT)) {
      setCapacityError(true);
      setTotalGuestsForDate(currentTotal);
      setIsSubmitting(false);
      alert('Lamentamos, mas a capacidade para este dia acabou de ser atingida. Por favor, escolha outra data.');
      setActiveStep(1); // Volta para a data
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
          status: 'pending', // Status padrão
          payment_status: (finalGuests && finalGuests >= 15) ? 'pending' : 'not_required',
          payment_amount: (finalGuests && finalGuests >= 15) ? 100 : 0,
        },
      ]);

    if (error) {
      if (error.message.includes('CAPACITY_EXCEEDED')) {
        setCapacityError(true);
        alert('Capacidade Esgotada: Não foi possível finalizar pois o limite de 80 pessoas foi atingido para este dia.');
        setActiveStep(1);
      } else {
        alert('Erro ao enviar reserva: ' + error.message);
      }
    } else {
      setIsSuccess(true);
      if (finalGuests < 15) {
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
    
    // We use a custom RPC to bypass RLS safely for this specific lookup
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

    // Atualiza no banco de dados para 'pendente' com a nova quantidade
    const { error } = await supabase
      .from('reservations')
      .update({ 
        num_guests: newVal, 
        status: 'pending',
        // Se virou grupo agora, marca que precisa de pagamento
        payment_status: (newVal >= 15 && res.payment_status === 'not_required') ? 'pending' : res.payment_status,
        payment_amount: (newVal >= 15 && res.payment_amount === 0) ? 100 : res.payment_amount
      })
      .eq('id', res.id);

    if (error) {
      alert('Erro ao solicitar alteração: ' + error.message);
      return;
    }

    // Atualiza a lista local para o cliente ver o status 'Pendente'
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

  const renderStepHeader = (stepNum: number, Icon: any, title: string, value: string | undefined | null) => {
    const isActive = activeStep === stepNum;
    const isCompleted = activeStep > stepNum;
    
    return (
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isActive ? 'bg-[#F5F2ED]' : 'hover:bg-[#F5F2ED]/50'}`}
        onClick={() => setActiveStep(stepNum)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full flex items-center justify-center ${isActive ? 'bg-[#4A3728] text-white' : isCompleted ? 'bg-[#EBE3D5] text-[#4A3728]' : 'bg-[#EBE3D5]/50 text-[#4A3728]/50'}`}>
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
          </div>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-[#4A3728]' : 'text-[#4A3728]/70'}`}>{title}</h3>
            {value && !isActive && <p className="text-[10px] text-[#4A3728]/80 mt-0.5 tracking-wide">{value}</p>}
          </div>
        </div>
        <div>
          {isCompleted && !isActive ? (
            <CheckCircle2 className="text-[#4A3728]/80" size={18} />
          ) : (
            <ChevronDown className={`text-[#4A3728]/50 transition-transform ${isActive ? 'rotate-180' : ''}`} size={18} />
          )}
        </div>
      </div>
    );
  };

  const getConfirmationText = () => {
    const finalGuests = guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0);
    if (finalGuests >= 15) return "Reservar e Pagar";
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
          
          {(guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0)) >= 15 && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[24px] text-left animate-in fade-in zoom-in duration-500">
              <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={16} /> Pagamento de Grupo
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed mb-4">
                Para reservas acima de 15 pessoas, é necessário o pagamento de <strong>R$ 100,00</strong> (revertido em consumação).
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
                Pagar com Stone (R$ 100,00)
              </a>
              <p className="text-[9px] text-amber-700/60 text-center italic">
                *Após o pagamento, clique no botão abaixo para nos enviar o comprovante.
              </p>
            </div>
          )}

          <button 
            onClick={() => handleWhatsAppRedirect('success', guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0))}
            className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold uppercase tracking-wider text-xs mb-3 flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-all"
          >
            <MessageCircle size={18} />
            { (guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0)) >= 15 ? 'Enviar Comprovante de Pagamento' : 'Confirmar no WhatsApp' }
          </button>
          <p className="text-center text-[9px] opacity-60 mb-6 px-4">
            { (guests === 20 ? (parseInt(customGuestCount) || 20) : (guests || 0)) >= 15 
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
        
        {/* Header */}
        <div className="bg-[#4A3728] text-white p-5 pt-8 text-center">
          <h1 className="text-xl sm:text-2xl font-serif tracking-[2px] sm:tracking-[4px] uppercase leading-tight">Duna Cozinha & Bar</h1>
        </div>

        {/* View Mode Toggle */}
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

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'reserve' ? (
            <div className="divide-y divide-[#D9CFC1]">
              {/* Step 1: Date */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(1, Calendar, "Qual a data?", date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '')}
                {activeStep === 1 && (
                  <div className="p-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CalendarPicker 
                      selectedDate={date} 
                      disabledDates={fullyBookedDates}
                      onDateSelect={(newDate) => {
                        setDate(newDate);
                        fetchCapacity(newDate);
                        handleNext(1);
                      }} 
                    />
                  </div>
                )}
              </div>

              {/* Step 2: Guests */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(2, Users, "Quantas pessoas?", guests ? `${guests} pessoa${guests > 1 ? 's' : ''}` : '')}
                {activeStep === 2 && (
                  <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    {capacityError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-red-800">
                          <strong>Capacidade Esgotada:</strong> Infelizmente já atingimos o limite de 80 pessoas para este dia no sistema. Tente outra data ou fale conosco no WhatsApp.
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {guestOptions.map((num) => (
                        <button
                          key={num}
                          disabled={capacityError && guests !== num}
                          onClick={() => {
                            setGuests(num);
                            if (num < 20) setCustomGuestCount('');
                          }}
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                            guests === num
                              ? 'border-[#4A3728] bg-[#4A3728] text-white'
                              : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED] disabled:opacity-20 disabled:cursor-not-allowed'
                          }`}
                        >
                          {num === 20 ? '20+' : num}
                        </button>
                      ))}
                    </div>

                    {guests === 20 && (
                      <div className="mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 ml-1 mb-1 block">Quantidade Exata</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="20"
                          value={customGuestCount}
                          onChange={(e) => setCustomGuestCount(e.target.value)}
                          placeholder="Ex: 25"
                          className="w-full px-4 py-3 bg-white border border-[#D9CFC1] rounded-xl text-base focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none placeholder:text-[#4A3728]/50 text-[#4A3728]"
                        />
                      </div>
                    )}

                    {guests && (totalGuestsForDate + (guests === 20 ? (parseInt(customGuestCount) || 20) : guests) > CAPACITY_LIMIT) && (
                      <div className="mt-3 mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-relaxed text-red-800 font-medium">
                            A capacidade para este dia foi atingida. Por favor, fale conosco no WhatsApp para verificar disponibilidades extras ou eventos privados.
                          </p>
                        </div>
                        <button 
                          onClick={() => handleWhatsAppRedirect('capacity_overflow', guests === 20 ? (parseInt(customGuestCount) || 20) : guests)}
                          className="w-full bg-[#25D366] text-white rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={14} />
                          Falar com o Duna no WhatsApp
                        </button>
                      </div>
                    )}

                    {guests && guests >= 15 && (
                      <div className="mt-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-relaxed text-amber-800">
                            <strong>Reserva de Grupo:</strong> Acima de 15 pessoas requer pagamento de taxa de R$ 100,00 (100% consumível).
                          </p>
                        </div>
                        <div className="pl-8 text-[9px] text-red-700 font-medium leading-tight">
                          *Tolerância de 20 min. O valor não é reembolsável em caso de atraso ou cancelamento.
                        </div>
                      </div>
                    )}

                    <button 
                      disabled={!guests || (totalGuestsForDate + (guests === 20 ? (parseInt(customGuestCount) || 20) : guests) > CAPACITY_LIMIT)}
                      onClick={() => handleNext(2)}
                      className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3: Time */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(3, Clock, "Qual o horário?", time)}
                {activeStep === 3 && (
                  <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {getAvailableTimes(date).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTime(t)}
                          className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                            time === t
                              ? 'border-[#4A3728] bg-[#4A3728] text-white'
                              : 'border-[#D9CFC1] text-[#4A3728] hover:bg-[#F5F2ED]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {!checkLeadTime(date, time) && time && (
                      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
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

                    <button 
                      disabled={!time || !checkLeadTime(date, time)}
                      onClick={() => handleNext(3)}
                      className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>

              {/* Step 4: Notes */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(4, MessageSquare, "Alguma observação?", notes ? 'Adicionada' : 'Nenhuma')}
                {activeStep === 4 && (
                  <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Aniversário, cadeira de rodas, alguma alergia grave..."
                      className="w-full px-4 py-3 bg-white border border-[#D9CFC1] rounded-xl text-base focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none resize-none h-24 mb-4 placeholder:text-[#4A3728]/50 text-[#4A3728]"
                    ></textarea>
                    <button 
                      onClick={() => handleNext(4)}
                      className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3d2d21] transition-colors"
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>

              {/* Step 5: User Data */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(5, User, "Seus dados", formData.name)}
                {activeStep === 5 && (
                  <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-3 mb-6">
                      <div>
                        <input
                          type="text"
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                            formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                          }`}
                          value={formData.name}
                          onChange={(e) => {
                            setFormData({...formData, name: e.target.value});
                            if (formErrors.name) setFormErrors({...formErrors, name: ''});
                          }}
                          placeholder="Nome completo"
                        />
                        {formErrors.name && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.name}</p>}
                      </div>
                      <div>
                        <input
                          type="email"
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                            formErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                          }`}
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({...formData, email: e.target.value});
                            if (formErrors.email) setFormErrors({...formErrors, email: ''});
                          }}
                          placeholder="E-mail: joao@email.com"
                        />
                        {formErrors.email && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.email}</p>}
                      </div>
                      <div>
                        <input
                          type="tel"
                          inputMode="tel"
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-base focus:ring-1 outline-none placeholder:text-[#4A3728]/50 text-[#4A3728] ${
                            formErrors.whatsapp ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728] focus:border-[#4A3728]'
                          }`}
                          value={formData.whatsapp}
                          onChange={(e) => {
                            setFormData({...formData, whatsapp: e.target.value});
                            if (formErrors.whatsapp) setFormErrors({...formErrors, whatsapp: ''});
                          }}
                          placeholder="WhatsApp: (11) 99999-9999"
                        />
                        {formErrors.whatsapp && <p className="text-red-500 text-[10px] mt-1 ml-1">{formErrors.whatsapp}</p>}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (validateForm()) {
                          handleNext(5);
                        }
                      }}
                      className="w-full bg-[#4A3728] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#3d2d21] transition-colors"
                    >
                      Ver Resumo
                    </button>
                  </div>
                )}
              </div>

              {/* Step 6: Summary & Policy Acceptance */}
              <div className="bg-[#FDFBF7]">
                {renderStepHeader(6, CheckCircle2, "Confirmar e Finalizar", activeStep === 6 ? "Revisão Final" : "")}
                {activeStep === 6 && (
                  <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-white p-5 rounded-2xl border border-[#D9CFC1] shadow-sm mb-6 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#4A3728]/60 font-bold uppercase tracking-widest">Data</span>
                        <span className="font-bold">{date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : ''}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#4A3728]/60 font-bold uppercase tracking-widest">Horário</span>
                        <span className="font-bold">{time}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#4A3728]/60 font-bold uppercase tracking-widest">Pessoas</span>
                        <span className="font-bold">{guests === 20 ? customGuestCount : guests} convidados</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-[#F5F2ED] pt-3">
                        <span className="text-[#4A3728]/60 font-bold uppercase tracking-widest">Nome</span>
                        <span className="font-bold truncate max-w-[150px]">{formData.name}</span>
                      </div>
                      
                      <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
                        <div className="flex items-center gap-2 text-red-800 font-bold uppercase tracking-[1px] text-[9px] mb-1">
                          <Clock size={12} />
                          <span>Política de Atraso: 20 Minutos</span>
                        </div>
                        <p className="text-[9px] text-red-700 leading-tight">
                          Após 20 minutos de atraso, a reserva é cancelada automaticamente. Para grupos (15+), o valor da taxa não é reembolsável.
                        </p>
                      </div>
                    </div>

                    <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                      <div className="relative flex items-center h-5">
                        <input
                          id="terms-check"
                          type="checkbox"
                          checked={policyAccepted}
                          onChange={(e) => setPolicyAccepted(e.target.checked)}
                          className="w-5 h-5 rounded-md border-amber-300 text-[#4A3728] focus:ring-[#4A3728] cursor-pointer"
                        />
                      </div>
                      <label htmlFor="terms-check" className="text-[11px] leading-relaxed text-amber-900 cursor-pointer font-medium">
                        Estou ciente da política de <strong className="text-red-700">20 min de tolerância</strong> e que a taxa de reserva de grupo <strong className="text-red-700">não é reembolsável</strong> em caso de atraso ou cancelamento.
                      </label>
                    </div>

                    <button 
                      disabled={!policyAccepted || isSubmitting}
                      onClick={handleSubmit}
                      className={`w-full py-4 text-white rounded-2xl font-bold uppercase tracking-[2px] text-xs shadow-xl transition-all flex items-center justify-center gap-2 ${
                        policyAccepted ? 'bg-[#4A3728] hover:bg-[#3d2d21] active:scale-[0.98]' : 'bg-stone-300 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : getConfirmationText()}
                      {!isSubmitting && <ChevronDown className="-rotate-90" size={16} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Minhas Reservas View */
            <div className="p-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-lg font-serif font-bold mb-2">Consultar Reservas</h2>
                <p className="text-[11px] opacity-60 leading-relaxed uppercase tracking-widest">
                  Informe seu WhatsApp para acompanhar o status da sua reserva.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="(69) 9 9999-9999"
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
                                  className="flex-1 px-4 py-2.5 bg-[#F5F2ED] border-none rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-[#4A3728]"
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

        {/* Removido Footer antigo pois agora temos o Passo 6 */}

      </div>

      {/* Payment Modal for Quantity Change */}
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

      {/* Cancel Confirmation Modal */}
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

      {/* Footer Info */}
      <div className="mt-12 w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
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
          href="https://wa.me/5569992564637" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#D9CFC1] hover:bg-white/80 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-[#25D366] text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
            <MessageCircle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/60 mb-1">WhatsApp</p>
            <p className="text-sm font-bold tracking-tight">(69) 9 9256-4637</p>
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
