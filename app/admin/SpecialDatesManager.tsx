import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarDays, AlertCircle, Pencil, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldLabel, Input } from '@/components/ui/form-controls';
import { StatusBadge } from '@/components/ui/status-badge';

type SpecialDate = {
  id: string;
  date: string;
  requires_fee: boolean;
  fee_amount: number;
  description: string;
  included_guests?: number | null;
};

function getToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
}

export default function SpecialDatesManager() {
  const [dates, setDates] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newDate, setNewDate] = useState('');
  const [requiresFee, setRequiresFee] = useState(true);
  const [feeAmount, setFeeAmount] = useState('100');
  const [description, setDescription] = useState('');
  const [includedGuests, setIncludedGuests] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editRequiresFee, setEditRequiresFee] = useState(true);
  const [editFeeAmount, setEditFeeAmount] = useState('100');
  const [editDescription, setEditDescription] = useState('');
  const [editIncludedGuests, setEditIncludedGuests] = useState('');
  
  const [supabase] = useState(createClient);
  const today = getToday();

  const fetchDates = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('special_dates')
      .select('*')
      .gte('date', getToday())
      .order('date', { ascending: true });

    if (!error && data) {
      setDates(data.map((date) => ({
        ...date,
        requires_fee: date.requires_fee ?? false,
        fee_amount: date.fee_amount ?? 0,
        description: date.description ?? '',
      })));
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
      .from('special_dates')
      .insert([
        {
          date: newDate,
          requires_fee: requiresFee,
          fee_amount: requiresFee ? parseFloat(feeAmount) : 0,
          description: description,
          included_guests: includedGuests ? parseInt(includedGuests) : null
        }
      ]);

    if (error) {
      alert('Erro ao adicionar data: ' + error.message);
    } else {
      setNewDate('');
      setDescription('');
      setIncludedGuests('');
      setFeeAmount('100');
      setRequiresFee(true);
      fetchDates();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta data especial?')) return;
    
    const { error } = await supabase
      .from('special_dates')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erro ao remover: ' + error.message);
    } else {
      fetchDates();
    }
  };

  const startEdit = (d: SpecialDate) => {
    setEditingId(d.id);
    setEditDate(d.date);
    setEditRequiresFee(d.requires_fee);
    setEditFeeAmount(d.fee_amount.toString());
    setEditDescription(d.description || '');
    setEditIncludedGuests(d.included_guests ? d.included_guests.toString() : '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('special_dates')
      .update({
        date: editDate,
        requires_fee: editRequiresFee,
        fee_amount: editRequiresFee ? parseFloat(editFeeAmount) : 0,
        description: editDescription,
        included_guests: editIncludedGuests ? parseInt(editIncludedGuests) : null
      })
      .eq('id', editingId);

    if (error) {
      alert('Erro ao atualizar: ' + error.message);
    } else {
      setEditingId(null);
      fetchDates();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="flex items-start gap-4 p-5 shadow-sm md:p-7">
        <div className="w-12 h-12 shrink-0 bg-[#F5F2ED] rounded-2xl flex items-center justify-center text-[#4A3728]">
          <CalendarDays size={24} />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold text-[#4A3728]">Datas Especiais</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#4A3728]/60">Configure apenas os próximos eventos com taxa ou pacote de reserva.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6 xl:gap-8">
        <form onSubmit={handleAddDate} className="ui-card h-fit space-y-4 p-5 shadow-sm md:p-6 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">Nova data</h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/40">Futuras</span>
          </div>
            <div>
              <FieldLabel htmlFor="special-date">Data</FieldLabel>
              <Input
                id="special-date"
                type="date" 
                required
                min={today}
                value={newDate} 
                onChange={e => setNewDate(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel htmlFor="special-description">Descrição (ex: Dia dos Namorados)</FieldLabel>
              <Input
                id="special-description"
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div>
              <FieldLabel htmlFor="special-included-guests">Pessoas Incluídas (Ex: 4 para mesas fechadas)</FieldLabel>
              <Input
                id="special-included-guests"
                type="number" 
                value={includedGuests} 
                onChange={e => setIncludedGuests(e.target.value)}
                placeholder="Deixe em branco para livre escolha"
              />
            </div>

            <div className="flex items-center gap-3 mt-4 p-4 bg-[#FDFBF7] border border-[#D9CFC1] rounded-xl">
              <input 
                type="checkbox" 
                id="req-fee"
                checked={requiresFee}
                onChange={e => setRequiresFee(e.target.checked)}
                className="w-5 h-5 rounded-md border-[#D9CFC1] text-[#4A3728] focus:ring-[#4A3728] cursor-pointer"
              />
              <label htmlFor="req-fee" className="text-xs font-bold text-[#4A3728] cursor-pointer">Cobrar taxa de reserva</label>
            </div>

            {requiresFee && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <FieldLabel htmlFor="special-fee">Valor da Taxa (R$)</FieldLabel>
                <Input
                  id="special-fee"
                  type="number" 
                  step="0.01"
                  required
                  value={feeAmount} 
                  onChange={e => setFeeAmount(e.target.value)}
                />
                <p className="text-[9px] mt-2 text-[#4A3728]/50 italic">*O valor será revertido em consumação no dia.</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !newDate}
              size="lg"
              className="mt-4 w-full uppercase tracking-widest"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Adicionar Data</>}
            </Button>
        </form>

        <Card className="min-h-[300px] overflow-hidden shadow-sm">
          <CardHeader>
            <div>
              <CardTitle>Próximas datas</CardTitle>
              <p className="mt-0.5 text-xs text-[#4A3728]/55">Datas passadas permanecem no histórico, mas não ficam disponíveis para reserva.</p>
            </div>
            <StatusBadge label={`${dates.length}`} />
          </CardHeader>
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#4A3728]/20 animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando...</p>
              </div>
            ) : dates.length === 0 ? (
              <EmptyState icon={<CalendarDays size={32} />} title="Nenhuma próxima data especial" description="As datas cadastradas aparecerão aqui." />
            ) : (
              <div className="divide-y divide-[#D9CFC1]/40">
                {dates.map((d) => (
                  <React.Fragment key={d.id}>
                    <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] items-start sm:items-center gap-4 hover:bg-[#FDFBF7] transition-colors">
                      <div className="rounded-2xl bg-[#F5F2ED] px-4 py-3 text-center sm:min-w-28">
                        <div className="font-bold text-base text-[#4A3728] whitespace-nowrap">
                          {format(parseISO(d.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/45">Evento</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[#4A3728] text-sm font-semibold break-words">
                          {d.description || '-'}
                          {d.included_guests ? ` • ${d.included_guests} pessoas` : ''}
                        </div>
                        <div className="mt-1">
                          {d.requires_fee ? (
                            <StatusBadge label={`Taxa: R$ ${Number(d.fee_amount).toFixed(2)}`} tone="warning" />
                          ) : (
                            <StatusBadge label="Sem taxa" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          onClick={() => startEdit(d)}
                          variant="secondary"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          title="Editar"
                        >
                          <Pencil size={14} /> Editar
                        </Button>
                        <Button
                          onClick={() => handleDelete(d.id)}
                          variant="danger"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          title="Remover"
                        >
                          <Trash2 size={14} /> Apagar
                        </Button>
                      </div>
                    </div>

                    {editingId === d.id && (
                      <div className="bg-[#FDFBF7] p-4 md:p-6 border-b border-[#D9CFC1]/40">
                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#D9CFC1] shadow-sm animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">Editar Data Especial</h4>
                            <Button type="button" onClick={() => setEditingId(null)} variant="ghost" size="icon" aria-label="Fechar edição">
                              <X size={20} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <FieldLabel htmlFor={`edit-special-date-${d.id}`}>Data</FieldLabel>
                              <Input
                                id={`edit-special-date-${d.id}`}
                                type="date" 
                                required
                                value={editDate} 
                                onChange={e => setEditDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <FieldLabel htmlFor={`edit-special-description-${d.id}`}>Descrição</FieldLabel>
                              <Input
                                id={`edit-special-description-${d.id}`}
                                type="text" 
                                value={editDescription} 
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Opcional"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel htmlFor={`edit-special-guests-${d.id}`}>Pessoas Incluídas (Opcional)</FieldLabel>
                              <Input
                                id={`edit-special-guests-${d.id}`}
                                type="number" 
                                value={editIncludedGuests} 
                                onChange={e => setEditIncludedGuests(e.target.value)}
                                placeholder="Deixe vazio para não limitar"
                              />
                            </div>
                          </div>
                          
                          <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4">
                            <div className="flex items-center gap-3 p-3 bg-[#F5F2ED] border border-[#D9CFC1]/50 rounded-xl flex-1 md:flex-none">
                              <input 
                                type="checkbox" 
                                id="edit-req-fee"
                                checked={editRequiresFee}
                                onChange={e => setEditRequiresFee(e.target.checked)}
                                className="tuc-check"
                              />
                              <label htmlFor="edit-req-fee" className="text-xs font-bold text-[#4A3728] cursor-pointer">Cobrar taxa</label>
                            </div>

                            {editRequiresFee && (
                              <div className="flex-1">
                                <FieldLabel htmlFor={`edit-special-fee-${d.id}`}>Valor da Taxa (R$)</FieldLabel>
                                <Input
                                  id={`edit-special-fee-${d.id}`}
                                  type="number" 
                                  step="0.01"
                                  required
                                  value={editFeeAmount} 
                                  onChange={e => setEditFeeAmount(e.target.value)}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col md:flex-row justify-end mt-6 gap-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="lg"
                              onClick={() => setEditingId(null)}
                              className="w-full uppercase tracking-widest md:w-auto"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={isSubmitting || !editDate}
                              size="lg"
                              className="w-full uppercase tracking-widest md:w-auto"
                            >
                              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Salvar Alterações</>}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
        </Card>
      </div>
    </div>
  );
}
