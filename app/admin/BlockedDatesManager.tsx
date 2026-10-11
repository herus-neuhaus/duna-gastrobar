import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldLabel, Input } from '@/components/ui/form-controls';
import { StatusBadge } from '@/components/ui/status-badge';

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
      <Card className="flex items-start gap-4 p-5 shadow-sm md:p-7">
        <div className="w-12 h-12 shrink-0 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
          <CalendarOff size={24} />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold text-[#4A3728]">Datas Bloqueadas</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#4A3728]/60">Bloqueie somente os próximos dias em que não haverá reservas online.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6 xl:gap-8">
        <form onSubmit={handleAddDate} className="ui-card h-fit space-y-4 p-5 shadow-sm md:p-6 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">Novo bloqueio</h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/40">Futuro</span>
          </div>
            <div>
              <FieldLabel htmlFor="blocked-date">Data</FieldLabel>
              <Input
                id="blocked-date"
                type="date" 
                required
                min={today}
                value={newDate} 
                onChange={e => setNewDate(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel htmlFor="blocked-reason">Motivo / Descrição</FieldLabel>
              <Input
                id="blocked-reason"
                type="text" 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                placeholder="Ex: Evento Fechado (Opcional)"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !newDate}
              variant="danger"
              size="lg"
              className="mt-4 w-full uppercase tracking-widest"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Bloquear Data</>}
            </Button>
        </form>

        <Card className="min-h-[300px] overflow-hidden shadow-sm">
          <CardHeader>
            <div>
              <CardTitle>Próximos bloqueios</CardTitle>
              <p className="mt-0.5 text-xs text-[#4A3728]/55">Bloqueios vencidos permanecem no histórico, mas não afetam novas reservas.</p>
            </div>
            <StatusBadge label={`${dates.length}`} tone="danger" />
          </CardHeader>
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#4A3728]/20 animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando...</p>
              </div>
            ) : dates.length === 0 ? (
              <EmptyState icon={<CalendarOff size={32} />} title="Nenhum próximo bloqueio" description="As datas bloqueadas aparecerão aqui." />
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
                    <Button
                      onClick={() => handleDelete(d.id)}
                      variant="danger"
                      size="sm"
                      className="w-full sm:w-auto"
                      title="Remover Bloqueio"
                    >
                      <Trash2 size={16} /> <span className="text-xs font-bold sm:hidden">Liberar data</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>
    </div>
  );
}
