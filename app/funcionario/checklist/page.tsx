'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  Clock, 
  Play, 
  Loader2, 
  LogOut,
  AlertCircle,
  Pencil,
  X,
  Save,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/lib/supabase/database.types';
import ForcePasswordChangeModal from '@/app/components/ForcePasswordChangeModal';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskCompletion = Database['public']['Tables']['task_completions']['Row'];

export default function ChecklistPage() {
  const [tasks, setTasks] = useState<{task: Task, completion: TaskCompletion | null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  
  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('job_role_id, force_password_change, full_name')
        .eq('id', user.id)
        .single();

      setUserId(user.id);
      if (profile) {
        setUserRole(profile.job_role_id);
        setUserName(profile.full_name);
        if (profile.force_password_change) {
          setForcePasswordChange(true);
        }
      }
      
      await fetchTasks(user.id, profile?.job_role_id);
    };
    init();
  }, [supabase, router]);

  const fetchTasks = async (uid: string, roleId?: string | null) => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Fetch all applicable tasks
    let query = supabase.from('tasks').select('*');
    // We fetch tasks assigned to this user OR this user's role OR null (general)
    // Actually, Supabase JS OR is a bit tricky, let's fetch all and filter in JS for simplicity 
    // since the task list is small per day.
    
    const { data: allTasks } = await query;
    
    if (allTasks) {
      const applicableTasks = allTasks.filter(t => {
        // Must be for today or daily
        if (!t.is_daily && t.target_date !== today) return false;
        
        // Must be assigned to user, user's role, or general
        if (t.assigned_employee_id && t.assigned_employee_id !== uid) return false;
        if (t.assigned_role_id && t.assigned_role_id !== roleId) return false;
        
        return true;
      });

      // Fetch completions for today
      const { data: completions } = await supabase
        .from('task_completions')
        .select('*')
        .eq('execution_date', today);

      const combined = applicableTasks.map(t => {
        // Find if this task has a completion record today
        // For role-based tasks, maybe someone else took it
        const comp = completions?.find(c => c.task_id === t.id);
        return { task: t, completion: comp || null };
      });

      // Filter out role tasks that someone ELSE has already taken and we aren't part of
      const finalTasks = combined.filter(item => {
        if (item.task.assigned_role_id && item.completion && item.completion.employee_id !== uid) {
          return false; // Someone else grabbed this role task
        }
        return true;
      });

      setTasks(finalTasks);
    }
    setLoading(false);
  };

  const startTask = async (taskId: string) => {
    if (!userId) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        task_id: taskId,
        employee_id: userId,
        execution_date: today,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (!error && data) {
      setTasks(prev => prev.map(t => t.task.id === taskId ? { ...t, completion: data } : t));
    }
  };

  const completeTask = async (completionId: string) => {
    const { data, error } = await supabase
      .from('task_completions')
      .update({
        status: 'awaiting_review',
        completed_at: new Date().toISOString()
      })
      .eq('id', completionId)
      .select()
      .single();

    if (!error && data) {
      setTasks(prev => prev.map(t => t.completion?.id === completionId ? { ...t, completion: data } : t));
    }
  };

  const handleSaveProfile = async () => {
    if (!userId || !editName.trim()) return;
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editName.trim() })
      .eq('id', userId);
      
    if (!error) {
      setUserName(editName.trim());
      setIsEditingProfile(false);
    } else {
      alert('Erro ao atualizar nome: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#4A3728] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728] flex flex-col">
      {forcePasswordChange && userId && (
        <ForcePasswordChangeModal 
          userId={userId} 
          onSuccess={() => setForcePasswordChange(false)} 
        />
      )}
      <header className="bg-[#4A3728] text-white p-6 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-serif font-bold uppercase tracking-widest flex items-center gap-2">
            Duna Checklist
          </h1>
          <p className="text-[10px] text-white/60 tracking-widest uppercase mt-1">{format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditName(userName || ''); setIsEditingProfile(true); }} className="flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-2 rounded-xl hover:bg-white/20 transition-colors">
            <User size={14} /> <span className="hidden sm:inline">{userName || 'Perfil'}</span>
          </button>
          <button onClick={handleLogout} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-[#4A3728]">Editar Perfil</h3>
              <button onClick={() => setIsEditingProfile(false)} className="text-[#4A3728]/50 hover:text-[#4A3728]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nome Completo</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none"
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSaveProfile}
                className="w-full bg-[#4A3728] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#3d2d21] transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 space-y-4 max-w-md mx-auto w-full">
        {tasks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
            <CheckCircle size={40} className="mx-auto text-green-500 mb-4" />
            <p className="text-sm font-bold text-[#4A3728]/60">Nenhuma tarefa para hoje!</p>
          </div>
        ) : (
          tasks.map(({ task, completion }) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              completion={completion} 
              onStart={() => startTask(task.id)}
              onComplete={() => completion && completeTask(completion.id)}
            />
          ))
        )}
      </main>
    </div>
  );
}

function TaskCard({ task, completion, onStart, onComplete }: { task: Task, completion: TaskCompletion | null, onStart: () => void, onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (completion?.status === 'in_progress' && completion.started_at) {
      interval = setInterval(() => {
        const start = new Date(completion.started_at!).getTime();
        const now = new Date().getTime();
        setElapsed(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [completion]);

  const isCompleted = completion?.status === 'awaiting_review' || completion?.status === 'approved';
  const isInProgress = completion?.status === 'in_progress';
  
  const totalSeconds = task.time_estimate_minutes * 60;
  const isOvertime = elapsed > totalSeconds;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isCompleted) {
    return (
      <div className="bg-green-50 rounded-3xl p-5 border border-green-200 opacity-70">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-green-500" size={24} />
          <div>
            <h3 className="font-bold text-green-900 strike-through line-through">{task.title}</h3>
            <p className="text-[10px] uppercase font-bold text-green-700 mt-1">Aguardando Revisão</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl p-5 shadow-sm border transition-all ${isInProgress ? (isOvertime ? 'border-red-400 shadow-red-100' : 'border-amber-400 shadow-amber-100') : 'border-[#D9CFC1]'}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-lg">{task.title}</h3>
        {task.scheduled_time && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50 bg-[#F5F2ED] px-2 py-1 rounded-lg">
            <Clock size={12} /> {task.scheduled_time.slice(0,5)}
          </span>
        )}
      </div>
      
      <p className="text-sm text-[#4A3728]/70 leading-relaxed mb-5">{task.description}</p>
      
      <div className="flex items-center justify-between mt-auto">
        {!isInProgress ? (
          <>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase text-[#4A3728]/40 mb-0.5">Tempo Estimado</span>
              <span className="text-xs font-bold">{task.time_estimate_minutes} minutos</span>
            </div>
            <button 
              onClick={onStart}
              className="flex items-center gap-2 bg-[#4A3728] text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-[#3d2d21] transition-colors"
            >
              <Play size={14} /> Iniciar
            </button>
          </>
        ) : (
          <>
            <div className={`flex flex-col ${isOvertime ? 'text-red-600' : 'text-amber-600'}`}>
              <span className="text-[9px] font-bold uppercase mb-0.5">{isOvertime ? 'Tempo Esgotado!' : 'Tempo Rolando'}</span>
              <span className="text-2xl font-bold font-mono tracking-tighter">{formatTime(elapsed)}</span>
            </div>
            <button 
              onClick={onComplete}
              className="flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
            >
              <CheckCircle size={16} /> Concluir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
