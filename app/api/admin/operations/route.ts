import { NextResponse } from 'next/server';
import { isPanelStaff, isReservationOwner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function walkInErrorMessage(message: string) {
  if (message.includes('WALK_IN_DATE_REQUIRED')) return 'Walk-ins só podem ser registrados para hoje.';
  if (message.includes('INVALID_WALK_IN')) return 'Confira o nome, telefone e quantidade de pessoas.';
  if (message.includes('RESERVATION_TIME_UNAVAILABLE')) return 'Esse horário não está disponível na agenda.';
  if (message.includes('CAPACITY_EXCEEDED')) return 'A capacidade deste turno foi atingida.';
  if (message.includes('RESERVATION_TURN_CLASSIFICATION_REQUIRED')) return 'Há reservas antigas sem turno classificado; peça ao dono para revisar.';
  if (message.includes('RESERVATION_STAFF_REQUIRED')) return 'Sua conta não tem autorização para registrar walk-ins.';
  return 'Não foi possível criar o walk-in.';
}

function operationsLoadFailure(errors: Array<{ code?: string; message?: string } | null | undefined>) {
  const failures = errors.filter((error): error is { code?: string; message?: string } => Boolean(error));
  console.error('Falha ao carregar operação do dia:', failures.map(({ code, message }) => ({ code, message })));

  const missingDatabaseObjects = failures.some((error) =>
    ['42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error.code || ''),
  );
  return NextResponse.json({
    error: missingDatabaseObjects
      ? 'O banco Supabase ainda não tem todas as migrações da Operação do dia. Peça ao responsável para revisar e aplicar as migrações pendentes.'
      : 'Não foi possível carregar a operação. Tente novamente; se persistir, consulte os logs do servidor.',
  }, { status: missingDatabaseObjects ? 503 : 500 });
}

export async function GET(request: Request) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const date = new URL(request.url).searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
  if (!isValidDate(date)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  const supabase = createAdminClient();
  const [reservations, tables, areas, waitlist, capacity, classificationIssues] = await Promise.all([
    supabase.from('reservations').select('id,name,whatsapp,email,num_guests,reservation_time,commercial_turn,status,payment_status,payment_amount,notes,source,arrived_at,seated_at,completed_at').eq('reservation_date', date).order('reservation_time'),
    supabase.from('restaurant_tables').select('id,area_id,code,min_capacity,max_capacity,active,restaurant_areas(name,active)').eq('active', true),
    supabase.from('restaurant_areas').select('id,name').eq('active', true).order('display_order').order('name'),
    supabase.from('waitlist_entries').select('id,name,phone,party_size,status,created_at,preferred_area_id,notes').in('status', ['waiting','called']).order('created_at'),
    supabase.rpc('get_reservation_capacity_availability', { p_from: date, p_to: date }),
    supabase.from('reservation_turn_classification_issues').select('id,reservation_date,reservation_time,num_guests,status,source,commercial_turn,created_at').order('reservation_date').order('reservation_time'),
  ]);
  const initialErrors = [reservations.error, tables.error, areas.error, waitlist.error, capacity.error, classificationIssues.error];
  if (initialErrors.some(Boolean)) return operationsLoadFailure(initialErrors);

  const reservationIds = (reservations.data || []).map((reservation) => reservation.id);
  const assignments = reservationIds.length
    ? await supabase.from('reservation_table_assignments')
      .select('reservation_id,table_id,starts_at,ends_at,released_at,restaurant_tables(code,area_id,restaurant_areas(name))')
      .in('reservation_id', reservationIds)
      .is('released_at', null)
    : { data: [], error: null };
  if (assignments.error) return operationsLoadFailure([assignments.error]);

  return NextResponse.json({
    date,
    reservations: reservations.data || [],
    assignments: assignments.data || [],
    tables: tables.data || [],
    areas: areas.data || [],
    waitlist: waitlist.data || [],
    capacity: capacity.data || [],
    classificationIssues: classificationIssues.data || [],
    canClassifyHistoricalReservations: await isReservationOwner(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  if (body.action === 'classify_reservation_turn' && typeof body.reservationId === 'string' && typeof body.commercialTurn === 'string' && ['lunch', 'dinner'].includes(body.commercialTurn) && typeof body.reason === 'string') {
    if (!(await isReservationOwner())) return NextResponse.json({ error: 'Somente o dono pode classificar reservas históricas.' }, { status: 403 });
    const reason = body.reason.trim();
    if (reason.length < 3 || reason.length > 1000) return NextResponse.json({ error: 'Informe um motivo entre 3 e 1000 caracteres.' }, { status: 400 });
    const { data, error } = await (await createClient()).rpc('classify_reservation_commercial_turn', {
      p_reservation_id: body.reservationId,
      p_commercial_turn: body.commercialTurn,
      p_reason: reason,
    });
    if (error || !data?.[0]) return NextResponse.json({ error: error?.message.includes('INVALID_RESERVATION_COMMERCIAL_TURN') ? 'O turno escolhido não corresponde à agenda da reserva.' : 'Não foi possível classificar a reserva.' }, { status: 400 });
    return NextResponse.json({ reservation: data[0] });
  }
  if (['call_waitlist', 'return_waitlist', 'leave_waitlist', 'cancel_waitlist'].includes(String(body.action)) && typeof body.id === 'string') {
    const action = body.action;
    const status = action === 'call_waitlist' ? 'called' : action === 'leave_waitlist' ? 'left' : action === 'cancel_waitlist' ? 'cancelled' : 'waiting';
    const expectedStatuses = action === 'call_waitlist' ? ['waiting'] : action === 'return_waitlist' ? ['called'] : ['waiting', 'called'];
    const update = status === 'cancelled'
      ? { status, cancelled_at: new Date().toISOString() }
      : status === 'left'
        ? { status }
        : { status };
    const { data, error } = await createAdminClient().from('waitlist_entries')
      .update(update)
      .eq('id', body.id)
      .in('status', expectedStatuses)
      .select('id,status')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Não foi possível atualizar a fila.' }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Esta entrada da fila já foi atualizada.' }, { status: 409 });
    return NextResponse.json({ entry: data });
  }
  if (body.action === 'walk_in') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const time = typeof body.time === 'string' ? body.time : '';
    const partySize = body.partySize;
    if (name.length < 2 || name.length > 120 || !/^\d{10,13}$/.test(phone.replace(/\D/g, '')) || !Number.isInteger(partySize) || Number(partySize) < 1 || Number(partySize) > 30 || !isValidDate(date) || !isValidTime(time)) {
      return NextResponse.json({ error: 'Confira nome, telefone, quantidade, data e horário.' }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data, error } = await (await createClient()).rpc('create_walk_in_reservation', {
      p_name: name,
      p_email: typeof body.email === 'string' && body.email.includes('@') ? body.email : '',
      p_whatsapp: phone,
      p_reservation_date: date,
      p_reservation_time: time,
      p_num_guests: Number(partySize),
      p_notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    });
    const reservation = data?.[0];
    if (error || !reservation) return NextResponse.json({ error: walkInErrorMessage(error?.message || '') }, { status: 400 });
    if (Array.isArray(body.tableIds) && body.tableIds.every((id: unknown) => typeof id === 'string') && body.tableIds.length) {
      const { error: assignmentError } = await supabase.rpc('replace_reservation_table_assignments', { p_reservation_id: reservation.id, p_table_ids: body.tableIds });
      if (assignmentError) return NextResponse.json({ id: reservation.id, error: 'Walk-in criado, mas as mesas não foram alocadas. Use a timeline para concluir a alocação.' }, { status: 202 });
    }
    if (typeof body.waitlistId === 'string') {
      const { data: converted, error: conversionError } = await supabase.from('waitlist_entries')
        .update({ status: 'seated', seated_at: new Date().toISOString(), reservation_id: reservation.id })
        .eq('id', body.waitlistId)
        .in('status', ['waiting', 'called'])
        .select('id')
        .maybeSingle();
      if (conversionError || !converted) return NextResponse.json({ id: reservation.id, error: 'Walk-in criado, mas a fila não foi atualizada. Confira a reserva antes de tentar novamente.' }, { status: 202 });
    }
    return NextResponse.json({ id: reservation.id }, { status: 201 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const partySize = body.partySize;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (body.action !== 'waitlist' || name.length < 2 || name.length > 120 || !/^\d{10,13}$/.test(phone.replace(/\D/g, '')) || !Number.isInteger(partySize) || Number(partySize) < 1 || Number(partySize) > 30 || notes.length > 1000) return NextResponse.json({ error: 'Confira nome, telefone, quantidade e observações da fila.' }, { status: 400 });
  const { data, error } = await createAdminClient().from('waitlist_entries').insert({ name, phone, party_size: Number(partySize), preferred_area_id: typeof body.preferredAreaId === 'string' && body.preferredAreaId ? body.preferredAreaId : null, notes: notes || null }).select('id').single();
  if (error) return NextResponse.json({ error: 'Não foi possível adicionar à fila.' }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
