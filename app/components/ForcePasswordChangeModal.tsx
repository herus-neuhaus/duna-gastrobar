'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ForcePasswordChangeModalProps {
  userId: string;
  onSuccess: () => void;
}

export default function ForcePasswordChangeModal({ userId, onSuccess }: ForcePasswordChangeModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    // Update auth password
    const { error: authError } = await supabase.auth.updateUser({
      password: password
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ force_password_change: false })
      .eq('id', userId);

    if (profileError) {
      setError(profileError.message);
    } else {
      onSuccess();
    }
    
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#4A3728]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#FDFBF7] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#4A3728] rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-serif font-bold uppercase tracking-widest text-[#4A3728]">Mudar Senha</h2>
          <p className="text-sm text-[#4A3728]/70 mt-2">
            Este é o seu primeiro acesso. Por segurança, você precisa criar uma nova senha pessoal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Nova Senha</label>
            <input 
              required 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Confirmar Nova Senha</label>
            <input 
              required 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full px-4 py-3 bg-white rounded-xl text-sm border border-[#D9CFC1] focus:ring-1 focus:ring-[#4A3728] outline-none" 
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}

          <button 
            disabled={loading} 
            type="submit" 
            className="w-full mt-6 bg-[#4A3728] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#3d2d21] disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
