import { describe, expect, it } from 'vitest';
import { getProtectedRouteRedirect } from '@/lib/route-access';

describe('protected route access', () => {
  it('blocks anonymous and unknown roles from admin routes', () => {
    expect(getProtectedRouteRedirect('/admin', null)).toBe('/login');
    expect(getProtectedRouteRedirect('/admin', 'unknown')).toBe('/login');
  });

  it('routes employees away from the admin panel', () => {
    expect(getProtectedRouteRedirect('/admin?view=reservations', 'employee')).toBe('/funcionario/checklist');
    expect(getProtectedRouteRedirect('/funcionario/checklist', 'employee')).toBeNull();
  });

  it('allows only panel roles into admin routes', () => {
    expect(getProtectedRouteRedirect('/admin', 'admin')).toBeNull();
    expect(getProtectedRouteRedirect('/admin', 'receptionist')).toBeNull();
    expect(getProtectedRouteRedirect('/funcionario/checklist', 'admin')).toBe('/admin');
  });
});
