import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarOff } from 'lucide-react';

type BlockedDate = {
  id: string;
  date: string;
  reason: string | null;
};

export default function BlockedDatesManager() {
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  
  const supabase = createClient();

  const fetchDates = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .order('date', { ascending: true });

    if (!error && data) {
      setDates(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDates();
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
      <div className="bg-white rounded-[32px] p-8 border border-[#D9CFC1] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#F5F2ED] rounded-2xl flex items-center justify-center text-[#4A3728]">
            <CalendarOff size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#4A3728]">Datas Bloqueadas</h3>
            <p className="text-sm text-[#4A3728]/60">Bloqueie reservas pelo site em dias específicos. Os clientes serão direcionados para o WhatsApp.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAddDate} className="bg-white rounded-[32px] border border-[#D9CFC1] p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728] mb-4">Adicionar Bloqueio</h4>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Data</label>
              <input 
                type="date" 
                required
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
        </div>

        {/* Lista */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] border border-[#D9CFC1] shadow-sm overflow-hidden min-h-[300px]">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#4A3728]/20 animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando...</p>
              </div>
            ) : dates.length === 0 ? (
              <div className="p-20 text-center">
                <CalendarOff size={40} className="mx-auto text-[#4A3728]/10 mb-4" />
                <p className="text-sm font-bold text-[#4A3728]/40">Nenhuma data bloqueada.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D9CFC1]/40">
                {dates.map((d) => (
                  <div key={d.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FDFBF7] transition-colors group">
                    <div className="flex flex-col gap-1.5 w-full md:w-auto">
                      <div className="font-bold text-base text-red-600">
                        {format(parseISO(d.date), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-[#4A3728]/80 text-sm font-medium">
                        {d.reason || 'Sem descrição'}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(d.id)}
                      className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors md:opacity-0 group-hover:opacity-100 shrink-0 self-end md:self-auto"
                      title="Remover Bloqueio"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
