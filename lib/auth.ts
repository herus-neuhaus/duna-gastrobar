import { createClient } from '@/lib/supabase/server';

export const ADMIN_ROLE = 'admin';
export const EMPLOYEE_ROLE = 'employee';
export const RECEPTIONIST_ROLE = 'receptionist';

export async function isAdmin() {
  return hasRole([ADMIN_ROLE]);
}

export async function isPanelStaff() {
  return hasRole([ADMIN_ROLE, 'dono', 'gerente', RECEPTIONIST_ROLE, 'portaria']);
}

async function hasRole(allowedRoles: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, force_password_change')
    .eq('id', user.id)
    .maybeSingle();

  return Boolean(profile && allowedRoles.includes(profile.role || '') && !profile.force_password_change);
}
