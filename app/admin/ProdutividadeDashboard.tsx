'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { Database } from '@/lib/supabase/database.types';
import { format, parseISO, isToday } from 'date-fns';

type TaskCompletion = Database['public']['Tables']['task_completions']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface CompletionWithDetails extends TaskCompletion {
  task: Task;
  employee: Profile;
}

export default function ProdutividadeDashboard() {
  const [completions, setCompletions] = useState<CompletionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchDashboard = React.useCallback(async () => {
    setLoading(true);
    
    // Fetch today's completions
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: compData } = await supabase
      .from('task_completions')
      .select('*, task:tasks(*), employee:profiles!task_completions_employee_id_fkey(*)')
      .gte('execution_date', today)
      .order('completed_at', { ascending: false });

    if (compData) {
      setCompletions(compData as unknown as CompletionWithDetails[]);
    }
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleApprove = async (completionId: string) => {
    setUpdating(completionId);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase
        .from('task_completions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', completionId);

      if (!error) {
        setCompletions(prev => prev.map(c => c.id === completionId ? { ...c, status: 'approved' } : c));
      }
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
        <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
      </div>
    );
  }

  const awaitingReview = completions.filter(c => c.status === 'awaiting_review');
  const approved = completions.filter(c => c.status === 'approved');
  const inProgress = completions.filter(c => c.status === 'in_progress');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-[#D9CFC1] flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><AlertTriangle size={24} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">Aguardando Revisão</p>
            <p className="text-2xl font-bold">{awaitingReview.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-[#D9CFC1] flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><CheckCircle size={24} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">Aprovadas Hoje</p>
            <p className="text-2xl font-bold">{approved.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-[#D9CFC1] flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Clock size={24} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">Em Andamento</p>
            <p className="text-2xl font-bold">{inProgress.length}</p>
          </div>
        </div>
      </div>

      {/* Review List */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#D9CFC1] overflow-hidden">
        <div className="p-6 border-b border-[#D9CFC1]/50 flex items-center gap-3">
          <div className="p-3 bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><UserCheck size={20} /></div>
          <div>
            <h3 className="font-bold text-lg">Aprovação de Tarefas</h3>
            <p className="text-xs text-[#4A3728]/60 mt-1">Revise as tarefas que os funcionários acabaram de concluir.</p>
          </div>
        </div>

        <div className="divide-y divide-[#D9CFC1]/40">
          {awaitingReview.length === 0 && (
            <div className="p-10 text-center text-[#4A3728]/50 text-sm">Nenhuma tarefa pendente de revisão. Ótimo trabalho! 🎉</div>
          )}
          {awaitingReview.map(comp => {
            const timeEstimate = comp.task.time_estimate_minutes * 60;
            const timeTaken = Math.floor((new Date(comp.completed_at!).getTime() - new Date(comp.started_at!).getTime()) / 1000);
            const isOvertime = timeTaken > timeEstimate;
            
            return (
              <div key={comp.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FDFBF7] transition-colors">
                <div>
                  <h4 className="font-bold text-base">{comp.task.title}</h4>
                  <p className="text-[11px] uppercase font-bold tracking-widest text-[#4A3728]/50 mt-1">
                    Feito por: <span className="text-[#4A3728]">{comp.employee?.full_name}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                      Concluído às {format(parseISO(comp.completed_at!), 'HH:mm')}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border ${isOvertime ? 'text-red-700 bg-red-50 border-red-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>
                      Tempo Real: {Math.floor(timeTaken / 60)}min (Est: {comp.task.time_estimate_minutes}min)
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleApprove(comp.id)}
                  disabled={updating === comp.id}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-green-600 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-green-500/20"
                >
                  {updating === comp.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Aprovar Execução
                </button>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Recently Approved */}
      {approved.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-[#D9CFC1] p-6 opacity-70">
          <h3 className="font-bold text-sm mb-4 uppercase tracking-widest text-[#4A3728]/50">Aprovadas Recentemente</h3>
          <div className="space-y-3">
            {approved.slice(0, 5).map(comp => (
              <div key={comp.id} className="flex justify-between items-center text-xs p-3 bg-[#F5F2ED] rounded-xl">
                <span className="font-bold">{comp.task.title} <span className="font-normal text-[#4A3728]/60">por {comp.employee?.full_name}</span></span>
                <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> Aprovado</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
