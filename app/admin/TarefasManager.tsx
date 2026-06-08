'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, ListChecks, Calendar, Clock, User, Trash2, Pencil, X, Save } from 'lucide-react';
import { Database } from '@/lib/supabase/database.types';
import { format, parseISO } from 'date-fns';

type Category = Database['public']['Tables']['task_categories']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Role = Database['public']['Tables']['employee_roles']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function TarefasManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category_id: '',
    time_estimate_minutes: '15',
    scheduled_time: '',
    is_daily: true,
    target_date: '',
    assign_type: 'none', // none, employee, role
    assigned_employee_id: '',
    assigned_role_id: ''
  });
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [catRes, taskRes, roleRes, empRes] = await Promise.all([
      supabase.from('task_categories').select('*').order('name'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_roles').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'employee').order('full_name')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (roleRes.data) setRoles(roleRes.data);
    if (empRes.data) setEmployees(empRes.data);
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    
    setCreatingCat(true);
    const { data } = await supabase
      .from('task_categories')
      .insert({ name: newCatName.trim() })
      .select()
      .single();
      
    if (data) {
      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCatName('');
    }
    setCreatingCat(false);
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editCategoryName.trim()) return;
    const { error } = await supabase.from('task_categories').update({ name: editCategoryName.trim() }).eq('id', id);
    if (!error) {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editCategoryName.trim() } : c).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingCategoryId(null);
    } else {
      alert('Erro ao atualizar: ' + error.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta categoria? As tarefas associadas a ela podem ficar sem categoria.')) return;
    const { error } = await supabase.from('task_categories').delete().eq('id', id);
    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id));
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTask(true);

    const taskData: any = {
      title: taskForm.title,
      description: taskForm.description,
      category_id: taskForm.category_id,
      time_estimate_minutes: parseInt(taskForm.time_estimate_minutes),
      scheduled_time: taskForm.scheduled_time || null,
      is_daily: taskForm.is_daily,
      target_date: taskForm.is_daily ? null : taskForm.target_date,
      assigned_employee_id: taskForm.assign_type === 'employee' ? taskForm.assigned_employee_id : null,
      assigned_role_id: taskForm.assign_type === 'role' ? taskForm.assigned_role_id : null,
    };

    if (editingTaskId) {
      const { data, error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', editingTaskId)
        .select()
        .single();
        
      if (data) {
        setTasks(prev => prev.map(t => t.id === editingTaskId ? data : t));
        setShowTaskForm(false);
        setEditingTaskId(null);
        resetForm();
      } else if (error) {
        alert('Erro ao atualizar: ' + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (data) {
        setTasks(prev => [data, ...prev]);
        setShowTaskForm(false);
        resetForm();
      } else if (error) {
        alert('Erro ao criar: ' + error.message);
      }
    }
    
    setSavingTask(false);
  };

  const resetForm = () => {
    setTaskForm({
      title: '', description: '', category_id: '', time_estimate_minutes: '15',
      scheduled_time: '', is_daily: true, target_date: '', assign_type: 'none',
      assigned_employee_id: '', assigned_role_id: ''
    });
  };

  const startEditTask = (task: Task) => {
    let assignType = 'none';
    if (task.assigned_employee_id) assignType = 'employee';
    else if (task.assigned_role_id) assignType = 'role';

    setTaskForm({
      title: task.title,
      description: task.description || '',
      category_id: task.category_id || '',
      time_estimate_minutes: task.time_estimate_minutes?.toString() || '15',
      scheduled_time: task.scheduled_time || '',
      is_daily: task.is_daily,
      target_date: task.target_date || '',
      assign_type: assignType,
      assigned_employee_id: task.assigned_employee_id || '',
      assigned_role_id: task.assigned_role_id || ''
    });
    setEditingTaskId(task.id);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const getAssigneeLabel = (task: Task) => {
    if (task.assigned_employee_id) {
      const emp = employees.find(e => e.id === task.assigned_employee_id);
      return <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded-md text-[10px] border border-blue-200">Func: {emp?.full_name || 'Desconhecido'}</span>;
    }
    if (task.assigned_role_id) {
      const role = roles.find(r => r.id === task.assigned_role_id);
      return <span className="text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-[10px] border border-purple-200">Setor: {role?.name || 'Desconhecido'}</span>;
    }
    return <span className="text-gray-700 bg-gray-100 px-2 py-1 rounded-md text-[10px] border border-gray-200">Qualquer Funcionário</span>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
        <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Categories */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#D9CFC1]">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ListChecks size={20} /> Categorias de Tarefas</h3>
        <form onSubmit={handleCreateCategory} className="flex gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Nova categoria (Ex: Turno do dia)..." 
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="flex-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#4A3728] outline-none"
          />
          <button 
            type="submit"
            disabled={creatingCat || !newCatName.trim()}
            className="bg-[#4A3728] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#3d2d21] disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => {
            if (editingCategoryId === c.id) {
              return (
                <div key={c.id} className="flex items-center gap-2 bg-[#EBE3D5] px-2 py-1 rounded-xl border border-[#4A3728]">
                  <input 
                    type="text" 
                    value={editCategoryName}
                    onChange={e => setEditCategoryName(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm font-bold text-[#4A3728] w-32 px-2"
                    autoFocus
                  />
                  <button onClick={() => handleUpdateCategory(c.id)} className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg"><Save size={14} /></button>
                  <button onClick={() => setEditingCategoryId(null)} className="p-1.5 text-red-700 hover:bg-red-100 rounded-lg"><X size={14} /></button>
                </div>
              );
            }
            return (
              <div key={c.id} className="group flex items-center gap-1 bg-[#EBE3D5] text-[#4A3728] pl-4 pr-2 py-1.5 rounded-xl text-sm font-bold border border-[#D9CFC1]">
                <span>{c.name}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 gap-1">
                  <button onClick={() => { setEditingCategoryId(c.id); setEditCategoryName(c.name); }} className="p-1 hover:bg-[#D9CFC1] rounded-lg text-[#4A3728]" title="Editar"><Pencil size={12} /></button>
                  <button onClick={() => handleDeleteCategory(c.id)} className="p-1 hover:bg-red-200 rounded-lg text-red-600" title="Apagar"><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
          {categories.length === 0 && <span className="text-sm text-[#4A3728]/50 italic">Nenhuma categoria cadastrada.</span>}
        </div>
      </div>

      {/* Task Creation Form */}
      {showTaskForm && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#4A3728]/20 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6 border-b border-[#D9CFC1]/50 pb-4">
            <h3 className="font-bold text-lg">{editingTaskId ? 'Editar Tarefa' : 'Criar Nova Tarefa'}</h3>
            <button onClick={() => { setShowTaskForm(false); setEditingTaskId(null); resetForm(); }} className="p-2 hover:bg-[#F5F2ED] rounded-lg text-[#4A3728]/60 hover:text-[#4A3728] transition-colors"><X size={20} /></button>
          </div>

          <form onSubmit={handleSaveTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Título da Tarefa *</label>
                <input required type="text" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="w-full px-4 py-3 bg-[#F5F2ED] rounded-xl text-sm outline-none focus:ring-1" placeholder="Ex: Arrumar Salão" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Categoria *</label>
                <select required value={taskForm.category_id} onChange={e => setTaskForm({...taskForm, category_id: e.target.value})} className="w-full px-4 py-3 bg-[#F5F2ED] rounded-xl text-sm outline-none focus:ring-1">
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Padrão de Execução / Descrição *</label>
              <textarea required value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} className="w-full px-4 py-3 bg-[#F5F2ED] rounded-xl text-sm outline-none focus:ring-1 h-24" placeholder="Descreva os passos que o funcionário deve seguir..."></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70 flex items-center gap-1"><Clock size={12}/> Tempo Estimado (min) *</label>
                <input required type="number" min="1" value={taskForm.time_estimate_minutes} onChange={e => setTaskForm({...taskForm, time_estimate_minutes: e.target.value})} className="w-full px-4 py-3 bg-[#F5F2ED] rounded-xl text-sm outline-none focus:ring-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Horário Sugerido (Opcional)</label>
                <input type="time" value={taskForm.scheduled_time} onChange={e => setTaskForm({...taskForm, scheduled_time: e.target.value})} className="w-full px-4 py-3 bg-[#F5F2ED] rounded-xl text-sm outline-none focus:ring-1" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#FDFBF7] border border-[#D9CFC1] rounded-2xl">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Tipo de Recorrência *</label>
                <select value={taskForm.is_daily ? 'true' : 'false'} onChange={e => setTaskForm({...taskForm, is_daily: e.target.value === 'true'})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1]">
                  <option value="true">Diária (Repete todos os dias)</option>
                  <option value="false">Tarefa Única (Dia específico)</option>
                </select>
              </div>
              {!taskForm.is_daily && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70 flex items-center gap-1"><Calendar size={12}/> Data da Tarefa *</label>
                  <input required={!taskForm.is_daily} type="date" value={taskForm.target_date} onChange={e => setTaskForm({...taskForm, target_date: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1]" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#FDFBF7] border border-[#D9CFC1] rounded-2xl">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Atribuição *</label>
                <select value={taskForm.assign_type} onChange={e => setTaskForm({...taskForm, assign_type: e.target.value, assigned_employee_id: '', assigned_role_id: ''})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1]">
                  <option value="none">Qualquer Funcionário</option>
                  <option value="role">Para um Setor / Cargo</option>
                  <option value="employee">Para Funcionário Específico</option>
                </select>
              </div>
              {taskForm.assign_type === 'role' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Setor/Cargo *</label>
                  <select required value={taskForm.assigned_role_id} onChange={e => setTaskForm({...taskForm, assigned_role_id: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1]">
                    <option value="">Selecione...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              {taskForm.assign_type === 'employee' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Funcionário *</label>
                  <select required value={taskForm.assigned_employee_id} onChange={e => setTaskForm({...taskForm, assigned_employee_id: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1]">
                    <option value="">Selecione...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowTaskForm(false); setEditingTaskId(null); resetForm(); }} className="bg-[#F5F2ED] text-[#4A3728] px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#EBE6DD] transition-colors">
                Cancelar
              </button>
              <button disabled={savingTask} type="submit" className="bg-[#4A3728] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#3d2d21] disabled:opacity-50 flex items-center justify-center gap-2">
                {savingTask ? <Loader2 size={16} className="animate-spin" /> : (editingTaskId ? <><Save size={16}/> Salvar</> : <><Plus size={16}/> Criar Tarefa</>)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      {!showTaskForm && (
        <div className="bg-white rounded-3xl shadow-sm border border-[#D9CFC1] overflow-hidden">
          <div className="p-6 border-b border-[#D9CFC1]/50 flex justify-between items-center">
            <h3 className="font-bold text-lg">Banco de Tarefas</h3>
            <button 
              onClick={() => {
                if (categories.length === 0) alert('Crie uma categoria primeiro!');
                else setShowTaskForm(true);
              }}
              className="bg-[#4A3728] text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#3d2d21] flex items-center gap-2"
            >
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>

          <div className="divide-y divide-[#D9CFC1]/40">
            {tasks.map(task => {
              const cat = categories.find(c => c.id === task.category_id);
              return (
                <div key={task.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FDFBF7] transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3728]/50">{cat?.name}</span>
                      {task.is_daily ? 
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest border border-green-200">Diária</span> : 
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest border border-amber-200">Única: {format(parseISO(task.target_date!), 'dd/MM')}</span>
                      }
                    </div>
                    <h4 className="font-bold text-base">{task.title}</h4>
                    <p className="text-xs text-[#4A3728]/60 mt-1 line-clamp-1">{task.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      {getAssigneeLabel(task)}
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#4A3728]/60"><Clock size={12}/> {task.time_estimate_minutes} min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 md:mt-0">
                    <button 
                      onClick={() => startEditTask(task)} 
                      className="px-3 py-2 text-[#4A3728] bg-[#F5F2ED] hover:bg-[#EBE6DD] rounded-xl transition-colors inline-flex items-center gap-2 text-xs font-bold"
                      title="Editar"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id)} 
                      className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors inline-flex items-center gap-2 text-xs font-bold"
                      title="Apagar"
                    >
                      <Trash2 size={14} /> Apagar
                    </button>
                  </div>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <div className="p-10 text-center text-[#4A3728]/50 text-sm">Nenhuma tarefa cadastrada.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
