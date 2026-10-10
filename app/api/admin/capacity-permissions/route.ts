import { NextResponse } from 'next/server';
import { isReservationOwner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  if (!(await isReservationOwner())) return NextResponse.json({ error: 'Somente o dono pode gerenciar permissões.' }, { status: 403 });
  const supabase = createAdminClient();
  const [profiles, permissions, audits] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,role').in('role', ['admin', 'dono', 'gerente', 'receptionist', 'portaria']).order('full_name'),
    supabase.from('reservation_capacity_permissions').select('profile_id,granted_by,granted_at,revoked_by,revoked_at'),
    supabase.from('reservation_capacity_permission_audits').select('id,profile_id,actor_id,action,reason,created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  if (profiles.error || permissions.error || audits.error) return NextResponse.json({ error: 'Não foi possível carregar as permissões.' }, { status: 500 });
  return NextResponse.json({ profiles: profiles.data || [], permissions: permissions.data || [], audits: audits.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await isReservationOwner())) return NextResponse.json({ error: 'Somente o dono pode gerenciar permissões.' }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.profileId !== 'string' || typeof body.granted !== 'boolean' || typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'Dados de permissão inválidos.' }, { status: 400 });
    }
    const { data, error } = await (await createClient()).rpc('set_reservation_capacity_permission', {
      p_profile_id: body.profileId,
      p_granted: body.granted,
      p_reason: body.reason,
    });
    if (error || !data?.[0]) {
      if (error?.message.includes('CAPACITY_PERMISSION_SELF_ASSIGNMENT_FORBIDDEN')) return NextResponse.json({ error: 'Não é possível atribuir a permissão à própria conta.' }, { status: 409 });
      return NextResponse.json({ error: 'Não foi possível atualizar a permissão.' }, { status: 400 });
    }
    return NextResponse.json({ permission: data[0] });
  } catch {
    return NextResponse.json({ error: 'Não foi possível atualizar a permissão.' }, { status: 400 });
  }
}
