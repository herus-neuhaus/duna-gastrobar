import { createClient } from '@/lib/supabase/server';
import { CARGOS_ADMINISTRATIVOS, CARGOS_PAINEL } from '@/lib/permissoes';

export const ADMIN_ROLE = 'admin';
export const EMPLOYEE_ROLE = 'employee';
export const RECEPTIONIST_ROLE = 'receptionist';
export const OWNER_ROLE = 'dono';

export async function isAdmin() {
  return hasRole(CARGOS_ADMINISTRATIVOS);
}

export async function isPanelStaff() {
  return hasRole(CARGOS_PAINEL);
}

export async function isReservationOwner() {
  // Compatibilidade com handlers antigos: ações antes exclusivas do dono agora
  // pertencem ao nível Administrador, também validado pelas RPCs no banco.
  return hasRole(CARGOS_ADMINISTRATIVOS);
}

export async function isFinanceStaff() {
  return hasRole(CARGOS_ADMINISTRATIVOS);
}

export async function canOverrideReservationCapacity() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('can_override_reservation_capacity');
  return !error && data === true;
}

export async function isReservationAdminOrOwner() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_reservation_admin_or_owner');
  return !error && data === true;
}

async function hasRole(allowedRoles: readonly string[]) {
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
