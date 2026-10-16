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
  CalendarOff,
  CalendarPlus,
  ImagePlus,
  TableProperties,
  BadgeDollarSign,
  ChevronDown,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ForcePasswordChangeModal from '@/app/components/ForcePasswordChangeModal';
import { Button } from '@/components/ui/button';
import { ehEquipeOperacional, podeAcessarVisao } from '@/lib/permissoes';
import { ContextoAcesso } from '@/app/components/ContextoAcesso';

const navigationGroups = [
  {
    label: 'Operação',
    items: [
      { key: 'reservations', label: 'Reservas', href: '/admin?view=reservations', icon: CalendarIcon },
      { key: 'operations', label: 'Operação do dia', href: '/admin?view=operations', icon: CalendarDays },
      { key: 'restaurant', label: 'Áreas e mesas', href: '/admin?view=restaurant', icon: TableProperties },
      { key: 'new_reservation', label: 'Criar reserva', href: '/admin?view=new_reservation', icon: CalendarPlus },
      { key: 'checklist', label: 'Meu checklist', href: '/funcionario/checklist', icon: CalendarDays },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { key: 'estabelecimento', label: 'Estabelecimento', href: '/admin?view=estabelecimento', icon: Settings },
      { key: 'decorations', label: 'Espaços e decorações', href: '/admin?view=decorations', icon: ImagePlus },
      { key: 'special_dates', label: 'Datas especiais', href: '/admin?view=special_dates', icon: CalendarDays },
      { key: 'blocked_dates', label: 'Bloqueios', href: '/admin?view=blocked_dates', icon: CalendarOff },
    ],
  },
  {
    label: 'Equipe',
    items: [
      { key: 'funcionarios', label: 'Equipe e acessos', href: '/admin?view=funcionarios', icon: Users },
      { key: 'tarefas', label: 'Tarefas', href: '/admin?view=tarefas', icon: CalendarIcon },
      { key: 'produtividade', label: 'Produtividade', href: '/admin?view=produtividade', icon: CalendarDays },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { key: 'finance', label: 'Financeiro', href: '/admin?view=finance', icon: BadgeDollarSign },
    ],
  },
] satisfies { label: string; items: { key: string; label: string; href: string; icon: LucideIcon }[] }[];

export default function AdminLayoutShell({ children, activeItem }: { children: React.ReactNode, activeItem: string }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(
    navigationGroups.map((group) => [group.label, group.items.some((item) => item.key === activeItem)]),
  ));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [authError, setAuthError] = useState('');
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const checkAuth = async () => {
      setAuthError('');
      setIsAuthorized(false);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) {
          router.push('/login');
          return;
        }

        setUserEmail(user.email || null);
        setUserId(user.id);
      
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('force_password_change,role')
          .eq('id', user.id)
          .single();
        if (profileError) throw profileError;
        setUserRole(profile.role);

        if (!ehEquipeOperacional(profile.role)) {
          router.replace('/login');
          return;
        }

        if (!podeAcessarVisao(profile.role, activeItem)) {
          router.replace('/admin?view=operations');
          return;
        }
        
        if (profile?.force_password_change) {
          setForcePasswordChange(true);
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Falha ao verificar autenticação do painel:', error);
        setAuthError('Não foi possível validar sua sessão. Tente novamente.');
      }
    };
    checkAuth();
  }, [activeItem, supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isAuthorized || !podeAcessarVisao(userRole, activeItem)) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#4A3728]">
        <div className="flex flex-col items-center gap-4">
          {!authError && <Loader2 className="w-12 h-12 text-[#4A3728] animate-spin" />}
          {authError ? <>
            <p role="alert" className="text-center text-sm">{authError}</p>
            <Button type="button" onClick={() => window.location.reload()}>Tentar novamente</Button>
          </> : <p className="text-xs uppercase tracking-[0.2em] font-serif font-bold">Autenticando...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#4A3728] flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      {forcePasswordChange && userId && (
        <ForcePasswordChangeModal 
          onSuccess={() => setForcePasswordChange(false)} 
        />
      )}
      {/* Top Navbar Mobile */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#4A3728] text-white flex items-center justify-between px-6 z-40 lg:hidden shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            aria-controls="admin-sidebar"
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <Link href="/admin?view=reservations" onClick={() => setIsMenuOpen(false)} className="text-lg font-serif font-bold tracking-widest uppercase">DUNA</Link>
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
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* Sidebar (drawer on mobile, static on desktop) */}
      <aside id="admin-sidebar" className={`admin-sidebar fixed lg:sticky lg:top-0 top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-[#4A3728] text-white border-r border-[#3d2d21] flex flex-col shrink-0 z-50 overflow-y-auto transform lg:h-screen lg:min-h-0 lg:transform-none transition-transform duration-300 ease-in-out ${
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

        <nav aria-label="Navegação do painel" className="flex-1 space-y-6 px-4">
          {navigationGroups.map((group) => {
            const items = group.items.filter((item) => podeAcessarVisao(userRole, item.key));
            if (items.length === 0) return null;
            const isExpanded = expandedGroups[group.label] ?? false;
            const groupId = `admin-nav-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
            return <section key={group.label} aria-label={group.label}>
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={groupId}
                onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !isExpanded }))}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                {group.label}
                <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && <div id={groupId} className="tuc-menu mt-1 space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.key;
                  return <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => {
                      setIsMenuOpen(false);
                      setExpandedGroups((current) => ({ ...current, [group.label]: true }));
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`tuc-menu__item w-full text-xs font-semibold ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="tuc-menu__icon"><Icon size={18} aria-hidden="true" /></span>{item.label}
                  </Link>;
                })}
              </div>}
            </section>;
          })}
        </nav>

        <div className="p-6 border-t border-white/10">
          <Button
            type="button"
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start rounded-2xl px-6 uppercase tracking-widest text-red-200 hover:bg-red-500/20 hover:text-red-100"
          >
            <LogOut size={18} /> Sair do Painel
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex min-h-screen flex-col overflow-x-hidden overflow-y-auto pt-16 lg:h-screen lg:min-h-0 lg:pt-0 bg-[#FDFBF7]">
        <ContextoAcesso.Provider value={userRole}>{children}</ContextoAcesso.Provider>
      </main>
    </div>
  );
}
