'use client';

import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  isBefore, 
  startOfToday,
  isAfter,
  addDays as addDaysFns
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export default function CalendarPicker({ selectedDate, onDateSelect }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfToday();
  const maxDate = addMonths(today, 3); // Permitir agendar até 3 meses no futuro

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-2 mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isSameMonth(currentMonth, today)}
          className="p-2 hover:bg-[#F5F2ED] rounded-full transition-colors disabled:opacity-20"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={isSameMonth(currentMonth, maxDate)}
          className="p-2 hover:bg-[#F5F2ED] rounded-full transition-colors disabled:opacity-20"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div key={day} className="text-center text-[10px] font-bold uppercase text-[#4A3728]/40 py-2">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'yyyy-MM-dd');
        const cloneDay = day;
        const isDisabled = isBefore(day, today) || isAfter(day, maxDate);
        const isSelected = selectedDate === formattedDate;
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <button
            key={formattedDate}
            disabled={isDisabled}
            onClick={() => onDateSelect(format(cloneDay, 'yyyy-MM-dd'))}
            className={`
              relative h-10 flex items-center justify-center text-xs font-medium rounded-xl transition-all
              ${isDisabled ? 'text-[#4A3728]/10 cursor-not-allowed' : 'hover:bg-[#F5F2ED] text-[#4A3728]'}
              ${isSelected ? 'bg-[#4A3728] text-white hover:bg-[#4A3728]' : ''}
              ${!isCurrentMonth && !isSelected ? 'text-[#4A3728]/30' : ''}
            `}
          >
            <span>{format(day, 'd')}</span>
            {isSameDay(day, today) && !isSelected && (
              <div className="absolute bottom-1.5 w-1 h-1 bg-[#4A3728] rounded-full"></div>
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="space-y-1">{rows}</div>;
  };

  return (
    <div className="p-2 animate-in fade-in slide-in-from-top-2 duration-300">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}
