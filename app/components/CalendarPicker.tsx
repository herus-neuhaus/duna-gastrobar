'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parse, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicReservationDates } from '@/lib/public-reservation-form';

interface CalendarPickerProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  availableDates: string[];
  disabledDateReasons?: Record<string, string>;
  disabled?: boolean;
}

export default function CalendarPicker({
  selectedDate, onDateSelect, availableDates, disabledDateReasons = {}, disabled = false,
}: CalendarPickerProps) {
  const monthId = useId();
  const helpId = useId();
  const today = getPublicReservationDates()[0];
  const months = [...new Set(availableDates.map((date) => date.slice(0, 7)))].sort();
  const firstMonth = months[0] || today.slice(0, 7);
  const [currentMonth, setCurrentMonth] = useState(() => (
    availableDates.includes(selectedDate) ? selectedDate.slice(0, 7) : firstMonth
  ));
  const [focusedDate, setFocusedDate] = useState(selectedDate);
  const requestedFocus = useRef<string | null>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const displayedMonth = months.includes(currentMonth) ? currentMonth : firstMonth;
  const monthIndex = months.indexOf(displayedMonth);
  const month = parse(`${displayedMonth}-01`, 'yyyy-MM-dd', new Date());
  const enabledDates = availableDates.filter((date) => !disabledDateReasons[date]).sort();
  const visibleEnabledDates = enabledDates.filter((date) => date.startsWith(displayedMonth));
  const tabStop = visibleEnabledDates.includes(focusedDate) ? focusedDate
    : visibleEnabledDates.includes(selectedDate) ? selectedDate : visibleEnabledDates[0];
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  useEffect(() => {
    if (requestedFocus.current) {
      dayButtons.current.get(requestedFocus.current)?.focus();
      requestedFocus.current = null;
    }
  }, [focusedDate, displayedMonth]);

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const day = parse(date, 'yyyy-MM-dd', new Date());
    let next: Date;
    let forward: boolean;
    switch (event.key) {
      case 'ArrowLeft': next = addDays(day, -1); forward = false; break;
      case 'ArrowRight': next = addDays(day, 1); forward = true; break;
      case 'ArrowUp': next = addDays(day, -7); forward = false; break;
      case 'ArrowDown': next = addDays(day, 7); forward = true; break;
      case 'Home': next = startOfWeek(day, { weekStartsOn: 0 }); forward = true; break;
      case 'End': next = endOfWeek(day, { weekStartsOn: 0 }); forward = false; break;
      case 'PageUp': next = addMonths(day, -1); forward = false; break;
      case 'PageDown': next = addMonths(day, 1); forward = true; break;
      default: return;
    }
    event.preventDefault();
    const nextValue = format(next, 'yyyy-MM-dd');
    const target = forward ? enabledDates.find((value) => value >= nextValue)
      : [...enabledDates].reverse().find((value) => value <= nextValue);
    if (!target) return;
    requestedFocus.current = target;
    setCurrentMonth(target.slice(0, 7));
    setFocusedDate(target);
  };

  return (
    <section id="booking-date" aria-label="Calendário de reservas" aria-describedby={helpId} aria-busy={disabled}
      className="rounded-2xl border border-[#d9cfc1] bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Mês anterior"
          disabled={disabled || monthIndex <= 0} onClick={() => setCurrentMonth(months[monthIndex - 1])}>
          <ChevronLeft size={20} />
        </Button>
        <h3 id={monthId} aria-live="polite" className="text-center text-sm font-semibold capitalize sm:text-base">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <Button type="button" variant="ghost" size="icon" aria-label="Próximo mês"
          disabled={disabled || monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => setCurrentMonth(months[monthIndex + 1])}>
          <ChevronRight size={20} />
        </Button>
      </div>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-[#76695e]" aria-hidden="true">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day} className="py-2">{day}</span>)}
      </div>
      <div role="group" aria-labelledby={monthId} className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const value = format(day, 'yyyy-MM-dd');
          if (!value.startsWith(displayedMonth)) return <span key={value} aria-hidden="true" />;
          const reason = !availableDates.includes(value) ? 'Fora do período de reservas online' : disabledDateReasons[value];
          const isDisabled = disabled || Boolean(reason);
          const selected = value === selectedDate;
          const label = format(day, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
          return (
            <button key={value} type="button" data-date={value} disabled={isDisabled}
              ref={(button) => { if (button) dayButtons.current.set(value, button); else dayButtons.current.delete(value); }}
              aria-label={`${label}${reason ? ` — ${reason}` : ''}`} aria-pressed={selected}
              aria-current={value === today ? 'date' : undefined} title={reason || label}
              tabIndex={value === tabStop ? 0 : -1} onFocus={() => setFocusedDate(value)}
              onKeyDown={(event) => handleDayKeyDown(event, value)}
              onClick={() => { setFocusedDate(value); onDateSelect(value); }}
              className={`relative flex aspect-square w-full max-w-11 min-w-0 items-center justify-center justify-self-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a684d] ${
                isDisabled ? 'cursor-not-allowed text-[#b4aaa0]'
                  : selected ? 'bg-[#4a3728] text-white' : 'text-[#4a3728] hover:bg-[#f5f2ed]'
              }`}>
              {format(day, 'd')}
              {value === today && !selected && <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
      {!disabled && Object.keys(disabledDateReasons).some((date) => date.startsWith(displayedMonth)) && (
        <details className="mt-3 border-t border-[#d9cfc1] pt-2 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Ver datas indisponíveis</summary>
          <ul className="space-y-2 pb-2 text-[#76695e]">
            {availableDates.filter((date) => date.startsWith(displayedMonth) && disabledDateReasons[date]).map((date) => (
              <li key={date}>{format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM')} — {disabledDateReasons[date]}</li>
            ))}
          </ul>
        </details>
      )}
      <p id={helpId} className="sr-only">Use as setas para navegar pelos dias disponíveis e Enter para selecionar. Dias indisponíveis e fora do período não podem ser selecionados.</p>
    </section>
  );
}
