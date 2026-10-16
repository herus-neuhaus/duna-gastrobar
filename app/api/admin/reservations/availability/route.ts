import { NextResponse } from 'next/server';
import { isPanelStaff } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const date = new URL(request.url).searchParams.get('date') || '';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_reservation_capacity_availability', { p_from: date, p_to: date });
  if (error) return NextResponse.json({ error: 'Não foi possível consultar a agenda.' }, { status: 503 });
  return NextResponse.json({ horarios: (data || []).map((slot) => slot.reservation_time.slice(0, 5)) }, { headers: { 'Cache-Control': 'no-store' } });
}
