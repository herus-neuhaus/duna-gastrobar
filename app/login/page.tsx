'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push('/admin');
        router.refresh();
      }
    } catch (err) {
      setError('Ocorreu um erro ao tentar fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EBE3D5] flex items-center justify-center p-4 font-sans text-[#4A3728]">
      <div className="w-full max-w-[400px] bg-[#FDFBF7] rounded-[32px] shadow-2xl overflow-hidden border border-[#D9CFC1] p-8">
        <div className="text-center mb-8">
          <div className="bg-[#4A3728] text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-wide uppercase">Acesso Restrito</h1>
          <p className="text-xs opacity-60 uppercase tracking-widest mt-1">Duna Gastrobar Admin</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A3728]/40" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#D9CFC1] rounded-2xl text-sm focus:outline-none focus:border-[#4A3728] focus:ring-1 focus:ring-[#4A3728] transition-all"
                placeholder="exemplo@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-70">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A3728]/40" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#D9CFC1] rounded-2xl text-sm focus:outline-none focus:border-[#4A3728] focus:ring-1 focus:ring-[#4A3728] transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs animate-in fade-in zoom-in duration-200">
              <AlertCircle size={16} shrink-0 />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#4A3728] text-white rounded-2xl font-bold uppercase tracking-[2px] text-xs shadow-xl hover:bg-[#3d2d21] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Entrar no Painel
          </button>
        </form>

        <p className="text-center text-[9px] mt-8 opacity-40 uppercase tracking-widest">
          Sistema de Gestão Interna • Duna
        </p>
      </div>
    </div>
  );
}
