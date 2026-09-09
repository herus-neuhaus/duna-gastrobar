import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarOff } from 'lucide-react';

type BlockedDate = {
  id: string;
  date: string;
  reason: string | null;
};

function getToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
}

export default function BlockedDatesManager() {
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  
  const [supabase] = useState(createClient);
  const today = getToday();

  const fetchDates = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .gte('date', getToday())
      .order('date', { ascending: true });

    if (!error && data) {
      setDates(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchDates();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchDates]);

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('blocked_dates')
      .insert([
        {
          date: newDate,
          reason: reason || null
        }
      ]);

    if (error) {
      alert('Erro ao adicionar data bloqueada: ' + error.message);
    } else {
      setNewDate('');
      setReason('');
      fetchDates();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este bloqueio e liberar a data no site?')) return;
    
    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erro ao remover: ' + error.message);
    } else {
      fetchDates();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[28px] p-5 md:p-7 border border-[#D9CFC1] flex items-start gap-4 shadow-sm">
        <div className="w-12 h-12 shrink-0 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
          <CalendarOff size={24} />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold text-[#4A3728]">Datas Bloqueadas</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#4A3728]/60">Bloqueie somente os próximos dias em que não haverá reservas online.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6 xl:gap-8">
        <form onSubmit={handleAddDate} className="bg-white rounded-[28px] border border-[#D9CFC1] p-5 md:p-6 shadow-sm space-y-4 h-fit xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">Novo bloqueio</h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/40">Futuro</span>
          </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Data</label>
              <input 
                type="date" 
                required
                min={today}
                value={newDate} 
                onChange={e => setNewDate(e.target.value)}
                className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Motivo / Descrição</label>
              <input 
                type="text" 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none placeholder:text-[#4A3728]/30"
                placeholder="Ex: Evento Fechado (Opcional)"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !newDate}
              className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Bloquear Data</>}
            </button>
        </form>

        <div className="bg-white rounded-[28px] border border-[#D9CFC1] shadow-sm overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between gap-4 border-b border-[#D9CFC1]/60 px-5 py-4 md:px-6">
            <div>
              <h4 className="font-bold text-[#4A3728]">Próximos bloqueios</h4>
              <p className="mt-0.5 text-xs text-[#4A3728]/55">Bloqueios vencidos permanecem no histórico, mas não afetam novas reservas.</p>
            </div>
            <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{dates.length}</span>
          </div>
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#4A3728]/20 animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando...</p>
              </div>
            ) : dates.length === 0 ? (
              <div className="p-20 text-center">
                <CalendarOff size={40} className="mx-auto text-[#4A3728]/10 mb-4" />
                <p className="text-sm font-bold text-[#4A3728]/40">Nenhum próximo bloqueio.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D9CFC1]/40">
                {dates.map((d) => (
                  <div key={d.id} className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] items-start sm:items-center gap-4 hover:bg-[#FDFBF7] transition-colors">
                    <div className="rounded-2xl bg-red-50 px-4 py-3 text-center sm:min-w-28">
                      <div className="font-bold text-base text-red-600 whitespace-nowrap">
                        {format(parseISO(d.date), 'dd/MM/yyyy')}
                      </div>
                    </div>
                    <div className="min-w-0 text-[#4A3728]/80 text-sm font-medium break-words">{d.reason || 'Sem descrição'}</div>
                    <button 
                      onClick={() => handleDelete(d.id)}
                      className="w-full sm:w-auto px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                      title="Remover Bloqueio"
                    >
                      <Trash2 size={16} /> <span className="text-xs font-bold sm:hidden">Liberar data</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
