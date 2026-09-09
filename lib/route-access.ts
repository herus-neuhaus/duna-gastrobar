const PANEL_ROLES = new Set(['admin', 'receptionist']);

export function getProtectedRouteRedirect(pathname: string, role: string | null) {
  if (pathname.startsWith('/admin')) {
    if (PANEL_ROLES.has(role || '')) return null;
    return role === 'employee' ? '/funcionario/checklist' : '/login';
  }

  if (pathname.startsWith('/funcionario')) {
    if (role === 'employee') return null;
    return PANEL_ROLES.has(role || '') ? '/admin' : '/login';
  }

  if (pathname.startsWith('/login')) {
    if (role === 'employee') return '/funcionario/checklist';
    if (PANEL_ROLES.has(role || '')) return '/admin';
  }

  return null;
}
