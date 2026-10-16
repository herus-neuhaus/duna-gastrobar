import { ehAdministrador, ehEquipeOperacional, podeAcessarVisao } from '@/lib/permissoes';

export function getProtectedRouteRedirect(pathname: string, role: string | null, selectedView?: string | null) {
  if (pathname.startsWith('/admin')) {
    if (!ehEquipeOperacional(role)) return '/login';
    const view = selectedView ?? new URL(pathname, 'http://localhost').searchParams.get('view');
    if (!ehAdministrador(role) && (!view || !podeAcessarVisao(role, view))) return '/admin?view=operations';
    return null;
  }

  if (pathname.startsWith('/funcionario')) {
    return ehEquipeOperacional(role) ? null : '/login';
  }

  if (pathname.startsWith('/login')) {
    if (ehAdministrador(role)) return '/admin';
    if (ehEquipeOperacional(role)) return '/admin?view=operations';
  }

  return null;
}
