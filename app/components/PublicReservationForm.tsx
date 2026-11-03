'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Calendar, Clock, Loader2, Pencil, Users } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button, ButtonLink } from '@/components/ui/button';
import { FieldLabel, Input, Textarea } from '@/components/ui/form-controls';
import { Feedback } from '@/components/ui/feedback';
import CalendarPicker from '@/app/components/CalendarPicker';
import ReservationProgress from '@/app/components/ReservationProgress';
import { getReservationPayment } from '@/lib/reservation-payment';
import {
  formatReservationCpf, hasReservationLeadTime, validatePublicReservationContact,
  PUBLIC_RESERVATION_HORIZON_DAYS, RESERVATION_MIN_LEAD_HOURS,
  type PublicReservationContact, type PublicReservationContactErrors,
} from '@/lib/public-reservation-form';

export type PublicSpecialDate = {
  id: string;
  date: string;
  description: string | null;
  included_guests: number | null;
  requires_fee: boolean | null;
  fee_amount: number | null;
};
export type PublicDecoration = { id: string; name: string; image_url: string; available: boolean };
export type ReservationSelection = {
  date: string;
  guests: number | null;
  time: string;
  notes: string;
  decorationId: string;
  specialDate: PublicSpecialDate | null;
};
export type ReservationAvailability = {
  dates: string[];
  availableTimes: Record<string, string[]>;
  timeTurns: Record<string, Record<string, string>>;
  turnTotals: Record<string, number>;
  fullDates: string[];
  blockedDates: { date: string }[];
  specialDates: PublicSpecialDate[];
  loading: boolean;
  error: string;
};
type Props = {
  step: 'reservation' | 'details';
  onStepChange: (step: Props['step']) => void;
  selection: ReservationSelection;
  onSelectionChange: (selection: Partial<ReservationSelection>) => void;
  contact: PublicReservationContact;
  onContactChange: (contact: PublicReservationContact) => void;
  availability: ReservationAvailability;
  onRetryAvailability: () => void;
  decorations: PublicDecoration[];
  decorationsLoading: boolean;
  decorationsError: string;
  onRetryDecorations: () => void;
  isSubmitting: boolean;
  submissionError: string;
  onSubmit: () => Promise<void>;
  whatsappNumber: string;
};

const currency = (amount: number) => amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const displayDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), "EEEE, dd 'de' MMMM", { locale: ptBR });

export function ReservationSummary({ selection, onEdit }: { selection: ReservationSelection; onEdit?: () => void }) {
  const decorationNote = selection.notes.trim();
  return (
    <section aria-label="Resumo da reserva" className="rounded-2xl border border-[#d9cfc1] bg-[#f5f2ed] p-4 text-[#4a3728]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Sua reserva</h3>
        {onEdit && <Button type="button" variant="ghost" size="sm" onClick={onEdit}><Pencil size={14} /> Editar reserva</Button>}
      </div>
      <dl className="grid gap-2 text-sm">
        <div className="flex items-start gap-2"><Calendar size={17} className="mt-0.5 shrink-0" /><dt className="sr-only">Data</dt><dd className="capitalize">{selection.date ? displayDate(selection.date) : 'Selecione uma data'}</dd></div>
        <div className="flex items-center gap-2"><Clock size={17} /><dt className="sr-only">Horário</dt><dd>{selection.time || 'Selecione um horário'}</dd></div>
        <div className="flex items-center gap-2"><Users size={17} /><dt className="sr-only">Pessoas</dt><dd>{selection.guests} {selection.guests === 1 ? 'pessoa' : 'pessoas'}</dd></div>
        {selection.specialDate && <div><dt className="font-semibold">Evento</dt><dd>{selection.specialDate.description || 'Data especial'}</dd></div>}
        {decorationNote && <div><dt className="font-semibold">Observações</dt><dd className="break-words whitespace-pre-wrap">{decorationNote}</dd></div>}
      </dl>
    </section>
  );
}

export default function PublicReservationForm(props: Props) {
  const { step, onStepChange, selection, onSelectionChange, contact, onContactChange, availability } = props;
  const { date, guests, time, specialDate } = selection;
  const payment = getReservationPayment(guests || 0, specialDate);
  const paymentValid = !payment.required || (Number.isFinite(payment.amount) && payment.amount > 0);
  const [errors, setErrors] = useState<PublicReservationContactErrors>({});
  const [termsError, setTermsError] = useState('');
  const [acceptedTermsFor, setAcceptedTermsFor] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextSectionRef = useRef<HTMLDivElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const submittingRef = useRef(false);
  const termsKey = `${date}|${guests}|${time}|${specialDate?.id || ''}|${payment.amount}|${payment.required}`;
  const termsAccepted = acceptedTermsFor === termsKey;
  const specialOptions = availability.specialDates.filter((item) => item.date === date);
  const remainingPlaces = (slot: string) => {
    const turn = availability.timeTurns[date]?.[slot];
    return turn ? Math.max(0, 80 - (availability.turnTotals[`${date}|${turn}`] || 0)) : 0;
  };
  const times = (availability.availableTimes[date] || []).filter((slot) => (
    remainingPlaces(slot) >= (guests || 1)
  ));
  const remainingForTime = remainingPlaces(time);
  const guestCountValid = guests !== null && Number.isInteger(guests) && guests >= 1 && guests <= 30;
  const guestsFit = guestCountValid && guests <= remainingForTime;
  const dateUnavailable = availability.fullDates.includes(date) || availability.blockedDates.some((item) => item.date === date);
  const showGuests = Boolean(date && !dateUnavailable && (!specialOptions.length || specialDate) && !availability.loading && !availability.error);
  const showTimes = showGuests && guestCountValid;
  const canContinue = Boolean(availability.dates.includes(date) && guestsFit && time && times.includes(time) && !dateUnavailable
    && (!specialOptions.length || specialDate) && hasReservationLeadTime(date, time)
    && paymentValid
    && !availability.loading && !availability.error);
  const disabledDateReasons: Record<string, string> = {};
  for (const day of availability.dates) {
    if (availability.blockedDates.some((item) => item.date === day)) disabledDateReasons[day] = 'Reservas bloqueadas';
    else if (availability.fullDates.includes(day)) disabledDateReasons[day] = 'Indisponível para reserva online';
    else if (!availability.availableTimes[day]?.length) disabledDateReasons[day] = 'Sem horários disponíveis';
  }
  const hasAvailableDate = availability.dates.some((day) => !disabledDateReasons[day]);
  const helpUrl = `https://wa.me/${props.whatsappNumber}`;
  const choiceClass = 'min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a684d] disabled:cursor-not-allowed disabled:opacity-50';
  const selectedClass = 'border-[#4a3728] bg-[#4a3728] text-white';
  const idleClass = 'border-[#d9cfc1] bg-white text-[#4a3728] hover:bg-[#f5f2ed]';

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.closest('form')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);

  useEffect(() => {
    if (!scrollRequest) return;
    const frame = window.requestAnimationFrame(() => {
      nextSectionRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollRequest]);

  const changeContact = (field: keyof PublicReservationContact, value: string) => {
    onContactChange({ ...contact, [field]: value });
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <form noValidate aria-label="Fazer reserva" className="duna-booking-form text-[#4a3728]" onSubmit={async (event) => {
      event.preventDefault();
      if (props.isSubmitting || submittingRef.current) return;
      if (step === 'reservation') {
        if (canContinue) onStepChange('details');
        return;
      }
      if (!canContinue) {
        onStepChange('reservation');
        return;
      }
      const nextErrors = validatePublicReservationContact(contact, payment.required);
      setErrors(nextErrors);
      setTermsError(termsAccepted ? '' : 'Confirme que leu as condições da reserva.');
      const firstInvalid = (['name', 'whatsapp', 'cpf'] as const).find((field) => nextErrors[field]);
      if (firstInvalid) {
        const field = document.getElementById(`booking-${firstInvalid}`);
        field?.focus();
        field?.scrollIntoView({ block: 'center', behavior: 'instant' });
        return;
      }
      if (!termsAccepted) {
        const checkbox = document.getElementById('booking-terms');
        checkbox?.focus();
        checkbox?.scrollIntoView({ block: 'center', behavior: 'instant' });
        return;
      }
      submittingRef.current = true;
      try { await props.onSubmit(); } finally { submittingRef.current = false; }
    }}>
      <ReservationProgress current={step} requiresPayment={payment.required} />

      <h2 ref={titleRef} tabIndex={-1} className="mb-1 scroll-mt-5 font-serif text-3xl font-semibold outline-none">
        {step === 'reservation' ? 'Quando vamos receber você?' : 'Quem vem ao Duna?'}
      </h2>
      <p className="mb-5 text-sm leading-6 text-[#76695e]">{step === 'reservation' ? 'Escolha o dia, as pessoas e um horário disponível.' : 'Confira sua reserva e informe seus dados de contato.'}</p>

      {step === 'reservation' ? (
        <div className="space-y-5">
          {availability.loading && <Feedback><span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Carregando disponibilidade...</span></Feedback>}
          {availability.error && <Feedback tone="error" role="alert"><p>{availability.error}</p><Button type="button" variant="secondary" className="mt-3" onClick={props.onRetryAvailability}>Tentar novamente</Button></Feedback>}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <h3 className="flex items-center gap-2 font-bold"><Calendar size={17} /> Dia da reserva</h3>
              {date && <span>{format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</span>}
            </div>
            <CalendarPicker selectedDate={date} availableDates={availability.dates} disabledDateReasons={disabledDateReasons}
              disabled={availability.loading || Boolean(availability.error) || props.isSubmitting}
              onDateSelect={(nextDate) => {
                setScrollRequest((request) => request + 1);
                if (nextDate === date) return;
                const options = availability.specialDates.filter((item) => item.date === nextDate);
                const nextSpecial = options.length === 1 ? options[0] : null;
                onSelectionChange({ date: nextDate, guests: nextSpecial?.included_guests || null, time: '', specialDate: nextSpecial, decorationId: '' });
              }} />
            <p className="mt-3 text-xs leading-5 text-[#76695e]">Hoje e os próximos {PUBLIC_RESERVATION_HORIZON_DAYS} dias · Antecedência mínima de {RESERVATION_MIN_LEAD_HOURS} horas. Dias sem disponibilidade ficam desabilitados.</p>
          </div>
          {!availability.loading && !availability.error && !hasAvailableDate && <Feedback tone="warning">
            <p>Não há datas disponíveis para reserva online neste período.</p>
            <ButtonLink variant="secondary" href={helpUrl} target="_blank" rel="noopener noreferrer" className="mt-3">Consultar a equipe</ButtonLink>
          </Feedback>}

          <div ref={nextSectionRef} className="scroll-mt-4 space-y-5">
          {specialOptions.length > 0 && <fieldset disabled={props.isSubmitting} className="space-y-2">
            <legend className="mb-2 text-sm font-bold">Evento desta data</legend>
            {specialOptions.map((option) => <button type="button" key={option.id} aria-pressed={specialDate?.id === option.id} className={`${choiceClass} w-full text-left ${specialDate?.id === option.id ? selectedClass : idleClass}`} onClick={() => {
              if (specialDate?.id !== option.id) onSelectionChange({ specialDate: option, guests: option.included_guests || null, time: '', decorationId: '' });
            }}>
              <span className="block">{option.description || 'Data especial'}{option.included_guests ? ` · ${option.included_guests} pessoas` : ''}</span>
              {option.requires_fee && <span className="mt-1 block text-sm">Pagamento antecipado de {currency(Number(option.fee_amount || 0))}</span>}
            </button>)}
          </fieldset>}

          {showGuests && <fieldset disabled={props.isSubmitting}>
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold"><Users size={17} /> Pessoas{guests ? ` · ${guests}` : ''}</legend>
            {specialDate?.included_guests ? <p className="rounded-xl bg-[#f5f2ed] p-3 text-sm">Este evento inclui <strong>{specialDate.included_guests} pessoas</strong>.</p> : <>
              <FieldLabel htmlFor="booking-guests">Quantidade de pessoas</FieldLabel>
              <Input id="booking-guests" name="guests" type="number" inputMode="numeric" min={1} max={30} step={1}
                required value={guests ?? ''} placeholder="Ex.: 4" className="max-w-48"
                aria-invalid={guests !== null && !guestCountValid}
                aria-describedby={`booking-guests-help${guests !== null && !guestCountValid ? ' booking-guests-error' : ''}`}
                onChange={(event) => {
                  const next = Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : null;
                  if (next !== guests) onSelectionChange({ guests: next, time: '', decorationId: '' });
                }} />
              <p id="booking-guests-help" className="mt-2 text-xs leading-5 text-[#76695e]">Digite de 1 a 30 pessoas.</p>
              {guests !== null && !guestCountValid && <p id="booking-guests-error" role="status" className="mt-2 text-sm text-red-800">Informe uma quantidade inteira entre 1 e 30.</p>}
            </>}
          </fieldset>}
          {showGuests && <a href={`${helpUrl}?text=${encodeURIComponent('Olá! Gostaria de solicitar uma reserva para mais de 30 pessoas. Podem me ajudar?')}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Mais de 30 pessoas? Fale com o Duna</a>}

          {showTimes && <fieldset disabled={props.isSubmitting}>
            <legend className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock size={17} /> Horários disponíveis</legend>
            {times.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Horários disponíveis">
              {times.map((slot) => <button type="button" key={slot} aria-pressed={time === slot}
                className={`${choiceClass} ${time === slot ? selectedClass : idleClass}`}
                onClick={() => { if (slot !== time) onSelectionChange({ time: slot, decorationId: '' }); }}>{slot}</button>)}
            </div> : <Feedback tone="warning">Não há horários disponíveis para {guests} pessoas nesta data. Escolha outra data ou quantidade.</Feedback>}
          </fieldset>}

          {payment.required && paymentValid && <Feedback tone="warning"><p>Esta reserva requer pagamento antecipado de <strong>{currency(payment.amount)}</strong>, revertido em consumação.</p><p className="mt-1">Você informará o CPF na próxima etapa para gerar o PIX.</p></Feedback>}
          {!paymentValid && <Feedback tone="error">Não foi possível obter o valor desta reserva. Fale com a equipe antes de continuar.</Feedback>}

          {date && time && !hasReservationLeadTime(date, time) && <Feedback tone="warning"><p>Este horário tem menos de {RESERVATION_MIN_LEAD_HOURS} horas de antecedência. Consulte nossa equipe pelo WhatsApp.</p><ButtonLink variant="secondary" href={`${helpUrl}?text=${encodeURIComponent(`Olá! Gostaria de reservar para ${displayDate(date)}, às ${time}, para ${guests} pessoas, com menos de ${RESERVATION_MIN_LEAD_HOURS} horas de antecedência.`)}`} target="_blank" rel="noopener noreferrer" className="mt-3">Consultar a equipe</ButtonLink></Feedback>}
          <p role="status" aria-live="polite" className="sr-only">{!date ? 'Selecione um dia no calendário.'
            : specialOptions.length > 0 && !specialDate ? 'Escolha o evento desta data.'
            : !guestCountValid ? 'Informe uma quantidade inteira entre 1 e 30 pessoas.'
            : !time ? 'Escolha um horário disponível.'
            : canContinue ? 'Seleção completa. Você pode continuar para seus dados.' : 'Confira sua seleção antes de continuar.'}</p>
          <p className="text-xs leading-5 text-[#76695e]">Tolerância de 20 minutos · Serviço à la carte, sem rodízio.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <ReservationSummary selection={selection} onEdit={props.isSubmitting ? undefined : () => onStepChange('reservation')} />
          {!canContinue && <Feedback tone="warning">Confira a disponibilidade novamente antes de concluir.</Feedback>}
          <fieldset disabled={props.isSubmitting} className="space-y-4">
            <legend className="sr-only">Dados de contato</legend>
            <div>
              <FieldLabel htmlFor="booking-name">Nome</FieldLabel>
              <Input id="booking-name" name="name" autoComplete="name" maxLength={120} required value={contact.name} onChange={(event) => changeContact('name', event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'booking-name-error' : undefined} />
              {errors.name && <p id="booking-name-error" className="mt-1 text-sm text-red-800">{errors.name}</p>}
            </div>
            <div>
              <FieldLabel htmlFor="booking-whatsapp">Telefone com DDD (WhatsApp)</FieldLabel>
              <Input id="booking-whatsapp" name="tel" type="tel" inputMode="tel" autoComplete="tel-national" required value={contact.whatsapp} maxLength={16} placeholder="(69) 99999-9999" onChange={(event) => changeContact('whatsapp', event.target.value)} aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? 'booking-whatsapp-error' : undefined} />
              {errors.whatsapp && <p id="booking-whatsapp-error" className="mt-1 text-sm text-red-800">{errors.whatsapp}</p>}
            </div>
            {payment.required && <div>
              <FieldLabel htmlFor="booking-cpf">CPF para pagamento</FieldLabel>
              <Input id="booking-cpf" name="cpf" inputMode="numeric" autoComplete="off" required value={contact.cpf} maxLength={14} onChange={(event) => changeContact('cpf', formatReservationCpf(event.target.value))} aria-invalid={Boolean(errors.cpf)} aria-describedby={`booking-cpf-help${errors.cpf ? ' booking-cpf-error' : ''}`} />
              <p id="booking-cpf-help" className="mt-2 text-xs leading-5 text-[#76695e]">Solicitado porque esta reserva tem pagamento antecipado de {currency(payment.amount)}.</p>
              {errors.cpf && <p id="booking-cpf-error" className="mt-1 text-sm text-red-800">{errors.cpf}</p>}
            </div>}
          </fieldset>

          <details className="rounded-xl border border-[#d9cfc1] p-4">
            <summary className="cursor-pointer py-1 text-sm font-semibold">Personalizar reserva — opcional</summary>
            <fieldset disabled={props.isSubmitting} className="mt-4 space-y-4">
              <legend className="sr-only">Decoração e observações opcionais</legend>
              {props.decorationsLoading && <Feedback>Carregando decorações...</Feedback>}
              {props.decorationsError && <Feedback tone="warning"><p>{props.decorationsError}</p><Button type="button" variant="secondary" className="mt-2" onClick={props.onRetryDecorations}>Tentar novamente</Button></Feedback>}
              {props.decorations.length > 0 && !props.decorationsLoading && !props.decorationsError && <div>
                <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Espaço ou decoração</p>{selection.decorationId && <Button type="button" variant="ghost" size="sm" onClick={() => onSelectionChange({ decorationId: '' })}>Limpar seleção</Button>}</div>
                <div className="grid grid-cols-2 gap-3" role="group" aria-label="Decoração opcional">
                  {props.decorations.map((decoration) => <button key={decoration.id} type="button" disabled={!decoration.available} aria-pressed={selection.decorationId === decoration.id} className={`${choiceClass} overflow-hidden p-0 text-left ${selection.decorationId === decoration.id ? selectedClass : idleClass}`} onClick={() => onSelectionChange({ decorationId: decoration.id })}>
                    <Image src={decoration.image_url} alt="" width={240} height={100} unoptimized className="h-24 w-full object-cover" /><span className="block p-3">{decoration.name}{!decoration.available && <span className="mt-1 block text-xs">Indisponível neste período</span>}</span>
                  </button>)}
                </div>
              </div>}
              <div><FieldLabel htmlFor="booking-notes">Ocasião ou observações</FieldLabel><Textarea id="booking-notes" maxLength={1000} value={selection.notes} placeholder="Aniversário, alergia, cadeirinha de bebê..." onChange={(event) => onSelectionChange({ notes: event.target.value })} /><p className="mt-1 text-xs leading-5 text-[#76695e]">Pedidos especiais serão avaliados pela equipe.</p></div>
            </fieldset>
          </details>
          {selection.decorationId && <p className="text-sm">Decoração selecionada: <strong>{props.decorations.find((item) => item.id === selection.decorationId)?.name}</strong></p>}

          {payment.required && <Feedback tone="warning"><p>Pagamento antecipado: <strong>{currency(payment.amount)}</strong>, revertido em consumação.</p><p className="mt-1">O valor não é reembolsável em caso de atraso ou cancelamento.</p></Feedback>}
          <div>
            <label htmlFor="booking-terms" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6"><input id="booking-terms" type="checkbox" checked={termsAccepted} disabled={props.isSubmitting} onChange={(event) => { setAcceptedTermsFor(event.target.checked ? termsKey : ''); setTermsError(''); }} aria-invalid={Boolean(termsError)} aria-describedby={termsError ? 'booking-terms-error' : undefined} className="mt-1 h-5 w-5 shrink-0 accent-[#4a3728]" /><span>Estou ciente da tolerância de <strong>20 minutos</strong>{payment.required && ' e de que o pagamento não é reembolsável em caso de atraso ou cancelamento'}.</span></label>
            {termsError && <p id="booking-terms-error" className="mt-2 text-sm text-red-800">{termsError}</p>}
          </div>
          <p className="text-xs leading-5 text-[#76695e]">O acesso à reserva ficará salvo neste navegador. Se precisar acessá-la em outro dispositivo, fale com a equipe.</p>
          {props.submissionError && <Feedback tone="error" role="alert">{props.submissionError}</Feedback>}
        </div>
      )}

      <div className="duna-booking-actions mt-6 flex items-center gap-3 border-t border-[#d9cfc1] pt-4">
        {step === 'details' && <Button type="button" variant="ghost" disabled={props.isSubmitting} onClick={() => onStepChange('reservation')}><ArrowLeft size={17} /> Voltar</Button>}
        <Button type="submit" size="lg" disabled={props.isSubmitting || !canContinue} className="ml-auto min-w-40 flex-1 sm:flex-none">
          {props.isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : step === 'reservation' ? <>Continuar <ArrowRight size={17} /></> : payment.required ? 'Solicitar e gerar PIX' : 'Solicitar reserva'}
        </Button>
      </div>
    </form>
  );
}
