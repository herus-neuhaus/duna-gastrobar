'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, MessageSquare, CheckCircle2, ChevronDown, AlertCircle, Loader2, MapPin, Instagram, MessageCircle, AlertTriangle, Utensils, Search, History, CalendarCheck, XCircle, CalendarOff, BookOpen, Navigation, ShieldCheck, ArrowLeft, Copy } from 'lucide-react';
import { format, parse, isAfter, addHours, differenceInHours, getDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ReservationCredential = { id: string; token: string; phone: string };

const RESERVATION_CREDENTIALS_KEY = 'duna-reservation-credentials';

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
  const [formData, setFormData] = useState({ name: '', email: '', whatsapp: '', cpf: '' });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', whatsapp: '', cpf: '' });
  
  // Status States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [reservationAccessToken, setReservationAccessToken] = useState('');
  const [reservationPaymentAmount, setReservationPaymentAmount] = useState(0);
  const [pixPayment, setPixPayment] = useState<{
    orderId: string;
    qrCode: string;
    qrCodeUrl?: string;
    expiresAt?: string;
    amount: number;
  } | null>(null);
  const [pixError, setPixError] = useState('');
  const [isCreatingPix, setIsCreatingPix] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [capacityError, setCapacityError] = useState(false);
  const [totalGuestsForDate, setTotalGuestsForDate] = useState(0);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [allSpecialDates, setAllSpecialDates] = useState<any[]>([]);
  const [allBlockedDates, setAllBlockedDates] = useState<any[]>([]);
  const [availableTimesByDate, setAvailableTimesByDate] = useState<Record<string, string[]>>({});
  const [specialDateInfo, setSpecialDateInfo] = useState<any>(null);
  const [specialDatesOptions, setSpecialDatesOptions] = useState<any[]>([]);
  const [decorations, setDecorations] = useState<Array<{ id: string; name: string; image_url: string }>>([]);
  const [decorationId, setDecorationId] = useState('');
  
  // States for "My Reservations"
  const [pageView, setPageView] = useState<'home' | 'reservation'>('home');
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
  const [paymentCpf, setPaymentCpf] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryChallengeId, setRecoveryChallengeId] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  
  const CAPACITY_LIMIT = 80;
  const WHATSAPP_NUMBER = "5569992564637";
  const requiresPayment = (guests || 0) >= 15 || Boolean(specialDateInfo?.requires_fee);

  const getStoredReservationCredentials = (): ReservationCredential[] => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(RESERVATION_CREDENTIALS_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter((item): item is ReservationCredential => (
        typeof item?.id === 'string' && typeof item?.token === 'string' && typeof item?.phone === 'string'
      )) : [];
    } catch {
      return [];
    }
  };

  const saveReservationCredential = (credential: ReservationCredential) => {
    const credentials = getStoredReservationCredentials().filter((item) => item.id !== credential.id);
    window.localStorage.setItem(RESERVATION_CREDENTIALS_KEY, JSON.stringify([...credentials, credential]));
  };

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
    const errors = { name: '', email: '', whatsapp: '', cpf: '' };

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

    if (requiresPayment && formData.cpf.replace(/\D/g, '').length !== 11) {
      errors.cpf = 'Informe um CPF válido para gerar o PIX.';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const getAvailableTimes = (selectedDate: string) => {
    return availableTimesByDate[selectedDate] || [];
  };

  const checkLeadTime = (selectedDate: string, selectedTime: string) => {
    if (!selectedDate || !selectedTime) return true;
    
    const reservationDateTime = parse(`${selectedDate} ${selectedTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const now = new Date();
    const diff = differenceInHours(reservationDateTime, now);
    
    return diff >= 8;
  };

  const fetchCapacity = async (selectedDate: string) => {
    try {
      const response = await fetch(`/api/reservations/availability?from=${selectedDate}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      const total = result.totals?.[selectedDate] || 0;
      setTotalGuestsForDate(total);
      setCapacityError(total >= CAPACITY_LIMIT);
    } catch {
      setTotalGuestsForDate(0);
      setCapacityError(false);
    }
  };

  const fetchFullDates = async () => {
    const firstDate = format(datesList[0], 'yyyy-MM-dd');
    const lastDate = format(datesList[datesList.length - 1], 'yyyy-MM-dd');
    try {
      const response = await fetch(`/api/reservations/availability?from=${firstDate}&to=${lastDate}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setFullyBookedDates(result.fullDates || []);
      setAllSpecialDates(result.specialDates || []);
      setAllBlockedDates(result.blockedDates || []);
      setAvailableTimesByDate(result.availableTimes || {});
    } catch {
      setFullyBookedDates([]);
      setAllSpecialDates([]);
      setAllBlockedDates([]);
      setAvailableTimesByDate({});
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchFullDates();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetch('/api/decorations', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { decorations: [] })
        .then((result) => setDecorations(result.decorations || []))
        .catch(() => setDecorations([]));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const fetchSpecialDate = (selectedDate: string) => {
    const data = allSpecialDates.filter((specialDate) => specialDate.date === selectedDate);
    if (data.length > 0) {
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
    setFormData({ name: '', email: '', whatsapp: '', cpf: '' });
    setFormErrors({ name: '', email: '', whatsapp: '', cpf: '' });
    setIsSuccess(false);
    setReservationId('');
    setReservationAccessToken('');
    setReservationPaymentAmount(0);
    setPixPayment(null);
    setPixError('');
    setPixCopied(false);
    setCapacityError(false);
    setTotalGuestsForDate(0);
    setCustomGuestCount('');
    setPolicyAccepted(false);
    setSpecialDateInfo(null);
    setSpecialDatesOptions([]);
    setDecorationId('');
  };

  const createPixPayment = async (id: string, accessToken = reservationAccessToken, cpf = formData.cpf) => {
    setIsCreatingPix(true);
    setPixError('');

    try {
      const response = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: id, accessToken, cpf }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível gerar o PIX.');
      }

      setPixPayment(data);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.');
    } finally {
      setIsCreatingPix(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const finalGuests = guests || 0;

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          cpf: formData.cpf,
          date,
          time,
          guests: finalGuests,
          notes,
          specialDateId: specialDateInfo?.id || null,
          decorationId: decorationId || null,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) setCapacityError(true);
        throw new Error(result.error || 'Não foi possível criar a reserva.');
      }

      const createdId = result.id || '';
      const accessToken = typeof result.accessToken === 'string' ? result.accessToken : '';
      if (!createdId || !accessToken) throw new Error('Não foi possível proteger o acesso à sua reserva.');

      setReservationId(createdId);
      setReservationAccessToken(accessToken);
      setReservationPaymentAmount(Number(result.paymentAmount || 0));
      saveReservationCredential({ id: createdId, token: accessToken, phone: formData.whatsapp.replace(/\D/g, '') });

      if (result.paymentRequired) {
        await createPixPayment(createdId, accessToken);
      }

      setIsSuccess(true);
      if (!result.paymentRequired) {
        handleWhatsAppRedirect('success');
      }
    } catch (error) {
      alert('Erro ao enviar reserva: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchUserReservations = async () => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const phone = searchPhone.replace(/\D/g, '');
      const credentials = getStoredReservationCredentials().filter((credential) => !phone || credential.phone === phone);
      const results = await Promise.all(credentials.map(async (credential) => {
        const response = await fetch(`/api/reservations/${credential.id}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${credential.token}` },
        });
        if (!response.ok) return null;
        const result = await response.json();
        return result.reservation || null;
      }));
      setUserReservations(results.filter(Boolean));
    } catch (error) {
      console.error('Erro na busca:', error);
      setUserReservations([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    
    setIsCancelling(true);
    try {
      const credential = getStoredReservationCredentials().find((item) => item.id === reservationToCancel);
      if (!credential) throw new Error('O acesso seguro desta reserva não está disponível neste dispositivo.');

      const response = await fetch(`/api/reservations/${reservationToCancel}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', accessToken: credential.token }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Não foi possível cancelar a reserva.');

      setUserReservations((currentReservations) => currentReservations.map((reservation) => (
        reservation.id === reservationToCancel ? { ...reservation, status: 'cancelled' } : reservation
      )));
      setShowCancelModal(false);
      setReservationToCancel(null);
    } catch (error) {
      alert('Erro ao cancelar reserva: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleChangeQuantity = async (res: any) => {
    const newVal = parseInt(newQuantityValue);
    if (!newQuantityValue || newVal < 1 || newVal > 30) {
      alert('Informe uma quantidade entre 1 e 30 pessoas.');
      return;
    }

    try {
      const credential = getStoredReservationCredentials().find((item) => item.id === res.id);
      if (!credential) throw new Error('O acesso seguro desta reserva não está disponível neste dispositivo.');
      const response = await fetch(`/api/reservations/${res.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          accessToken: credential.token,
          date: res.reservation_date,
          time: res.reservation_time.slice(0, 5),
          guests: newVal,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível alterar a reserva.');
      setUserReservations((current) => current.map((reservation) => reservation.id === res.id ? { ...reservation, ...result.reservation } : reservation));
      setEditingQuantityId(null);
      setNewQuantityValue('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível alterar a reserva.');
    }
  };

  const requestRecoveryCode = async () => {
    setRecoveryMessage('');
    try {
      const response = await fetch('/api/reservations/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível solicitar o código.');
      setRecoveryChallengeId(result.challengeId || '');
      setRecoveryMessage('Se houver reservas ativas para este e-mail, enviamos um código de acesso.');
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'Não foi possível solicitar o código.');
    }
  };

  const verifyRecoveryCode = async () => {
    setRecoveryMessage('');
    try {
      const response = await fetch('/api/reservations/recovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail, code: recoveryCode, challengeId: recoveryChallengeId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Código inválido ou expirado.');
      const phone = searchPhone.replace(/\D/g, '');
      for (const credential of result.credentials || []) saveReservationCredential({ ...credential, phone });
      setRecoveryCode('');
      setRecoveryMessage('Acesso recuperado neste dispositivo. Use a busca para ver suas reservas.');
      void fetchUserReservations();
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'Não foi possível validar o código.');
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const getConfirmationText = () => {
    if (requiresPayment) return "Reservar e Pagar";
    return "Confirmar Reserva";
  };

  const changePageView = (nextView: 'home' | 'reservation') => {
    window.scrollTo(0, 0);
    setPageView(nextView);
  };

  if (isSuccess) {
    return (
      <div className="duna-site min-h-screen flex items-center justify-center p-4 font-sans text-[#f8ead0]">
        <div className="duna-success-card w-full max-w-[420px] rounded-[32px] shadow-2xl overflow-hidden p-8 sm:p-12 text-center">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-2">Reserva solicitada!</h1>
          <p className="text-sm opacity-70 mb-8">
            {requiresPayment
              ? 'Sua mesa foi registrada. Conclua o pagamento PIX para confirmar a reserva.'
              : 'Recebemos seu pedido. Confirme os detalhes com nossa equipe pelo WhatsApp.'}
          </p>

          {requiresPayment && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[24px] text-left animate-in fade-in zoom-in duration-500">
              <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={16} /> PIX da reserva
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed mb-4">
                Taxa de <strong>R$ {(pixPayment?.amount || reservationPaymentAmount).toFixed(2).replace('.', ',')}</strong>, revertida em consumação. A confirmação é automática após o pagamento.
              </p>

              {isCreatingPix && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-amber-900">
                  <Loader2 size={20} className="animate-spin" /> Gerando PIX seguro...
                </div>
              )}

              {pixPayment && (
                <div className="space-y-3">
                  {pixPayment.qrCodeUrl && (
                    <img
                      src={pixPayment.qrCodeUrl}
                      alt="QR Code PIX da reserva"
                      className="mx-auto aspect-square w-full max-w-56 rounded-2xl bg-white p-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(pixPayment.qrCode);
                      setPixCopied(true);
                      window.setTimeout(() => setPixCopied(false), 2500);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A3728] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white active:scale-[0.98]"
                  >
                    {pixCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {pixCopied ? 'Código copiado' : 'Copiar PIX copia e cola'}
                  </button>
                  <p className="text-center text-[9px] text-amber-800/70">O código PIX expira em 30 minutos.</p>
                </div>
              )}

              {pixError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                  <p className="mb-3 text-[10px] font-semibold text-red-700">{pixError}</p>
                  <button
                    type="button"
                    disabled={isCreatingPix || !reservationId}
                    onClick={() => createPixPayment(reservationId, reservationAccessToken)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
                  >
                    Tentar gerar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => handleWhatsAppRedirect('success', guests || 0)}
            className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold uppercase tracking-wider text-xs mb-3 flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-all"
          >
            <MessageCircle size={18} />
            {requiresPayment ? 'Falar com a equipe' : 'Confirmar no WhatsApp'}
          </button>
          <p className="text-center text-[9px] opacity-60 mb-6 px-4">
            {requiresPayment
              ? 'Não é necessário enviar comprovante: o pagamento é confirmado automaticamente.'
              : 'Clique acima para notificar nossa equipe sobre sua reserva.'}
          </p>
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
    <div className="duna-site min-h-screen flex flex-col items-center justify-start py-0 sm:py-8 font-sans text-[#f8ead0] overflow-x-hidden">
      <div className="duna-shell w-full max-w-[460px] sm:rounded-[34px] shadow-2xl overflow-hidden flex flex-col shrink-0">
        
        {pageView === 'home' && (
          <>
        {/* Abertura */}
        <div className="duna-hero h-[500px] w-full relative isolate text-white">
          <img 
            src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=90&w=1200"
            alt="Prato servido no Duna Cozinha & Bar"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-[#100905]" />
          <div className="absolute inset-x-0 top-0 flex justify-center pt-9">
            <div className="duna-brand flex flex-col items-center drop-shadow-lg">
              <img src="/Favicon-D.png" alt="Duna" className="w-16 h-16 object-contain mb-2" />
              <h1 className="font-serif text-5xl tracking-[0.22em] pl-[0.22em] text-[#f8e3b2]">DUNA</h1>
              <p className="mt-1 text-[10px] font-semibold tracking-[0.42em] pl-[0.42em] text-[#f5dfaa]">COZINHA E BAR</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
             <button
               type="button"
               onClick={() => changePageView('reservation')}
               className="duna-gold-button flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-wide text-[#1c1108] transition-transform active:scale-[0.98]"
             >
               <Calendar size={21} />
               Reservar minha mesa
             </button>
          </div>
        </div>

        <div className="duna-links px-5 py-5 space-y-3">
          <a
            href="https://dunacozinhabar.cfshop.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="duna-dark-link flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors"
          >
            <BookOpen size={21} />
            Ver cardápio
          </a>
          <a
            href="https://maps.app.goo.gl/2zmtd2zZ4wrSxxCT7"
            target="_blank"
            rel="noopener noreferrer"
            className="duna-dark-link flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors"
          >
            <Navigation size={21} />
            Como chegar
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="duna-dark-link flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors"
          >
            <MessageCircle size={21} />
            Falar no WhatsApp
          </a>
          <a
            href="https://www.instagram.com/dunacozinhabar/"
            target="_blank"
            rel="noopener noreferrer"
            className="duna-dark-link flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition-colors"
          >
            <Instagram size={21} />
            Ver Instagram
          </a>
          <div className="border-t border-[#704126] px-2 pt-4 text-[#f8e3b2]">
            <div className="flex items-start gap-3">
              <Clock size={20} className="mt-0.5 shrink-0 text-[#e9a930]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9a930]">Horário de funcionamento</p>
                <p className="mt-1 text-sm text-white/90">Terça a domingo: 11h30 às 23h00</p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <MapPin size={20} className="mt-0.5 shrink-0 text-[#e9a930]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9a930]">Endereço</p>
                <p className="mt-1 text-sm leading-relaxed text-white/90">Av. Pinheiro Machado, 1356 - São Cristóvão, Porto Velho - RO</p>
              </div>
            </div>
          </div>
        </div>
          </>
        )}

        {pageView === 'reservation' && (
          <>
        {viewMode === 'reserve' && (
          <section className="duna-reservation-heading px-7 pb-7 pt-6 text-center">
            <button
              type="button"
              onClick={() => changePageView('home')}
              className="mb-4 flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f4825]"
              aria-label="Voltar para o início"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>
            <div className="duna-mini-brand mb-7">
              <img src="/Favicon-D.png" alt="" className="mx-auto mb-1 h-10 w-10 object-contain" />
              <p className="font-serif text-3xl font-semibold tracking-[0.22em] pl-[0.22em]">DUNA</p>
              <p className="text-[8px] font-semibold tracking-[0.36em] pl-[0.36em]">COZINHA E BAR</p>
            </div>
            <h2 className="font-serif text-[42px] leading-[0.94] font-semibold text-[#2a170d]">Garanta sua<br />Mesa no Duna</h2>
            <div className="mt-5 flex items-center justify-center gap-3 text-[#a56818]">
              <span className="h-px w-9 bg-current" />
              <p className="text-sm font-semibold">Reserve em poucos segundos</p>
              <span className="h-px w-9 bg-current" />
            </div>
          </section>
        )}

        {/* Alternador de Modos (Abas) */}
        <div className="duna-tabs flex p-1 mx-4 mt-4 rounded-2xl">
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
        <div className="duna-reservation-area flex-1 overflow-y-auto">
          {viewMode === 'reserve' ? (
            <div className="p-4 sm:p-5">
              <div className="duna-form-card bg-white border border-[#D9CFC1] rounded-[28px] shadow-sm flex flex-col">
                
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
                {guests && requiresPayment && (
                  <div className="p-4 bg-amber-50 border-t border-[#D9CFC1] flex flex-col gap-2 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                        {specialDateInfo?.requires_fee 
                          ? <span><strong>{specialDateInfo.description || 'Data Especial'}:</strong> Requer pagamento de taxa de reserva de R$ {Number(specialDateInfo.fee_amount).toFixed(2).replace('.', ',')} (100% revertido em consumação).</span>
                          : <span><strong>Reserva de Grupo:</strong> 15 ou mais pessoas requerem pagamento de taxa de R$ 100,00 (100% revertido em consumação).</span>
                        }
                      </p>
                    </div>
                    <p className="text-[9px] text-red-700 font-bold leading-tight pl-8">
                      *Tolerância de 20 min. O valor não é reembolsável em caso de atraso ou cancelamento.
                    </p>
                  </div>
                )}

                {date && guests && time && checkLeadTime(date, time) && decorations.length > 0 && (
                  <div className="border-t border-[#D9CFC1] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A3728]/60">Espaço ou decoração (Opcional)</p>
                        <p className="mt-1 text-[10px] text-[#4A3728]/45">Escolha uma opção para a sua ocasião.</p>
                      </div>
                      {decorationId && <button type="button" onClick={() => setDecorationId('')} className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/60">Limpar</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {decorations.map((decoration) => (
                        <button
                          type="button"
                          key={decoration.id}
                          onClick={() => setDecorationId(decoration.id)}
                          className={`overflow-hidden rounded-xl border text-left transition-all ${decorationId === decoration.id ? 'border-[#4A3728] ring-1 ring-[#4A3728]' : 'border-[#D9CFC1]'}`}
                        >
                          <img src={decoration.image_url} alt="" className="h-20 w-full object-cover" />
                          <span className="block px-3 py-2 text-[10px] font-bold text-[#4A3728]">{decoration.name}</span>
                        </button>
                      ))}
                    </div>
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
                    {requiresPayment && (
                      <div>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:ring-1 outline-none placeholder:text-[#4A3728]/40 text-[#4A3728] ${
                            formErrors.cpf ? 'border-red-500 focus:ring-red-500' : 'border-[#D9CFC1] focus:ring-[#4A3728]'
                          }`}
                          value={formData.cpf}
                          onChange={(e) => {
                            setFormData({...formData, cpf: formatCpf(e.target.value)});
                            if (formErrors.cpf) setFormErrors({...formErrors, cpf: ''});
                          }}
                          placeholder="CPF para o pagamento PIX"
                        />
                        {formErrors.cpf && <p className="text-red-500 text-[9px] mt-1 ml-1 font-medium">{formErrors.cpf}</p>}
                        <p className="ml-1 mt-1 text-[8px] text-[#4A3728]/50">Exigido pelo Pagar.me para gerar o PIX.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* POLÍTICA DE ATRASO / CONCORDÂNCIA */}
                {date && guests && time && formData.name && formData.email && formData.whatsapp && (!requiresPayment || formData.cpf) && (
                  <div className="p-4 bg-amber-50 border-t border-[#D9CFC1] flex items-start gap-3 animate-in fade-in duration-300">
                    <input
                      id="terms-check"
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="w-5 h-5 rounded-md border-amber-300 text-[#4A3728] focus:ring-[#4A3728] cursor-pointer mt-0.5"
                    />
                    <label htmlFor="terms-check" className="text-[11px] leading-normal text-amber-900 cursor-pointer font-medium">
                      Estou ciente da política de <strong className="text-red-700">20 min de tolerância</strong>
                      {requiresPayment && (
                        <> e que a taxa de reserva <strong className="text-red-700">não é reembolsável</strong> em caso de atraso ou cancelamento</>
                      )}.
                    </label>
                  </div>
                )}

                {/* BOTÃO DE CONFIRMAÇÃO */}
                <div className="p-4 border-t border-[#D9CFC1] bg-white rounded-b-[28px]">
                  <button
                    disabled={!date || !guests || !time || !formData.name || !formData.email || !formData.whatsapp || (requiresPayment && !formData.cpf) || !policyAccepted || isSubmitting}
                    onClick={async () => {
                      if (validateForm()) {
                        await handleSubmit();
                      }
                    }}
                    className={`duna-submit w-full py-4 text-white rounded-2xl font-bold uppercase tracking-[2px] text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                       policyAccepted && date && guests && time && formData.name && formData.whatsapp && (!requiresPayment || formData.cpf)
                       ? 'is-ready active:scale-[0.98]'
                      : 'bg-stone-300 cursor-not-allowed shadow-none text-stone-500'
                    }`}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : getConfirmationText()}
                  </button>
                </div>
                  </>
                )}

              </div>
              <div className="duna-trust mt-5 flex items-center justify-center gap-3 text-[#d8a34c]">
                <span className="h-px flex-1 bg-current opacity-50" />
                <ShieldCheck size={18} />
                <span className="h-px flex-1 bg-current opacity-50" />
              </div>
              <p className="text-center text-[9px] uppercase tracking-wider text-[#e8d6ba]/70 mt-2">
                Tolerância de 20min · Serviço à la carte
              </p>
            </div>
          ) : (
            /* VISUALIZAÇÃO: MINHAS RESERVAS */
            <div className="p-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                  <h2 className="text-lg font-serif font-bold mb-2 text-[#4A3728]">Minhas Reservas 🔎</h2>
                <p className="text-[11px] opacity-60 leading-relaxed uppercase tracking-widest text-[#4A3728]">
                  As reservas feitas neste dispositivo ficam disponíveis aqui. Informe seu WhatsApp apenas para filtrar.
                </p>
              </div>

               <div className="space-y-4 mb-8">
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="Filtrar por WhatsApp (opcional)"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(formatPhoneNumber(e.target.value))}
                    className="w-full px-5 py-4 bg-white border border-[#D9CFC1] rounded-2xl text-base focus:ring-1 focus:ring-[#4A3728] focus:border-[#4A3728] outline-none shadow-sm transition-all"
                  />
                  <button 
                    onClick={fetchUserReservations}
                    disabled={isSearching}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-[#4A3728] text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                 </div>
                 <div className="rounded-2xl border border-[#D9CFC1] bg-[#F5F2ED] p-4">
                   <p className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/70">
                     <ShieldCheck size={14} /> Acessar de outro dispositivo
                   </p>
                   <div className="flex gap-2">
                     <input
                       type="email"
                       placeholder="Seu e-mail da reserva"
                       value={recoveryEmail}
                       onChange={(event) => setRecoveryEmail(event.target.value)}
                       className="min-w-0 flex-1 rounded-xl border border-[#D9CFC1] bg-white px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#4A3728]"
                     />
                     <button type="button" onClick={requestRecoveryCode} className="rounded-xl bg-[#4A3728] px-3 text-[9px] font-bold uppercase tracking-wider text-white">
                       Enviar código
                     </button>
                   </div>
                   {recoveryChallengeId && (
                     <div className="mt-2 flex gap-2">
                       <input
                         inputMode="numeric"
                         maxLength={6}
                         placeholder="Código de 6 dígitos"
                         value={recoveryCode}
                         onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ''))}
                         className="min-w-0 flex-1 rounded-xl border border-[#D9CFC1] bg-white px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#4A3728]"
                       />
                       <button type="button" onClick={verifyRecoveryCode} className="rounded-xl border border-[#4A3728]/30 px-3 text-[9px] font-bold uppercase tracking-wider text-[#4A3728]">
                         Validar
                       </button>
                     </div>
                   )}
                   {recoveryMessage && <p className="mt-2 text-[10px] text-[#4A3728]/70">{recoveryMessage}</p>}
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
                        ((res.status || 'pending') === 'cancelled' || res.status === 'cancelado') ? 'bg-red-100 text-red-700' :
                        (res.status || 'pending') === 'completed' ? 'bg-blue-100 text-blue-700' :
                        (res.status || 'pending') === 'no_show' ? 'bg-amber-100 text-amber-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {(res.status || 'pending') === 'confirmed' ? <CalendarCheck size={10} /> :
                          ((res.status || 'pending') === 'cancelled' || res.status === 'cancelado') ? <XCircle size={10} /> :
                          (res.status || 'pending') === 'completed' ? <History size={10} /> :
                          (res.status || 'pending') === 'no_show' ? <CalendarOff size={10} /> :
                          <Clock size={10} />}
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                          {res.status === 'confirmed' ? 'Confirmada' :
                           (res.status === 'cancelled' || res.status === 'cancelado') ? 'Cancelada' :
                           res.status === 'completed' ? 'Concluída' :
                           res.status === 'no_show' ? 'Não compareceu' :
                           'Pendente'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-[#F5F2ED]">
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
          </>
        )}

      </div>

      {/* MODAL DE PAGAMENTO (Para Alteração de Quantidade) */}
      {showPaymentInfo && paymentModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3728]/60 backdrop-blur-sm" onClick={() => setShowPaymentInfo(false)} />
          <div className="relative max-h-[92svh] w-full max-w-[380px] overflow-y-auto rounded-[32px] bg-[#FDFBF7] shadow-2xl animate-in fade-in zoom-in duration-300">
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

                {!pixPayment && (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={paymentCpf}
                      onChange={(e) => setPaymentCpf(formatCpf(e.target.value))}
                      placeholder="CPF para gerar o PIX"
                      className="mb-3 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-[#4A3728] outline-none focus:border-[#4A3728]"
                    />
                    <button
                      type="button"
                      disabled={!paymentPolicyAccepted || paymentCpf.replace(/\D/g, '').length !== 11 || isCreatingPix}
                      onClick={() => createPixPayment(paymentModalData.res.id, paymentCpf)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A3728] py-3 text-[10px] font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {isCreatingPix && <Loader2 size={16} className="animate-spin" />}
                      Gerar PIX de R$ 100,00
                    </button>
                  </>
                )}

                {pixPayment && (
                  <div className="space-y-3">
                    {pixPayment.qrCodeUrl && (
                      <img src={pixPayment.qrCodeUrl} alt="QR Code PIX" className="mx-auto aspect-square w-full max-w-52 rounded-xl bg-white p-2" />
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(pixPayment.qrCode);
                        setPixCopied(true);
                        window.setTimeout(() => setPixCopied(false), 2500);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A3728] py-3 text-[10px] font-bold uppercase tracking-widest text-white"
                    >
                      {pixCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      {pixCopied ? 'Código copiado' : 'Copiar PIX copia e cola'}
                    </button>
                  </div>
                )}

                {pixError && <p className="mt-3 text-center text-[10px] font-semibold text-red-700">{pixError}</p>}
              </div>

              <button 
                onClick={() => {
                  window.open(paymentModalData.url, '_blank');
                  setShowPaymentInfo(false);
                  setPaymentPolicyAccepted(false);
                }}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-green-200 transition-all active:scale-95"
              >
                <MessageCircle size={18} />
                Falar com a equipe
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

    </div>
  );
}
