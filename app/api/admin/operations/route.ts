import { NextResponse } from 'next/server';
import { isPanelStaff } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const date = new URL(request.url).searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
  const supabase = createAdminClient();
  const [reservations, assignments, tables, waitlist] = await Promise.all([
    supabase.from('reservations').select('id,name,whatsapp,email,num_guests,reservation_time,status,payment_status,payment_amount,notes,source,arrived_at,seated_at,completed_at').eq('reservation_date', date).order('reservation_time'),
    supabase.from('reservation_table_assignments').select('reservation_id,table_id,starts_at,ends_at,released_at,restaurant_tables(code,area_id,restaurant_areas(name))').is('released_at', null),
    supabase.from('restaurant_tables').select('id,code,max_capacity,active,restaurant_areas(name)').eq('active', true),
    supabase.from('waitlist_entries').select('id,name,phone,party_size,status,created_at,preferred_area_id').in('status', ['waiting','called']).order('created_at'),
  ]);
  if (reservations.error || assignments.error || tables.error || waitlist.error) return NextResponse.json({ error: 'Não foi possível carregar a operação.' }, { status: 500 });
  return NextResponse.json({ date, reservations: reservations.data || [], assignments: assignments.data || [], tables: tables.data || [], waitlist: waitlist.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json();
  if (body.action === 'cancel_waitlist' && typeof body.id === 'string') {
    const { error } = await createAdminClient().from('waitlist_entries').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', body.id).in('status', ['waiting', 'called']);
    return error ? NextResponse.json({ error: 'Não foi possível cancelar a fila.' }, { status: 400 }) : NextResponse.json({ success: true });
  }
  if (body.action === 'walk_in' && typeof body.name === 'string' && typeof body.phone === 'string' && Number.isInteger(body.partySize) && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') && /^\d{2}:\d{2}$/.test(body.time || '')) {
    const supabase = createAdminClient();
    const { data: reservation, error } = await supabase.from('reservations').insert({ name: body.name.trim(), email: typeof body.email === 'string' && body.email.includes('@') ? body.email : 'walkin@local.invalid', whatsapp: body.phone, num_guests: body.partySize, reservation_date: body.date, reservation_time: body.time, status: 'confirmed', source: 'walk_in', notes: typeof body.notes === 'string' ? body.notes.trim() || null : null, arrived_at: new Date().toISOString() }).select('id').single();
    if (error || !reservation) return NextResponse.json({ error: 'Não foi possível criar o walk-in.' }, { status: 400 });
    if (Array.isArray(body.tableIds) && body.tableIds.every((id: unknown) => typeof id === 'string') && body.tableIds.length) {
      const { error: assignmentError } = await supabase.rpc('replace_reservation_table_assignments', { p_reservation_id: reservation.id, p_table_ids: body.tableIds, p_assigned_by: null });
      if (assignmentError) return NextResponse.json({ id: reservation.id, error: 'Walk-in criado, mas requer alocação manual.' }, { status: 202 });
    }
    if (typeof body.waitlistId === 'string') await supabase.from('waitlist_entries').update({ status: 'seated', seated_at: new Date().toISOString(), reservation_id: reservation.id }).eq('id', body.waitlistId);
    return NextResponse.json({ id: reservation.id }, { status: 201 });
  }
  if (body.action !== 'waitlist' || typeof body.name !== 'string' || typeof body.phone !== 'string' || !Number.isInteger(body.partySize)) return NextResponse.json({ error: 'Dados da fila inválidos.' }, { status: 400 });
  const { data, error } = await createAdminClient().from('waitlist_entries').insert({ name: body.name.trim(), phone: body.phone, party_size: body.partySize, preferred_area_id: typeof body.preferredAreaId === 'string' ? body.preferredAreaId : null, notes: typeof body.notes === 'string' ? body.notes.trim() || null : null }).select('id').single();
  if (error) return NextResponse.json({ error: 'Não foi possível adicionar à fila.' }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
