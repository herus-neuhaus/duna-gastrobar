import { describe, expect, it } from 'vitest';
import { getProtectedRouteRedirect } from '@/lib/route-access';

describe('protected route access', () => {
  it('blocks anonymous and unknown roles from admin routes', () => {
    expect(getProtectedRouteRedirect('/admin', null)).toBe('/login');
    expect(getProtectedRouteRedirect('/admin', 'unknown')).toBe('/login');
  });

  it('allows employees into operation and their checklist, but not configuration', () => {
    expect(getProtectedRouteRedirect('/admin?view=reservations', 'employee')).toBeNull();
    expect(getProtectedRouteRedirect('/admin', 'employee')).toBe('/admin?view=operations');
    expect(getProtectedRouteRedirect('/admin', 'employee', 'estabelecimento')).toBe('/admin?view=operations');
    expect(getProtectedRouteRedirect('/funcionario/checklist', 'employee')).toBeNull();
  });

  it('allows only panel roles into admin routes', () => {
    expect(getProtectedRouteRedirect('/admin', 'admin')).toBeNull();
    expect(getProtectedRouteRedirect('/admin', 'receptionist')).toBe('/admin?view=operations');
    expect(getProtectedRouteRedirect('/funcionario/checklist', 'admin')).toBeNull();
  });
  it('sends each level to the right initial page after login', () => {
    expect(getProtectedRouteRedirect('/login', 'admin')).toBe('/admin');
    expect(getProtectedRouteRedirect('/login', 'gerente')).toBe('/admin?view=operations');
    expect(getProtectedRouteRedirect('/admin', 'admin', 'estabelecimento')).toBeNull();
  });
});
