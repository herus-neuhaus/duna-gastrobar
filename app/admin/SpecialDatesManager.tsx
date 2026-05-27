import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Loader2, CalendarDays, AlertCircle } from 'lucide-react';

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
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#F5F2ED] text-[#4A3728]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Descrição</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Regra de Cobrança</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9CFC1]/40">
                  {dates.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FDFBF7] transition-colors group">
                      <td className="px-6 py-5 font-bold">
                        {format(parseISO(d.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-5 text-[#4A3728]/80 font-medium">
                        {d.description || '-'}
                      </td>
                      <td className="px-6 py-5">
                        {d.requires_fee ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                            Taxa: R$ {Number(d.fee_amount).toFixed(2)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                            Sem Taxa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => handleDelete(d.id)}
                          className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors inline-flex"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
