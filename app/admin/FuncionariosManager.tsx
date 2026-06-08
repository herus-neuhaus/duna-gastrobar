'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createClient as createSupabaseJSClient } from '@supabase/supabase-js';
import { Loader2, Plus, Users, Shield, UserPlus, X, Pencil, Trash2, Save } from 'lucide-react';
import { Database } from '@/lib/supabase/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Database['public']['Tables']['employee_roles']['Row'];

export default function FuncionariosManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New role state
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);

  // New employee state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', password: '', role: 'employee', job_role_id: '' });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState('');

  // Editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState('');

  // Status updates
  const [updating, setUpdating] = useState<string | null>(null);
  
  const supabase = createClient();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from('employee_roles').select('*').order('name'),
      supabase.from('profiles').select('*').order('full_name')
    ]);

    if (rolesRes.data) setRoles(rolesRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    
    setCreatingRole(true);
    const { data, error } = await supabase
      .from('employee_roles')
      .insert({ name: newRoleName.trim() })
      .select()
      .single();
      
    if (data) {
      setRoles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoleName('');
    }
    setCreatingRole(false);
  };

  const handleUpdateProfile = async (profileId: string, updates: { role?: string | null, job_role_id?: string | null }) => {
    setUpdating(profileId);
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId);
      
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...updates } : p));
    } else {
      alert('Erro ao atualizar: ' + error.message);
    }
    setUpdating(null);
  };

  const handleUpdateRole = async (id: string) => {
    if (!editRoleName.trim()) return;
    const { error } = await supabase.from('employee_roles').update({ name: editRoleName.trim() }).eq('id', id);
    if (!error) {
      setRoles(prev => prev.map(r => r.id === id ? { ...r, name: editRoleName.trim() } : r).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingRoleId(null);
    } else {
      alert('Erro ao atualizar: ' + error.message);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cargo? Todos os funcionários com este cargo ficarão sem cargo atribuído.')) return;
    const { error } = await supabase.from('employee_roles').delete().eq('id', id);
    if (!error) {
      setRoles(prev => prev.filter(r => r.id !== id));
      fetchData(); // reload profiles to update UI
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const handleSaveProfileName = async (id: string) => {
    if (!editProfileName.trim()) return;
    await handleUpdateProfile(id, { full_name: editProfileName.trim() });
    setEditingProfileId(null);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingEmployee(true);
    setEmployeeError('');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Create a temporary client that does not persist session to avoid logging out the admin
    const tempClient = createSupabaseJSClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await tempClient.auth.signUp({
      email: employeeForm.email,
      password: employeeForm.password,
    });

    if (authError) {
      setEmployeeError(authError.message);
      setCreatingEmployee(false);
      return;
    }

    if (authData.user) {
      // Atualiza o profile criado automaticamente via trigger
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: employeeForm.name,
          role: employeeForm.role,
          job_role_id: employeeForm.job_role_id || null,
          force_password_change: true
        })
        .eq('id', authData.user.id);

      if (profileError) {
        setEmployeeError('Usuário criado, mas erro ao atualizar perfil: ' + profileError.message);
      } else {
        setShowEmployeeModal(false);
        setEmployeeForm({ name: '', email: '', password: '', role: 'employee', job_role_id: '' });
        fetchData(); // Recarrega a lista
      }
    }
    setCreatingEmployee(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#D9CFC1] shadow-sm">
        <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
        <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Roles Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#D9CFC1]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><Shield size={20} /></div>
          <div>
            <h3 className="font-bold text-lg">Cargos e Setores</h3>
            <p className="text-xs text-[#4A3728]/60 mt-1">Gerencie os cargos operacionais (ex: Garçom, Cozinheiro).</p>
          </div>
        </div>

        <form onSubmit={handleCreateRole} className="flex gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Nome do novo cargo..." 
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            className="flex-1 bg-[#F5F2ED] border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#4A3728] outline-none"
          />
          <button 
            type="submit"
            disabled={creatingRole || !newRoleName.trim()}
            className="bg-[#4A3728] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#3d2d21] disabled:opacity-50 flex items-center gap-2"
          >
            {creatingRole ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {roles.map(r => {
            if (editingRoleId === r.id) {
              return (
                <div key={r.id} className="flex items-center gap-2 bg-[#EBE3D5] px-2 py-1 rounded-xl border border-[#4A3728]">
                  <input 
                    type="text" 
                    value={editRoleName}
                    onChange={e => setEditRoleName(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm font-bold text-[#4A3728] w-32 px-2"
                    autoFocus
                  />
                  <button onClick={() => handleUpdateRole(r.id)} className="p-1.5 text-green-700 hover:bg-green-100 rounded-lg"><Save size={14} /></button>
                  <button onClick={() => setEditingRoleId(null)} className="p-1.5 text-red-700 hover:bg-red-100 rounded-lg"><X size={14} /></button>
                </div>
              );
            }
            return (
              <div key={r.id} className="group flex items-center gap-1 bg-[#EBE3D5] text-[#4A3728] pl-4 pr-2 py-1.5 rounded-xl text-sm font-bold border border-[#D9CFC1]">
                <span>{r.name}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 gap-1">
                  <button onClick={() => { setEditingRoleId(r.id); setEditRoleName(r.name); }} className="p-1 hover:bg-[#D9CFC1] rounded-lg text-[#4A3728]" title="Editar"><Pencil size={12} /></button>
                  <button onClick={() => handleDeleteRole(r.id)} className="p-1 hover:bg-red-200 rounded-lg text-red-600" title="Apagar"><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
          {roles.length === 0 && <span className="text-sm text-[#4A3728]/50 italic">Nenhum cargo cadastrado.</span>}
        </div>
      </div>

      {/* Employees Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#D9CFC1] overflow-hidden">
        <div className="p-6 border-b border-[#D9CFC1]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><Users size={20} /></div>
            <div>
              <h3 className="font-bold text-lg">Equipe</h3>
              <p className="text-xs text-[#4A3728]/60 mt-1">Defina o Nível de Acesso e o Cargo de cada membro.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowEmployeeModal(true)}
            className="bg-[#4A3728] text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#3d2d21] transition-colors flex items-center gap-2"
          >
            <UserPlus size={16} /> Adicionar Membro
          </button>
        </div>

        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[#F5F2ED] text-[#4A3728]">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Nome / E-mail</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Nível de Acesso</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Cargo Operacional</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9CFC1]/40">
            {profiles.map(profile => (
              <tr key={profile.id} className="hover:bg-[#FDFBF7] transition-colors">
                <td className="px-6 py-4">
                  {editingProfileId === profile.id ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input 
                        type="text" 
                        value={editProfileName}
                        onChange={e => setEditProfileName(e.target.value)}
                        className="bg-white border border-[#4A3728] rounded-md px-2 py-1 text-sm font-bold text-[#4A3728] outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSaveProfileName(profile.id)} className="text-green-600 hover:text-green-800"><Save size={16} /></button>
                      <button onClick={() => setEditingProfileId(null)} className="text-red-600 hover:text-red-800"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="font-bold text-sm flex items-center gap-2 group">
                      {profile.full_name || 'Usuário Sem Nome'}
                      <button 
                        onClick={() => { setEditingProfileId(profile.id); setEditProfileName(profile.full_name || ''); }} 
                        className="opacity-0 group-hover:opacity-100 text-[#4A3728]/50 hover:text-[#4A3728] transition-opacity"
                        title="Editar nome"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  <div className="text-[11px] text-[#4A3728]/50 mt-1">{profile.email || 'Sem e-mail'}</div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={profile.role || ''}
                    onChange={(e) => handleUpdateProfile(profile.id, { role: e.target.value || null })}
                    disabled={updating === profile.id}
                    className="bg-white border border-[#D9CFC1] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A3728] outline-none disabled:opacity-50"
                  >
                    <option value="">(Sem acesso)</option>
                    <option value="admin">Administrador</option>
                    <option value="receptionist">Recepcionista</option>
                    <option value="employee">Funcionário Operacional</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={profile.job_role_id || ''}
                    onChange={(e) => handleUpdateProfile(profile.id, { job_role_id: e.target.value || null })}
                    disabled={updating === profile.id || profile.role !== 'employee'}
                    className="bg-white border border-[#D9CFC1] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A3728] outline-none disabled:opacity-50"
                  >
                    <option value="">(Nenhum cargo)</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {updating === profile.id && <Loader2 size={14} className="inline-block ml-2 animate-spin text-[#4A3728]/50" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length === 0 && (
          <div className="p-6 text-center text-[#4A3728]/50 text-sm">Nenhum perfil encontrado.</div>
        )}
      </div>

      {/* Modal Adicionar Funcionário */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold uppercase tracking-widest text-[#4A3728]">Novo Membro</h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-[#4A3728]/50 hover:text-[#4A3728]">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nome Completo</label>
                <input required type="text" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">E-mail</label>
                <input required type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Senha (mínimo 6 caracteres)</label>
                <input required minLength={6} type="password" value={employeeForm.password} onChange={e => setEmployeeForm({...employeeForm, password: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nível de Acesso</label>
                  <select value={employeeForm.role} onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 outline-none">
                    <option value="employee">Funcionário (Checklist)</option>
                    <option value="admin">Administrador (Painel)</option>
                    <option value="receptionist">Recepcionista</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Cargo Operacional</label>
                  <select disabled={employeeForm.role !== 'employee'} value={employeeForm.job_role_id} onChange={e => setEmployeeForm({...employeeForm, job_role_id: e.target.value})} className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 outline-none disabled:opacity-50">
                    <option value="">Nenhum cargo</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {employeeError && <p className="text-red-500 text-xs font-bold mt-2">{employeeError}</p>}

              <button disabled={creatingEmployee} type="submit" className="w-full mt-6 bg-[#4A3728] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#3d2d21] disabled:opacity-50 flex justify-center items-center gap-2">
                {creatingEmployee ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Cadastrar Membro
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
