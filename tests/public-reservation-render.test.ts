import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicReservationForm from '@/app/components/PublicReservationForm';

function props(): ComponentProps<typeof PublicReservationForm> {
  return {
    step: 'reservation', onStepChange: vi.fn(),
    selection: { date: '2026-10-30', time: '19:00', guests: 2, specialDate: null, notes: '', decorationId: '' },
    onSelectionChange: vi.fn(), contact: { name: '', whatsapp: '', cpf: '', email: '' }, onContactChange: vi.fn(),
    availability: {
      dates: ['2026-10-30'], availableTimes: { '2026-10-30': ['19:00'] },
      timeTurns: { '2026-10-30': { '19:00': 'dinner' } }, turnTotals: { '2026-10-30|dinner': 0 },
      specialDates: [], fullDates: [], blockedDates: [], loading: false, error: '',
    },
    onRetryAvailability: vi.fn(), decorations: [], decorationsLoading: false, decorationsError: '',
    onRetryDecorations: vi.fn(), isSubmitting: false, submissionError: '', onSubmit: vi.fn(), whatsappNumber: '00000000000',
  };
}

describe('estrutura renderizada das etapas (sem navegador)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('mostra as escolhas, progresso e Continuar, sem coletar contato na primeira etapa', () => {
    const html = renderToStaticMarkup(createElement(PublicReservationForm, props()));
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('id="booking-date"');
    expect(html).toContain('Horários disponíveis');
    expect(html).toContain('Continuar');
    expect(html).not.toContain('id="booking-name"');
    expect(html).not.toContain('id="booking-cpf"');
    expect(html).not.toContain('id="booking-email"');
    expect(html).toContain('Hoje e os próximos 60 dias');
    expect(html).toContain('Antecedência mínima de 2 horas');
  });

  it.each([['10:00', false], ['09:59', true]] as const)('valida duas horas também ao habilitar Continuar: %s', (time, disabled) => {
    const data = props();
    data.selection.date = '2026-10-29'; // Relógio fixo: 8h em Porto Velho.
    data.selection.time = time;
    data.availability.dates = [data.selection.date];
    data.availability.availableTimes = { [data.selection.date]: [time] };
    data.availability.timeTurns = { [data.selection.date]: { [time]: 'lunch' } };
    data.availability.turnTotals = { [`${data.selection.date}|lunch`]: 0 };
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
    expect(submit).toBeDefined();
    expect(submit?.includes('disabled')).toBe(disabled);
    expect(html.includes('Este horário tem menos de 2 horas')).toBe(disabled);
    if (disabled) expect(html).toContain(encodeURIComponent('com menos de 2 horas de antecedência.'));
  });

  it('mostra resumo editável, nome e telefone sem CPF ou e-mail para 14 pessoas', () => {
    const data = props();
    data.step = 'details';
    data.selection.guests = 14;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Editar reserva');
    expect(html).toContain('id="booking-name"');
    expect(html).toContain('id="booking-whatsapp"');
    expect(html).toContain('Personalizar reserva');
    expect(html).toContain('Solicitar reserva');
    expect(html).not.toContain('id="booking-cpf"');
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('id="booking-date"');
  });

  it.each([15, 30])('expõe e-mail, CPF e PIX para %i pessoas', (guests) => {
    const data = props();
    data.step = 'details';
    data.selection.guests = guests;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('id="booking-cpf"');
    expect(html).toContain('for="booking-email"');
    expect(html).toMatch(/<input[^>]*id="booking-email"[^>]*type="email"[^>]*autoComplete="email"[^>]*required=""[^>]*maxLength="64"/);
    expect(html).toContain('Exigido pelo provedor de pagamento para gerar o PIX.');
    expect(html).toContain('Solicitar e gerar PIX');
  });

  it('expõe e-mail e CPF para evento pago com duas pessoas', () => {
    const data = props();
    data.step = 'details';
    data.selection.specialDate = { id: 'event', date: data.selection.date, description: 'Evento sintético', included_guests: 2, requires_fee: true, fee_amount: 75 };
    data.availability.specialDates = [data.selection.specialDate];
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('id="booking-cpf"');
    expect(html).toContain('id="booking-email"');
  });

  it('não coleta e-mail para evento gratuito abaixo de 15 pessoas', () => {
    const data = props();
    data.step = 'details';
    data.selection.specialDate = { id: 'event', date: data.selection.date, description: 'Evento gratuito', included_guests: 2, requires_fee: false, fee_amount: null };
    data.availability.specialDates = [data.selection.specialDate];
    expect(renderToStaticMarkup(createElement(PublicReservationForm, data))).not.toContain('id="booking-email"');
  });

  it('diferencia erro de consulta de ausência de horários', () => {
    const data = props();
    data.availability.availableTimes = {};
    data.availability.error = 'Não foi possível consultar os horários. Tente novamente.';
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('Não há horários disponíveis para');
  });

  it('explica quando os horários não comportam o grupo', () => {
    const data = props();
    data.selection.guests = 15;
    data.availability.turnTotals['2026-10-30|dinner'] = 70;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Não há horários disponíveis para 15 pessoas');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('começa somente com calendário, sem antecipar horário, pessoas ou contato', () => {
    const data = props();
    data.selection = { ...data.selection, date: '', time: '', guests: null };
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Calendário de reservas');
    expect(html).not.toContain('Horários disponíveis');
    expect(html).not.toContain('id="booking-guests"');
    expect(html).not.toContain('id="booking-name"');
  });

  it('mostra pessoas após a data e só mostra horários após a quantidade', () => {
    const data = props();
    data.selection.time = '';
    data.selection.guests = null;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).not.toContain('aria-label="Horários disponíveis"');
    expect(html).toContain('id="booking-guests"');
    data.selection.guests = 2;
    expect(renderToStaticMarkup(createElement(PublicReservationForm, data))).toContain('aria-label="Horários disponíveis"');
  });

  it('não escolhe uma pessoa automaticamente ao selecionar somente data e horário', () => {
    const data = props();
    data.selection.guests = null;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toMatch(/<input[^>]*id="booking-guests"[^>]*value=""/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('aguarda a escolha do evento quando a data tem mais de um pacote', () => {
    const data = props();
    data.selection.guests = null;
    data.selection.time = '';
    data.availability.specialDates = ['first', 'second'].map((id) => ({
      id, date: data.selection.date, description: id, included_guests: 2, requires_fee: false, fee_amount: null,
    }));
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Evento desta data');
    expect(html).not.toContain('Horários disponíveis');
    expect(html).not.toContain('id="booking-guests"');
  });

  it('explica ausência de datas sem confundir com falha de rede', () => {
    const data = props();
    data.selection = { ...data.selection, date: '', time: '', guests: null };
    data.availability.availableTimes = {};
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Não há datas disponíveis para reserva online neste período.');
    expect(html).not.toContain('Tentar novamente');
  });

  it('mantém o bloqueio de repetição durante o envio', () => {
    const data = props();
    data.step = 'details';
    data.isSubmitting = true;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Enviando...');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('inclui Pagamento no progresso somente para reservas com cobrança', () => {
    const data = props();
    expect(renderToStaticMarkup(createElement(PublicReservationForm, data))).not.toContain('3.</span>Pagamento');
    data.selection.guests = 15;
    expect(renderToStaticMarkup(createElement(PublicReservationForm, data))).toContain('3.</span>Pagamento');
  });

  it('filtra somente o turno que não comporta a quantidade, mantendo os outros', () => {
    const data = props();
    data.selection.guests = 15;
    data.availability.availableTimes['2026-10-30'] = ['12:00', '19:00'];
    data.availability.timeTurns['2026-10-30']['12:00'] = 'lunch';
    data.availability.turnTotals['2026-10-30|lunch'] = 78;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).not.toContain('>12:00</button>');
    expect(html).toContain('>19:00</button>');
  });

  it('permite digitar a quantidade com indicação de teclado numérico e limites existentes', () => {
    const html = renderToStaticMarkup(createElement(PublicReservationForm, props()));
    expect(html).toMatch(/<input[^>]*id="booking-guests"[^>]*type="number"[^>]*inputMode="numeric"[^>]*min="1"[^>]*max="30"[^>]*step="1"/);
    expect(html).not.toContain('booking-more-guests');
  });

  it.each([0, -1, 31, 1.5])('rejeita a quantidade inválida %s sem oferecer horários', (guests) => {
    const data = props();
    data.selection.guests = guests;
    const html = renderToStaticMarkup(createElement(PublicReservationForm, data));
    expect(html).toContain('Informe uma quantidade inteira entre 1 e 30.');
    expect(html).not.toContain('aria-label="Horários disponíveis"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });
});
