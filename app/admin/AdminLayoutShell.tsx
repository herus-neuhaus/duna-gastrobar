'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Menu,
  X,
  LogOut,
  Loader2,
  CalendarDays,
  CalendarOff
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ForcePasswordChangeModal from '@/app/components/ForcePasswordChangeModal';

export default function AdminLayoutShell({ children, activeItem }: { children: React.ReactNode, activeItem: string }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || null);
      setUserId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('force_password_change')
        .eq('id', user.id)
        .single();
        
      if (profile?.force_password_change) {
        setForcePasswordChange(true);
      }

      setIsAuthorized(true);
    };
    checkAuth();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#4A3728]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#4A3728] animate-spin" />
          <p className="text-xs uppercase tracking-[0.2em] font-serif font-bold">Autenticando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728] flex flex-col lg:flex-row overflow-hidden">
      {forcePasswordChange && userId && (
        <ForcePasswordChangeModal 
          userId={userId} 
          onSuccess={() => setForcePasswordChange(false)} 
        />
      )}
      {/* Top Navbar Mobile */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#4A3728] text-white flex items-center justify-between px-6 z-40 lg:hidden shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span 
            onClick={() => router.push('/admin')}
            className="text-lg font-serif font-bold tracking-widest uppercase cursor-pointer"
          >
            DUNA
          </span>
        </div>
        
        {userEmail && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-[10px] font-bold text-white/70 truncate max-w-[120px]">{userEmail}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold uppercase">
              {userEmail.slice(0, 2)}
            </div>
          </div>
        )}
      </header>

      {/* Backdrop overlay for Mobile Drawer */}
      {isMenuOpen && (
        <div 
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* Sidebar (drawer on mobile, static on desktop) */}
      <aside className={`fixed lg:static top-0 bottom-0 left-0 w-72 bg-[#4A3728] text-white border-r border-[#3d2d21] flex flex-col shrink-0 z-50 overflow-y-auto transform lg:transform-none transition-transform duration-300 ease-in-out ${
        isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-8 flex items-center justify-between">
          <div>
            <h1 
              onClick={() => {
                router.push('/admin');
                setIsMenuOpen(false);
              }}
              className="text-2xl font-serif font-bold tracking-widest uppercase cursor-pointer hover:opacity-85 transition-opacity"
            >
              Duna
            </h1>
            <p className="text-[10px] font-bold tracking-[0.4em] text-white/50 uppercase mt-1">Management Panel</p>
          </div>

          <button 
            onClick={() => setIsMenuOpen(false)}
            className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link 
            href="/admin?view=reservations"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'reservations' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <CalendarIcon size={18} /> Reservas
          </Link>
          
          <Link 
            href="/admin?view=special_dates"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'special_dates' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <CalendarDays size={18} /> Datas Especiais
          </Link>

          <Link 
            href="/admin?view=blocked_dates"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'blocked_dates' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <CalendarOff size={18} /> Bloqueios
          </Link>

          <Link 
            href="/admin?view=funcionarios"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'funcionarios' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <Users size={18} /> Equipe
          </Link>

          <Link 
            href="/admin?view=tarefas"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'tarefas' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <CalendarIcon size={18} /> Tarefas
          </Link>

          <Link 
            href="/admin?view=produtividade"
            onClick={() => setIsMenuOpen(false)}
            className={`w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${activeItem === 'produtividade' ? 'bg-white text-[#4A3728] shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <CalendarDays size={18} /> Produtividade
          </Link>
        </nav>

        <div className="p-6 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full min-h-[44px] flex items-center gap-4 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs text-red-300 hover:text-red-100 hover:bg-red-500/20 transition-all"
          >
            <LogOut size={18} /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden pt-16 lg:pt-0 bg-[#FDFBF7]">
        {children}
      </main>
    </div>
  );
}
