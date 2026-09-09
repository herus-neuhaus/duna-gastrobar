import { NextResponse } from 'next/server';
import { isPanelStaff } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function suggest(tables: Array<{ table_id: string; area_id: string; min_capacity: number; max_capacity: number; available: boolean }>, guests: number) {
  const candidates = tables.filter((table) => table.available);
  const combinations: Array<{ ids: string[]; capacity: number }> = [];
  for (const first of candidates) {
    combinations.push({ ids: [first.table_id], capacity: first.max_capacity });
    for (const second of candidates.filter((item) => item.area_id === first.area_id && item.table_id > first.table_id)) {
      combinations.push({ ids: [first.table_id, second.table_id], capacity: first.max_capacity + second.max_capacity });
    }
  }
  return combinations.filter((item) => item.capacity >= guests).sort((a, b) => a.capacity - b.capacity || a.ids.length - b.ids.length)[0]?.ids || [];
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const [{ data: reservation, error: reservationError }, { data: availability, error: availabilityError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase.from('reservations').select('id, num_guests, status').eq('id', id).maybeSingle(),
    supabase.rpc('get_reservation_table_availability', { p_reservation_id: id }),
    supabase.from('reservation_table_assignments').select('table_id, released_at').eq('reservation_id', id).is('released_at', null),
  ]);
  if (reservationError || availabilityError || assignmentsError || !reservation) return NextResponse.json({ error: 'Não foi possível consultar a alocação.' }, { status: 404 });
  return NextResponse.json({ reservation, tables: availability || [], assignedTableIds: (assignments || []).map((item) => item.table_id), suggestedTableIds: suggest(availability || [], reservation.num_guests) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const tableIds = Array.isArray(body.tableIds) && body.tableIds.every((item: unknown) => typeof item === 'string') ? body.tableIds as string[] : [];
  if (!tableIds.length) return NextResponse.json({ error: 'Selecione ao menos uma mesa.' }, { status: 400 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  const { data, error } = await createAdminClient().rpc('replace_reservation_table_assignments', { p_reservation_id: id, p_table_ids: tableIds, p_assigned_by: user?.id || null });
  if (error) return NextResponse.json({ error: error.message.includes('no_overlap') ? 'Uma das mesas acabou de ser ocupada.' : 'Não foi possível alocar as mesas.' }, { status: 409 });
  return NextResponse.json({ assignments: data || [] });
}
