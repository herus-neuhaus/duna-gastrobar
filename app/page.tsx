'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Button, ButtonLink } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/form-controls';
import { Feedback } from '@/components/ui/feedback';
import { Calendar, Clock, MessageSquare, CheckCircle2, AlertCircle, Loader2, MapPin, Instagram, MessageCircle, AlertTriangle, Search, History, CalendarCheck, XCircle, CalendarOff, Navigation, ArrowLeft, Copy } from 'lucide-react';
import { format, parse } from 'date-fns';
import { buildDuplicateReservationMessage, type DuplicateReservationChoice } from '@/lib/reservation-duplicate-message';
import HorariosFuncionamento from '@/app/components/HorariosFuncionamento';
import PublicReservationForm, { ReservationSummary, type PublicSpecialDate, type PublicDecoration, type ReservationSelection } from '@/app/components/PublicReservationForm';
import ReservationProgress from '@/app/components/ReservationProgress';
import { getReservationPayment } from '@/lib/reservation-payment';
import { formatReservationCpf, getPublicReservationDates, RESERVATION_MIN_LEAD_HOURS, type PublicReservationContact } from '@/lib/public-reservation-form';

type ReservationCredential = { id: string; token: string; phone: string };
type DuplicateReservation = { time: string; guests: number; turn: 'lunch' | 'dinner' };

const RESERVATION_CREDENTIALS_KEY = 'duna-reservation-credentials';

export default function DunaGastrobarReservation() {
  // Form Fields
  const [bookingStep, setBookingStep] = useState<'reservation' | 'details'>('reservation');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [formData, setFormData] = useState<PublicReservationContact>({ name: '', whatsapp: '', cpf: '', email: '' });
  const [submissionError, setSubmissionError] = useState('');
  const submissionRef = useRef(false);
  
  // Status States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [duplicateReservation, setDuplicateReservation] = useState<DuplicateReservation | null>(null);
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
  const [copyError, setCopyError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [reservationState, setReservationState] = useState<{ status: string; paymentStatus: string } | null>(null);
  const [statusError, setStatusError] = useState('');
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [allSpecialDates, setAllSpecialDates] = useState<PublicSpecialDate[]>([]);
  const [allBlockedDates, setAllBlockedDates] = useState<{ date: string }[]>([]);
  const [availableTimesByDate, setAvailableTimesByDate] = useState<Record<string, string[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState('');
  const [timeTurnsByDate, setTimeTurnsByDate] = useState<Record<string, Record<string, string>>>({});
  const [turnTotals, setTurnTotals] = useState<Record<string, number>>({});
  const [specialDateInfo, setSpecialDateInfo] = useState<PublicSpecialDate | null>(null);
  const [decorations, setDecorations] = useState<PublicDecoration[]>([]);
  const [decorationsLoading, setDecorationsLoading] = useState(false);
  const [decorationsError, setDecorationsError] = useState('');
  const [decorationRequest, setDecorationRequest] = useState(0);
  const [decorationId, setDecorationId] = useState('');
  
  // States for "My Reservations"
  const [pageView, setPageView] = useState<'home' | 'reservation'>('home');
  const [viewMode, setViewMode] = useState<'reserve' | 'check'>('reserve');
  const [searchPhone, setSearchPhone] = useState('');
  const [userReservations, setUserReservations] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchRef = useRef(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [newQuantityValue, setNewQuantityValue] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentPolicyAccepted, setPaymentPolicyAccepted] = useState(false);
  const [paymentCpf, setPaymentCpf] = useState('');
  
  const WHATSAPP_NUMBER = "5569992564637";
  const paymentRule = getReservationPayment(guests || 0, specialDateInfo);
  const requiresPayment = isSuccess ? reservationPaymentAmount > 0 : paymentRule.required;
  const selection: ReservationSelection = { date, guests, time, notes, decorationId, specialDate: specialDateInfo };
  const paymentPaid = reservationState?.paymentStatus === 'paid';
  const reservationConfirmed = reservationState?.status === 'confirmed';
  const reservationCancelled = ['cancelled', 'cancelado'].includes(reservationState?.status || '');

  useEffect(() => {
    if (!isSuccess) return;
    window.scrollTo(0, 0);
    resultTitleRef.current?.focus({ preventScroll: true });
  }, [isSuccess]);

  useEffect(() => {
    if (!isSuccess || !reservationId || !reservationAccessToken || !reservationPaymentAmount) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const checkUntil = Date.now() + 30 * 60 * 1000;
    const refresh = async () => {
      let finished = false;
      try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
          cache: 'no-store', headers: { Authorization: `Bearer ${reservationAccessToken}` },
        });
        if (!response.ok) throw new Error('Não foi possível atualizar a situação da reserva.');
        const result = await response.json();
        if (!result.reservation) throw new Error('Reserva não encontrada.');
        if (cancelled) return;
        const status = String(result.reservation.status || 'pending');
        const paymentStatus = String(result.reservation.payment_status || 'pending');
        setReservationState({ status, paymentStatus });
        setStatusError('');
        finished = paymentStatus === 'paid' || ['cancelled', 'cancelado', 'completed', 'no_show'].includes(status);
      } catch {
        if (!cancelled) setStatusError('Não foi possível atualizar a situação agora. A confirmação depende do sistema; se necessário, fale com a equipe.');
      }
      if (!cancelled && !finished && Date.now() < checkUntil) timeout = setTimeout(() => void refresh(), 5000);
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [isSuccess, reservationId, reservationAccessToken, reservationPaymentAmount]);

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

  const datesList = useMemo(() => getPublicReservationDates(), []);

  const fetchFullDates = useCallback(async () => {
    setLoadingAvailability(true);
    setAvailabilityError('');
    const firstDate = datesList[0];
    const lastDate = datesList[datesList.length - 1];
    try {
      const response = await fetch(`/api/reservations/availability?from=${firstDate}&to=${lastDate}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setFullyBookedDates(result.fullDates || []);
      setAllSpecialDates(result.specialDates || []);
      setAllBlockedDates(result.blockedDates || []);
      setAvailableTimesByDate(result.availableTimes || {});
      setTimeTurnsByDate(result.timeTurns || {});
      setTurnTotals(result.turnTotals || {});
    } catch {
      setAvailabilityError('Não foi possível consultar os horários. Tente novamente.');
      setFullyBookedDates([]);
      setAllSpecialDates([]);
      setAllBlockedDates([]);
      setAvailableTimesByDate({});
      setTimeTurnsByDate({});
      setTurnTotals({});
    } finally {
      setLoadingAvailability(false);
    }
  }, [datesList]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchFullDates();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchFullDates]);

  useEffect(() => {
    if (!date || !time) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setDecorationsLoading(true);
      setDecorationsError('');
    }, 0);
    void fetch(`/api/decorations?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível consultar as decorações.');
        return response.json();
      })
      .then((result) => {
        if (cancelled) return;
        const nextDecorations = result.decorations || [];
        setDecorations(nextDecorations);
        setDecorationId((currentId) => nextDecorations.some((decoration: PublicDecoration) => decoration.id === currentId && decoration.available) ? currentId : '');
      })
      .catch(() => {
        if (!cancelled) {
          setDecorations([]);
          setDecorationId('');
          setDecorationsError('Não foi possível consultar as decorações. Você pode tentar novamente ou continuar sem decoração.');
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setDecorationsLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [date, time, decorationRequest]);

  const updateSelection = (next: Partial<ReservationSelection>) => {
    if (next.date !== undefined) setDate(next.date);
    if (next.guests !== undefined) setGuests(next.guests);
    if (next.time !== undefined) setTime(next.time);
    if (next.notes !== undefined) setNotes(next.notes);
    if (next.decorationId !== undefined) setDecorationId(next.decorationId);
    if (next.specialDate !== undefined) setSpecialDateInfo(next.specialDate);
    if (next.date !== undefined || next.time !== undefined) {
      setDecorations([]);
      setDecorationsLoading(Boolean(next.time));
      setDecorationsError('');
    }
    // Não mantém dados de pagamento quando a reserva volta a ser gratuita.
    const nextPayment = getReservationPayment(next.guests === undefined ? guests || 0 : next.guests || 0,
      next.specialDate === undefined ? specialDateInfo : next.specialDate);
    if (!nextPayment.required) setFormData((current) => ({ ...current, cpf: '', email: '' }));
    setSubmissionError('');
  };

  const handleWhatsAppRedirect = (reason: 'lead_time' | 'success' | 'capacity_overflow', overrideGuests?: number) => {
    let message = "";
    const displayGuests = overrideGuests || guests;
    
    if (reason === 'lead_time') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} às ${time} para ${displayGuests} pessoas, mas o sistema informou que é necessário agendar com ${RESERVATION_MIN_LEAD_HOURS}h de antecedência. Poderia me ajudar?`;
    } else if (reason === 'capacity_overflow') {
      message = `Olá, gostaria de fazer uma reserva para o dia ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} para ${displayGuests} pessoas, mas o sistema informou que a capacidade online foi atingida. Teria alguma disponibilidade interna?`;
    } else {
      let paymentInfo = "";
      if (specialDateInfo?.requires_fee) {
        paymentInfo = `\n\n*Observação:* Minha reserva tem pagamento antecipado de R$ ${reservationPaymentAmount.toFixed(2)}. A confirmação do pagamento é automática pelo sistema.`;
      } else if (displayGuests && displayGuests >= 15) {
        paymentInfo = `\n\n*Observação:* Minha reserva é de grupo (15+ pessoas), com pagamento antecipado de R$ ${reservationPaymentAmount.toFixed(2)}. A confirmação do pagamento é automática pelo sistema.`;
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
    setFormData({ name: '', whatsapp: '', cpf: '', email: '' });
    setBookingStep('reservation');
    setSubmissionError('');
    setIsSuccess(false);
    setDuplicateReservation(null);
    setReservationId('');
    setReservationAccessToken('');
    setReservationPaymentAmount(0);
    setPixPayment(null);
    setPixError('');
    setPixCopied(false);
    setCopyError('');
    setStorageError('');
    setReservationState(null);
    setStatusError('');
    setSpecialDateInfo(null);
    setDecorationId('');
    setDecorations([]);
  };

  const createPixPayment = async (id: string, accessToken = reservationAccessToken, cpf = formData.cpf) => {
    setIsCreatingPix(true);
    setPixError('');

    try {
      const response = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: id, accessToken, cpf, email: formData.email }),
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
    if (submissionRef.current) return;
    submissionRef.current = true;
    setIsSubmitting(true);
    setSubmissionError('');
    const finalGuests = guests || 0;

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          whatsapp: formData.whatsapp,
          ...(paymentRule.required ? { cpf: formData.cpf, email: formData.email } : {}),
          date,
          time,
          guests: finalGuests,
          notes,
          specialDateId: specialDateInfo?.id || null,
          decorationId: decorationId || null,
        }),
      });
      const result = await response.json();

      if (response.status === 409 && result.code === 'ACTIVE_CPF_RESERVATION_EXISTS') {
        setDuplicateReservation(result.existingReservation as DuplicateReservation);
        return;
      }

      if (!response.ok) {
        if (result.code === 'CAPACITY_EXCEEDED') void fetchFullDates();
        if (result.code === 'DECORATION_UNAVAILABLE') setDecorationRequest((current) => current + 1);
        throw new Error(result.error || 'Não foi possível criar a reserva.');
      }

      const createdId = result.id || '';
      const accessToken = typeof result.accessToken === 'string' ? result.accessToken : '';
      if (!createdId || !accessToken) throw new Error('Não foi possível proteger o acesso à sua reserva.');

      setReservationId(createdId);
      setReservationAccessToken(accessToken);
      setReservationPaymentAmount(Number(result.paymentAmount || 0));
      setReservationState({ status: 'pending', paymentStatus: result.paymentRequired ? 'pending' : 'not_required' });
      try {
        saveReservationCredential({ id: createdId, token: accessToken, phone: formData.whatsapp.replace(/\D/g, '') });
      } catch {
        setStorageError('A reserva foi registrada, mas este navegador não permitiu salvar o acesso. Fale com a equipe se precisar consultá-la depois.');
      }

      setIsSuccess(true);
      if (result.paymentRequired) {
        await createPixPayment(createdId, accessToken);
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Não foi possível enviar a reserva. Tente novamente.');
    } finally {
      submissionRef.current = false;
      setIsSubmitting(false);
    }
  };

  const contactTeamAboutDuplicate = (choice: DuplicateReservationChoice) => {
    if (!duplicateReservation) return;
    const message = buildDuplicateReservationMessage({
      choice,
      name: formData.name,
      date,
      time,
      guests: guests || 0,
      existingTime: duplicateReservation.time,
      existingGuests: duplicateReservation.guests,
    });
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setDuplicateReservation(null);
  };

  const fetchUserReservations = async () => {
    if (searchRef.current) return;
    const phone = searchPhone.replace(/\D/g, '');
    setSearchError('');
    setUserReservations([]);
    setHasSearched(false);
    if (!/^\d{10,11}$/.test(phone)) {
      setSearchError('Informe um telefone válido com DDD.');
      return;
    }
    searchRef.current = true;
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const credentials = getStoredReservationCredentials().filter((credential) => credential.phone === phone);
      const results = await Promise.all(credentials.map(async (credential) => {
        const response = await fetch(`/api/reservations/${credential.id}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${credential.token}` },
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Consulta indisponível.');
        const result = await response.json();
        return result.reservation || null;
      }));
      setUserReservations(results.filter(Boolean));
    } catch {
      setSearchError('Não foi possível consultar agora. Tente novamente ou entre em contato pelo WhatsApp.');
      setUserReservations([]);
    } finally {
      searchRef.current = false;
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

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const formatCpf = formatReservationCpf;

  const changePageView = (nextView: 'home' | 'reservation') => {
    window.scrollTo(0, 0);
    setPageView(nextView);
  };

  if (isSuccess) {
    return (
      <div className="duna-site min-h-screen flex items-center justify-center p-4 font-sans text-[#f8ead0]">
        <div className="duna-success-card w-full max-w-[420px] rounded-[32px] shadow-2xl overflow-hidden p-8 sm:p-12 text-center">
          {!reservationCancelled && <div className="mb-6 rounded-xl bg-[#fdfbf7] p-3 text-left text-[#4a3728]">
            <ReservationProgress current={requiresPayment && !paymentPaid ? 'payment' : 'complete'} requiresPayment={requiresPayment} />
          </div>}
          <div className={`${reservationConfirmed ? 'bg-green-100 text-green-700' : reservationCancelled ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}>
            {reservationConfirmed ? <CheckCircle2 size={40} /> : reservationCancelled ? <XCircle size={40} /> : <Clock size={40} />}
          </div>
          <h1 ref={resultTitleRef} tabIndex={-1} className="text-3xl font-serif font-bold mb-2 outline-none">{reservationCancelled ? 'Reserva cancelada' : reservationConfirmed ? 'Reserva confirmada!' : requiresPayment ? 'Aguardando pagamento' : 'Reserva solicitada!'}</h1>
          <p className="text-sm opacity-70 mb-8">
            {reservationCancelled
              ? paymentPaid ? 'O pagamento foi registrado, mas a reserva continua cancelada. Fale com a equipe para orientação.' : 'Esta reserva foi cancelada. Fale com a equipe se precisar de ajuda.'
              : reservationConfirmed ? 'Confira os detalhes abaixo. Esperamos você no Duna!'
              : requiresPayment
              ? 'Sua mesa foi registrada. Conclua o pagamento PIX para confirmar a reserva.'
              : 'Recebemos seu pedido. Confirme os detalhes com nossa equipe pelo WhatsApp.'}
          </p>

          <div className="mb-6 text-left"><ReservationSummary selection={selection} />{decorationId && <p className="mt-3 text-sm">Decoração: {decorations.find((item) => item.id === decorationId)?.name}</p>}</div>
          {paymentPaid && <p role="status" className="mb-6 rounded-xl bg-green-100 p-4 text-sm font-semibold text-green-900">Pagamento recebido: R$ {reservationPaymentAmount.toFixed(2).replace('.', ',')}.</p>}
          {statusError && <p role="status" className="mb-4 text-sm">{statusError}</p>}
          {storageError && <p role="alert" className="mb-4 text-sm">{storageError}</p>}

          {requiresPayment && !paymentPaid && !reservationCancelled && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[24px] text-left animate-in fade-in zoom-in duration-500">
              <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={16} /> PIX da reserva
              </p>
              <p className="text-sm text-amber-800 leading-relaxed mb-4">
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
                    <Image
                      src={pixPayment.qrCodeUrl}
                      alt="QR Code PIX da reserva"
                      width={224}
                      height={224}
                      unoptimized
                      className="mx-auto aspect-square w-full max-w-56 rounded-2xl bg-white p-2"
                    />
                  )}
                   <Button
                      type="button"
                      onClick={async () => {
                       try {
                         await navigator.clipboard.writeText(pixPayment.qrCode);
                         setPixCopied(true);
                         setCopyError('');
                         window.setTimeout(() => setPixCopied(false), 2500);
                       } catch {
                         setCopyError('Não foi possível copiar automaticamente. Selecione e copie o código abaixo.');
                       }
                    }}
                     className="w-full rounded-xl uppercase tracking-widest"
                  >
                    {pixCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {pixCopied ? 'Código copiado' : 'Copiar PIX copia e cola'}
                   </Button>
                  {copyError && <div><p role="alert" className="text-sm text-red-800">{copyError}</p><textarea readOnly aria-label="Código PIX para copiar manualmente" value={pixPayment.qrCode} className="mt-2 w-full rounded-lg border border-amber-300 bg-white p-2 text-sm text-[#4a3728]" /></div>}
                  {pixPayment.expiresAt && <p className="text-center text-xs text-amber-900">Validade do PIX: {new Date(pixPayment.expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Porto_Velho', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (horário de Porto Velho).</p>}
                </div>
              )}

              {pixError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                  <p role="alert" className="mb-3 text-sm font-semibold text-red-800">{pixError}</p>
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

           <Button
             type="button"
             variant="whatsapp"
             onClick={() => handleWhatsAppRedirect('success', guests || 0)}
             className="mb-3 w-full rounded-2xl uppercase tracking-wider"
          >
            <MessageCircle size={18} />
            {requiresPayment ? 'Falar com a equipe' : 'Confirmar com a equipe'}
           </Button>
          <p className="text-center text-xs opacity-80 mb-6 px-4">
            {requiresPayment
              ? 'Não é necessário enviar comprovante: o pagamento é confirmado automaticamente.'
              : 'Clique acima para notificar nossa equipe sobre sua reserva.'}
          </p>
           <Button
              type="button"
              variant="ghost"
              disabled={isCreatingPix || isSubmitting}
              onClick={resetForm}
              className="w-full rounded-2xl uppercase tracking-wider !text-[#f3e5cd]"
          >
            Fazer outra reserva
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="duna-site min-h-screen flex flex-col items-center justify-start py-0 sm:py-8 font-sans text-[#f8ead0] overflow-x-hidden">
      <div className={`duna-shell w-full ${pageView === 'reservation' ? 'max-w-[640px] overflow-clip' : 'max-w-[460px] overflow-hidden'} sm:rounded-[34px] shadow-2xl flex flex-col shrink-0`}>
        
        {pageView === 'home' && (
          <>
        {/* Abertura */}
        <div className="duna-hero h-[500px] w-full relative isolate text-white">
          <Image
            src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=90&w=1200"
            alt="Prato servido no Duna Cozinha & Bar"
            fill
            priority
            unoptimized
            sizes="(max-width: 460px) 100vw, 460px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-[#100905]" />
          <div className="absolute inset-x-0 top-0 flex justify-center pt-9">
            <div className="duna-brand flex flex-col items-center drop-shadow-lg">
              <Image src="/Favicon-D.png" alt="Duna" width={64} height={64} className="mb-2 h-16 w-16 object-contain" />
              <h1 className="font-serif text-5xl tracking-[0.22em] pl-[0.22em] text-[#f8e3b2]">DUNA</h1>
              <p className="mt-1 text-[10px] font-semibold tracking-[0.42em] pl-[0.42em] text-[#f5dfaa]">COZINHA E BAR</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
             <Button
               type="button"
               variant="gold"
               size="lg"
               onClick={() => changePageView('reservation')}
               className="w-full rounded-2xl text-sm font-black uppercase tracking-wide"
             >
               <Calendar size={21} />
               Reservar minha mesa
             </Button>
          </div>
        </div>

        <div className="duna-links px-5 py-5 space-y-3">
           <ButtonLink
             variant="dark"
             size="lg"
             href="https://maps.app.goo.gl/2zmtd2zZ4wrSxxCT7"
            target="_blank"
            rel="noopener noreferrer"
             className="w-full rounded-2xl text-sm font-bold uppercase tracking-wide"
          >
            <Navigation size={21} />
            Como chegar
           </ButtonLink>
           <ButtonLink
             variant="dark"
             size="lg"
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
             className="w-full rounded-2xl text-sm font-bold uppercase tracking-wide"
          >
            <MessageCircle size={21} />
            Falar no WhatsApp
           </ButtonLink>
           <ButtonLink
             variant="dark"
             size="lg"
            href="https://www.instagram.com/dunacozinhabar/"
            target="_blank"
            rel="noopener noreferrer"
             className="w-full rounded-2xl text-sm font-bold uppercase tracking-wide"
          >
            <Instagram size={21} />
            Ver Instagram
           </ButtonLink>
          <div className="border-t border-[#704126] px-2 pt-4 text-[#f8e3b2]">
            <div className="flex items-start gap-3">
              <Clock size={20} className="mt-0.5 shrink-0 text-[#e9a930]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9a930]">Horário de funcionamento</p>
                <HorariosFuncionamento />
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
          <section className="duna-reservation-heading px-5 py-4 sm:px-7">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => changePageView('home')}
              className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#6f4825]"
              aria-label="Voltar para o início"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>
            <div className="duna-mini-brand mt-2 flex items-center gap-3">
              <Image src="/Favicon-D.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              <div><p className="font-serif text-3xl font-semibold tracking-[0.18em]">DUNA</p><p className="text-xs font-semibold tracking-[0.12em]">COZINHA E BAR</p></div>
            </div>
          </section>
        )}

        {/* Alternador de Modos (Abas) */}
        <div className="duna-tabs flex p-1 mx-4 mt-4 rounded-2xl">
          <button 
            disabled={isSubmitting}
            aria-pressed={viewMode === 'reserve'}
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
            disabled={isSubmitting}
            aria-pressed={viewMode === 'check'}
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
        <div className="duna-reservation-area flex-1">
          {viewMode === 'reserve' ? (
            <div className="duna-booking-surface p-5 sm:p-7">
              <PublicReservationForm
                step={bookingStep}
                onStepChange={setBookingStep}
                selection={selection}
                onSelectionChange={updateSelection}
                contact={formData}
                onContactChange={setFormData}
                availability={{ dates: datesList, availableTimes: availableTimesByDate, timeTurns: timeTurnsByDate, turnTotals, fullDates: fullyBookedDates, blockedDates: allBlockedDates, specialDates: allSpecialDates, loading: loadingAvailability, error: availabilityError }}
                onRetryAvailability={() => void fetchFullDates()}
                decorations={decorations}
                decorationsLoading={decorationsLoading}
                decorationsError={decorationsError}
                onRetryDecorations={() => setDecorationRequest((current) => current + 1)}
                isSubmitting={isSubmitting}
                submissionError={submissionError}
                onSubmit={handleSubmit}
                whatsappNumber={WHATSAPP_NUMBER}
              />
            </div>
          ) : (
            /* VISUALIZAÇÃO: MINHAS RESERVAS */
            <div className="duna-booking-surface p-5 sm:p-7 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                  <h2 className="text-lg font-serif font-bold mb-2 text-[#4A3728]">Minhas Reservas 🔎</h2>
                <p className="text-sm leading-relaxed text-[#76695e]">
                  Informe o telefone da reserva. A consulta usa o acesso salvo neste navegador.
                </p>
              </div>

               <div className="space-y-4 mb-8">
                <form noValidate onSubmit={(event) => { event.preventDefault(); void fetchUserReservations(); }}>
                  <FieldLabel htmlFor="reservation-search-phone">Telefone com DDD</FieldLabel>
                  <div className="flex gap-2">
                    <Input id="reservation-search-phone" type="tel" inputMode="tel" autoComplete="tel-national"
                      required disabled={isSearching} placeholder="(69) 99999-9999" value={searchPhone}
                      aria-describedby={searchError ? 'reservation-search-error' : undefined}
                      onChange={(event) => {
                        setSearchPhone(formatPhoneNumber(event.target.value));
                        setHasSearched(false);
                        setSearchError('');
                        setUserReservations([]);
                      }} className="min-w-0 flex-1 text-base" />
                    <Button type="submit" disabled={isSearching}>
                      {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Consultar
                    </Button>
                  </div>
                </form>
                {searchError && <Feedback id="reservation-search-error" tone="error" role="alert">{searchError}</Feedback>}
                <div className="space-y-3">
                  <p className="text-sm text-[#76695e]">Não conseguiu consultar sua reserva?</p>
                  <ButtonLink variant="whatsapp" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="w-full">
                    <MessageCircle size={18} /> Entrar em contato no WhatsApp
                  </ButtonLink>
                </div>
               </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {hasSearched && userReservations.length === 0 && !isSearching && !searchError && (
                  <div role="status" className="text-center py-8 px-6 bg-white/50 rounded-[24px] border border-dashed border-[#D9CFC1]">
                    <div className="w-12 h-12 bg-[#F5F2ED] rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle size={24} className="text-[#4A3728]/30" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma reserva encontrada</p>
                    <p className="mt-2 text-sm text-[#76695e]">Confira o telefone ou fale com a equipe pelo WhatsApp.</p>
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
                      <Image src={pixPayment.qrCodeUrl} alt="QR Code PIX" width={208} height={208} unoptimized className="mx-auto aspect-square w-full max-w-52 rounded-xl bg-white p-2" />
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

      {duplicateReservation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="duplicate-reservation-title">
          <button type="button" className="absolute inset-0 bg-[#4A3728]/60 backdrop-blur-sm" aria-label="Fechar opções de reserva" onClick={() => setDuplicateReservation(null)} />
          <div className="relative w-full max-w-[380px] rounded-[28px] bg-[#FDFBF7] p-6 text-center text-[#4A3728] shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertCircle size={28} /></div>
            <h2 id="duplicate-reservation-title" className="mb-2 font-serif text-xl font-bold">Já existe uma reserva para este período</h2>
            <p className="mb-5 text-sm leading-relaxed text-[#4A3728]/70">
              Encontramos uma reserva para {date ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : ''}, às {duplicateReservation.time}, para {duplicateReservation.guests} pessoas. Escolha o que deseja pedir à nossa equipe.
            </p>
            <div className="space-y-3">
              <Button type="button" variant="whatsapp" onClick={() => contactTeamAboutDuplicate('add_to_existing')} className="w-full rounded-xl">Acrescentar pessoas à reserva</Button>
              <Button type="button" variant="secondary" onClick={() => contactTeamAboutDuplicate('create_another')} className="w-full rounded-xl">Fazer outra reserva</Button>
              <button type="button" onClick={() => setDuplicateReservation(null)} className="w-full py-2 text-xs font-semibold text-[#4A3728]/55">Voltar ao formulário</button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[#4A3728]/55">O WhatsApp abrirá com uma mensagem pronta, sem CPF. A reserva não será alterada até a equipe confirmar.</p>
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
