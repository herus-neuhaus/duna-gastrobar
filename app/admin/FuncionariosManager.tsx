'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, Users, Shield, UserPlus, X, Pencil, Trash2, Save } from 'lucide-react';
import { Database } from '@/lib/supabase/database.types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/form-controls';
import { ehAdministrador, ehEquipeOperacional } from '@/lib/permissoes';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Database['public']['Tables']['employee_roles']['Row'];
type CapacityPermissionProfile = { id: string; full_name: string | null; email: string | null; role: string | null };
type CapacityPermission = { profile_id: string; revoked_at: string | null };
type CapacityPermissionAudit = { id: string; profile_id: string; action: string; reason: string; created_at: string };

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
  const [capacityProfiles, setCapacityProfiles] = useState<CapacityPermissionProfile[]>([]);
  const [capacityPermissions, setCapacityPermissions] = useState<CapacityPermission[]>([]);
  const [capacityAudits, setCapacityAudits] = useState<CapacityPermissionAudit[]>([]);
  const [capacityTarget, setCapacityTarget] = useState('');
  const [capacityReason, setCapacityReason] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [capacityError, setCapacityError] = useState('');
  const [capacityBusy, setCapacityBusy] = useState(false);
  
  const [supabase] = useState(createClient);

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
    const timeout = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchData]);

  const fetchCapacityPermissions = React.useCallback(async () => {
    const response = await fetch('/api/admin/capacity-permissions', { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    setCapacityProfiles(result.profiles || []);
    setCapacityPermissions(result.permissions || []);
    setCapacityAudits(result.audits || []);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || ''));
      void fetchCapacityPermissions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchCapacityPermissions, supabase]);

  const updateCapacityPermission = async (granted: boolean, profileId: string) => {
    if (!capacityReason.trim()) {
      setCapacityError('Informe o motivo da concessão ou revogação.');
      return;
    }
    setCapacityBusy(true);
    setCapacityError('');
    try {
      const response = await fetch('/api/admin/capacity-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, granted, reason: capacityReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível alterar a permissão.');
      setCapacityReason('');
      setCapacityTarget('');
      await fetchCapacityPermissions();
    } catch (error) {
      setCapacityError(error instanceof Error ? error.message : 'Não foi possível alterar a permissão.');
    } finally {
      setCapacityBusy(false);
    }
  };

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

  const handleUpdateProfile = async (profileId: string, updates: { role?: string | null, job_role_id?: string | null, full_name?: string | null }) => {
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

    try {
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível cadastrar o membro.');

      setShowEmployeeModal(false);
      setEmployeeForm({ name: '', email: '', password: '', role: 'employee', job_role_id: '' });
      await fetchData();
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : 'Não foi possível cadastrar o membro.');
    } finally {
      setCreatingEmployee(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex flex-col items-center justify-center py-20 shadow-sm">
        <Loader2 className="animate-spin text-[#4A3728]/20 mb-4" size={40} />
        <p className="text-xs font-bold uppercase tracking-widest text-[#4A3728]/40">Carregando dados...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {capacityProfiles.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="font-bold text-lg text-amber-950">Permissão para exceder capacidade</h3>
          <p className="mt-1 text-xs text-amber-900/75">Administradores concedem ou revogam. Cada uso ainda exige ação explícita e motivo; isso não autoriza horário fora da agenda.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <Select value={capacityTarget} onChange={(event) => setCapacityTarget(event.target.value)} className="border-amber-200">
            <option value="">Selecione uma pessoa da equipe</option>
            {capacityProfiles.filter((profile) => profile.id !== currentUserId).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || profile.id} · {profile.role}</option>)}
          </Select>
          <Input value={capacityReason} onChange={(event) => setCapacityReason(event.target.value)} maxLength={1000} placeholder="Motivo obrigatório da alteração" className="border-amber-200" />
          <Button type="button" disabled={!capacityTarget || !capacityReason.trim() || capacityBusy} onClick={() => void updateCapacityPermission(true, capacityTarget)} className="uppercase">Conceder</Button>
        </div>
        {capacityError && <p className="mt-3 text-sm text-red-700">{capacityError}</p>}
        <div className="mt-5 space-y-2">
          {capacityProfiles.filter((profile) => profile.id !== currentUserId && capacityPermissions.some((permission) => permission.profile_id === profile.id && !permission.revoked_at)).map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm">
            <span>{profile.full_name || profile.email || profile.id} · {profile.role}</span>
            <Button type="button" variant="danger" size="sm" disabled={capacityBusy} onClick={() => { setCapacityTarget(profile.id); void updateCapacityPermission(false, profile.id); }}>Revogar</Button>
          </div>)}
        </div>
        {capacityAudits.length > 0 && <details className="mt-4 text-xs text-amber-950">
          <summary className="cursor-pointer font-bold">Histórico de concessões e revogações ({capacityAudits.length})</summary>
          <ul className="mt-2 space-y-1">{capacityAudits.map((audit) => <li key={audit.id}>{new Date(audit.created_at).toLocaleString('pt-BR')} · {audit.action} · {capacityProfiles.find((profile) => profile.id === audit.profile_id)?.full_name || audit.profile_id} · {audit.reason}</li>)}</ul>
        </details>}
      </section>}
      
      {/* Roles Section */}
      <Card className="p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><Shield size={20} /></div>
          <div>
            <h3 className="font-bold text-lg">Cargos e Setores</h3>
            <p className="text-xs text-[#4A3728]/60 mt-1">Gerencie os cargos operacionais (ex: Garçom, Cozinheiro).</p>
          </div>
        </div>

        <form onSubmit={handleCreateRole} className="flex gap-3 mb-6">
          <Input
            type="text" 
            placeholder="Nome do novo cargo..." 
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
          />
          <Button
            type="submit"
            disabled={creatingRole || !newRoleName.trim()}
            className="uppercase tracking-widest"
          >
            {creatingRole ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
          </Button>
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
      </Card>

      {/* Employees Section */}
      <Card className="overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#D9CFC1]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#F5F2ED] text-[#4A3728] rounded-2xl"><Users size={20} /></div>
            <div>
              <h3 className="font-bold text-lg">Equipe</h3>
              <p className="text-xs text-[#4A3728]/60 mt-1">Defina o Nível de Acesso e o Cargo de cada membro.</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setShowEmployeeModal(true)}
            className="uppercase tracking-widest"
          >
            <UserPlus size={16} /> Adicionar Membro
          </Button>
        </div>

        <div className="divide-y divide-[#D9CFC1]/40">
          {profiles.map(profile => (
            <div key={profile.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FDFBF7] transition-colors">
              <div className="flex-1 w-full md:w-auto">
                {editingProfileId === profile.id ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input 
                      type="text" 
                      value={editProfileName}
                      onChange={e => setEditProfileName(e.target.value)}
                      className="bg-white border border-[#4A3728] rounded-md px-2 py-1 text-sm font-bold text-[#4A3728] outline-none flex-1"
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
                      className="md:opacity-0 group-hover:opacity-100 text-[#4A3728]/50 hover:text-[#4A3728] transition-opacity"
                      title="Editar nome"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                <div className="text-[11px] text-[#4A3728]/50 mt-1">{profile.email || 'Sem e-mail'}</div>
              </div>
              
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                <div className="w-full md:w-auto">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/60 md:hidden mb-1 block">Nível de Acesso</label>
                  <Select
                    value={ehAdministrador(profile.role) ? 'admin' : ehEquipeOperacional(profile.role) ? 'employee' : profile.role || ''}
                    onChange={(e) => handleUpdateProfile(profile.id, { role: e.target.value || null })}
                    disabled={updating === profile.id || profile.id === currentUserId}
                    className="md:w-40"
                  >
                    <option value="">(Sem acesso)</option>
                    <option value="admin">Administrador</option>
                    <option value="employee">Funcionário (operação)</option>
                    {profile.role === 'customer' && <option value="customer">Cliente</option>}
                  </Select>
                </div>

                <div className="w-full md:w-auto flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#4A3728]/60 md:hidden mb-1 block">Cargo Operacional</label>
                    <Select
                      value={profile.job_role_id || ''}
                      onChange={(e) => handleUpdateProfile(profile.id, { job_role_id: e.target.value || null })}
                      disabled={updating === profile.id || profile.id === currentUserId || !ehEquipeOperacional(profile.role) || ehAdministrador(profile.role)}
                      className="md:w-40"
                    >
                      <option value="">(Nenhum cargo)</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                  </div>
                  {updating === profile.id && <Loader2 size={14} className="animate-spin text-[#4A3728]/50 mt-4 md:mt-0" />}
                </div>
              </div>
            </div>
          ))}
        </div>
        {profiles.length === 0 && (
          <EmptyState title="Nenhum perfil encontrado" description="Os membros da equipe aparecerão aqui." />
        )}
      </Card>

      {/* Modal Adicionar Funcionário */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md animate-in zoom-in-95 p-5 shadow-2xl duration-200 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold uppercase tracking-widest text-[#4A3728]">Novo Membro</h3>
              <Button type="button" onClick={() => setShowEmployeeModal(false)} variant="ghost" size="icon" aria-label="Fechar cadastro de membro">
                <X size={24} />
              </Button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nome Completo</label>
                <Input required type="text" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">E-mail</label>
                <Input required type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})} />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Senha (mínimo 12 caracteres)</label>
                <Input required minLength={12} type="password" value={employeeForm.password} onChange={e => setEmployeeForm({...employeeForm, password: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nível de Acesso</label>
                  <Select value={employeeForm.role} onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}>
                    <option value="employee">Funcionário (operação)</option>
                    <option value="admin">Administrador (Painel)</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Cargo Operacional</label>
                  <Select disabled={employeeForm.role !== 'employee'} value={employeeForm.job_role_id} onChange={e => setEmployeeForm({...employeeForm, job_role_id: e.target.value})}>
                    <option value="">Nenhum cargo</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </div>
              </div>

              {employeeError && <p className="text-red-500 text-xs font-bold mt-2">{employeeError}</p>}

              <Button disabled={creatingEmployee} type="submit" size="lg" className="mt-6 w-full uppercase tracking-widest">
                {creatingEmployee ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Cadastrar Membro
              </Button>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
