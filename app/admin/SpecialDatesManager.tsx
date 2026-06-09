import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarDays, AlertCircle, Pencil, X, Save } from 'lucide-react';

type SpecialDate = {
  id: string;
  date: string;
  requires_fee: boolean;
  fee_amount: number;
  description: string;
};

export default function SpecialDatesManager() {
  const [dates, setDates] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newDate, setNewDate] = useState('');
  const [requiresFee, setRequiresFee] = useState(true);
  const [feeAmount, setFeeAmount] = useState('100');
  const [description, setDescription] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editRequiresFee, setEditRequiresFee] = useState(true);
  const [editFeeAmount, setEditFeeAmount] = useState('100');
  const [editDescription, setEditDescription] = useState('');
  
  const supabase = createClient();

  const fetchDates = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('special_dates')
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
      .from('special_dates')
      .insert([
        {
          date: newDate,
          requires_fee: requiresFee,
          fee_amount: requiresFee ? parseFloat(feeAmount) : 0,
          description: description
        }
      ]);

    if (error) {
      alert('Erro ao adicionar data: ' + error.message);
    } else {
      setNewDate('');
      setDescription('');
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
        description: editDescription
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
      <div className="bg-white rounded-[32px] p-8 border border-[#D9CFC1] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#F5F2ED] rounded-2xl flex items-center justify-center text-[#4A3728]">
            <CalendarDays size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#4A3728]">Datas Especiais</h3>
            <p className="text-sm text-[#4A3728]/60">Configure datas comemorativas que exigem cobrança de taxa de reserva (ex: Dia dos Namorados).</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAddDate} className="bg-white rounded-[32px] border border-[#D9CFC1] p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728] mb-4">Adicionar Nova Data</h4>
            
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
              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Descrição (ex: Dia dos Namorados)</label>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none placeholder:text-[#4A3728]/30"
                placeholder="Opcional"
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
                <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Valor da Taxa (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={feeAmount} 
                  onChange={e => setFeeAmount(e.target.value)}
                  className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none"
                />
                <p className="text-[9px] mt-2 text-[#4A3728]/50 italic">*O valor será revertido em consumação no dia.</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting || !newDate}
              className="w-full mt-4 py-4 bg-[#4A3728] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#3d2d21] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Adicionar Data</>}
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
                <CalendarDays size={40} className="mx-auto text-[#4A3728]/10 mb-4" />
                <p className="text-sm font-bold text-[#4A3728]/40">Nenhuma data especial configurada.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D9CFC1]/40">
                {dates.map((d) => (
                  <React.Fragment key={d.id}>
                    <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FDFBF7] transition-colors group">
                      <div className="flex flex-col gap-1.5 w-full md:w-auto">
                        <div className="font-bold text-base text-[#4A3728]">
                          {format(parseISO(d.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-[#4A3728]/80 text-sm font-medium">
                          {d.description || '-'}
                        </div>
                        <div className="mt-1">
                          {d.requires_fee ? (
                            <span className="px-2.5 py-1 inline-block bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                              Taxa: R$ {Number(d.fee_amount).toFixed(2)}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 inline-block bg-gray-100 text-gray-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                              Sem Taxa
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto justify-end">
                        <button 
                          onClick={() => startEdit(d)}
                          className="flex-1 md:flex-none px-3 py-2.5 md:py-2 text-[#4A3728] bg-[#F5F2ED] hover:bg-[#EBE6DD] rounded-xl transition-colors inline-flex items-center justify-center gap-2 text-xs font-bold"
                          title="Editar"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button 
                          onClick={() => handleDelete(d.id)}
                          className="flex-1 md:flex-none px-3 py-2.5 md:py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors inline-flex items-center justify-center gap-2 text-xs font-bold"
                          title="Remover"
                        >
                          <Trash2 size={14} /> Apagar
                        </button>
                      </div>
                    </div>

                    {editingId === d.id && (
                      <div className="bg-[#FDFBF7] p-4 md:p-6 border-b border-[#D9CFC1]/40">
                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#D9CFC1] shadow-sm animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-[#4A3728]">Editar Data Especial</h4>
                            <button onClick={() => setEditingId(null)} className="p-2 hover:bg-[#F5F2ED] rounded-lg text-[#4A3728]/60 hover:text-[#4A3728] transition-colors">
                              <X size={20} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Data</label>
                              <input 
                                type="date" 
                                required
                                value={editDate} 
                                onChange={e => setEditDate(e.target.value)}
                                className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Descrição</label>
                              <input 
                                type="text" 
                                value={editDescription} 
                                onChange={e => setEditDescription(e.target.value)}
                                className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none placeholder:text-[#4A3728]/30"
                                placeholder="Opcional"
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
                                className="w-5 h-5 rounded-md border-[#D9CFC1] text-[#4A3728] focus:ring-[#4A3728] cursor-pointer"
                              />
                              <label htmlFor="edit-req-fee" className="text-xs font-bold text-[#4A3728] cursor-pointer">Cobrar taxa</label>
                            </div>

                            {editRequiresFee && (
                              <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase text-[#4A3728]/60 ml-1">Valor da Taxa (R$)</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  required
                                  value={editFeeAmount} 
                                  onChange={e => setEditFeeAmount(e.target.value)}
                                  className="w-full mt-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-2 text-sm text-[#4A3728] font-bold focus:ring-1 focus:ring-[#4A3728] outline-none"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col md:flex-row justify-end mt-6 gap-3">
                            <button 
                              onClick={() => setEditingId(null)}
                              className="w-full md:w-auto px-6 py-3.5 md:py-3 bg-[#F5F2ED] text-[#4A3728] rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#EBE6DD] transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleSaveEdit}
                              disabled={isSubmitting || !editDate}
                              className="w-full md:w-auto px-6 py-3.5 md:py-3 bg-[#4A3728] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#3d2d21] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Salvar Alterações</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
