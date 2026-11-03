import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarPicker from '@/app/components/CalendarPicker';
import { getPublicReservationDates } from '@/lib/public-reservation-form';

function dayButton(html: string, date: string) {
  const tag = html.match(new RegExp(`<button[^>]*data-date="${date}"[^>]*>`))?.[0];
  expect(tag, `Dia ${date} renderizado`).toBeDefined();
  return tag || '';
}

describe('calendário público em grade (estrutura renderizada)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('limita os dias selecionáveis à janela fornecida, sem a antiga extensão de três meses', () => {
    const dates = getPublicReservationDates();
    const html = renderToStaticMarkup(createElement(CalendarPicker, { selectedDate: '', onDateSelect: vi.fn(), availableDates: dates }));
    expect(dayButton(html, '2026-10-28')).toContain('disabled');
    expect(dayButton(html, '2026-10-29')).not.toContain('disabled');
    expect(dayButton(html, '2026-10-31')).not.toContain('disabled');
    expect(html).toMatch(/<button[^>]*aria-label="Mês anterior"[^>]*disabled/);
    expect(html).not.toMatch(/<button[^>]*aria-label="Próximo mês"[^>]*disabled/);
  });

  it('preserva bloqueios, falta de horários e o motivo acessível de cada dia', () => {
    const html = renderToStaticMarkup(createElement(CalendarPicker, {
      selectedDate: '', onDateSelect: vi.fn(), availableDates: getPublicReservationDates(),
      disabledDateReasons: { '2026-10-30': 'Reservas bloqueadas', '2026-10-31': 'Sem horários disponíveis' },
    }));
    expect(dayButton(html, '2026-10-30')).toContain('disabled');
    expect(dayButton(html, '2026-10-30')).toContain('Reservas bloqueadas');
    expect(dayButton(html, '2026-10-31')).toContain('Sem horários disponíveis');
  });

  it('reabre o mês da data selecionada e impede ultrapassar o último mês do horizonte', () => {
    const html = renderToStaticMarkup(createElement(CalendarPicker, {
      selectedDate: '2026-12-28', onDateSelect: vi.fn(), availableDates: getPublicReservationDates(),
    }));
    expect(html).toContain('dezembro de 2026');
    expect(dayButton(html, '2026-12-28')).toContain('aria-pressed="true"');
    expect(dayButton(html, '2026-12-29')).toContain('disabled');
    expect(html).toMatch(/<button[^>]*aria-label="Próximo mês"[^>]*disabled/);
    expect(html).not.toMatch(/<button[^>]*aria-label="Mês anterior"[^>]*disabled/);
  });

  it('desabilita todos os dias durante carregamento ou falha da disponibilidade', () => {
    const html = renderToStaticMarkup(createElement(CalendarPicker, {
      selectedDate: '', onDateSelect: vi.fn(), availableDates: getPublicReservationDates(), disabled: true,
    }));
    expect(dayButton(html, '2026-10-29')).toContain('disabled');
    expect(dayButton(html, '2026-10-31')).toContain('disabled');
  });

  it('distingue hoje e seleção, sem botões que submetam o formulário', () => {
    const html = renderToStaticMarkup(createElement(CalendarPicker, {
      selectedDate: '2026-10-30', onDateSelect: vi.fn(), availableDates: getPublicReservationDates(),
    }));
    expect(dayButton(html, '2026-10-29')).toContain('aria-current="date"');
    expect(dayButton(html, '2026-10-30')).toContain('aria-pressed="true"');
    expect(html).not.toContain('type="submit"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('renderiza corretamente fevereiro bissexto e a passagem de mês', () => {
    const html = renderToStaticMarkup(createElement(CalendarPicker, {
      selectedDate: '2028-02-29', onDateSelect: vi.fn(), availableDates: ['2028-02-28', '2028-02-29', '2028-03-01'],
    }));
    expect(dayButton(html, '2028-02-29')).toContain('aria-pressed="true"');
    expect(html).not.toContain('data-date="2028-02-30"');
  });
});
