import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidCpf } from '@/lib/pagarme';

export const runtime = 'nodejs';

const CAPACITY_LIMIT = 80;

function getAvailableTimes(dayOfWeek: number) {
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    return ['12:00', '12:30', '13:00', '13:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
  }

  if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
    return ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const time = typeof body.time === 'string' ? body.time : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';
    const specialDateId = typeof body.specialDateId === 'string' ? body.specialDateId : null;
    const requestedGuests = Number(body.guests);

    if (
      name.length < 2 || name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{10,11}$/.test(whatsapp.replace(/\D/g, '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isInteger(requestedGuests) || requestedGuests < 1 || requestedGuests > 30
    ) {
      return NextResponse.json({ error: 'Dados da reserva inválidos.' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    const todayString = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
    const [todayYear, todayMonth, todayDay] = todayString.split('-').map(Number);
    const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
    const lastAvailableDate = new Date(today);
    lastAvailableDate.setUTCDate(lastAvailableDate.getUTCDate() + 44);
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day ||
      calendarDate < today ||
      calendarDate > lastAvailableDate ||
      !getAvailableTimes(calendarDate.getUTCDay()).includes(time)
    ) {
      return NextResponse.json({ error: 'Data ou horário indisponível.' }, { status: 400 });
    }

    const reservationDateTime = new Date(`${date}T${time}:00-04:00`);
    if (reservationDateTime.getTime() - Date.now() < 8 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'A reserva precisa ser feita com pelo menos 8 horas de antecedência.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: blockedDate } = await supabase
      .from('blocked_dates')
      .select('id')
      .eq('date', date)
      .maybeSingle();

    if (blockedDate) {
      return NextResponse.json({ error: 'As reservas estão bloqueadas para esta data.' }, { status: 409 });
    }

    let guests = requestedGuests;
    let specialDate = null;
    if (specialDateId) {
      const { data, error } = await supabase
        .from('special_dates')
        .select('id, date, included_guests, requires_fee, fee_amount')
        .eq('id', specialDateId)
        .eq('date', date)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Evento especial inválido.' }, { status: 400 });
      }

      specialDate = data;
      if (data.included_guests) guests = data.included_guests;
    }

    const { data: reservations, error: capacityQueryError } = await supabase
      .from('reservations')
      .select('num_guests, status')
      .eq('reservation_date', date);

    if (capacityQueryError) throw capacityQueryError;

    const occupiedSeats = (reservations || []).reduce((total, reservation) => {
      const status = (reservation.status || 'pending').toLowerCase();
      return status === 'cancelled' || status === 'cancelado'
        ? total
        : total + (reservation.num_guests || 0);
    }, 0);

    if (occupiedSeats + guests > CAPACITY_LIMIT) {
      return NextResponse.json({ error: 'A capacidade para esta data foi atingida.' }, { status: 409 });
    }

    const requiresGroupPayment = guests >= 15;
    const requiresSpecialPayment = Boolean(specialDate?.requires_fee);
    const paymentAmount = requiresGroupPayment ? 100 : requiresSpecialPayment ? Number(specialDate?.fee_amount || 0) : 0;
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';

    if (requiresGroupPayment && !isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido para o pagamento PIX.' }, { status: 400 });
    }

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        name,
        email,
        whatsapp,
        reservation_date: date,
        reservation_time: time,
        num_guests: guests,
        notes: notes || null,
        cpf: requiresGroupPayment ? cpf : null,
        status: 'pending',
        payment_status: requiresGroupPayment || requiresSpecialPayment ? 'pending' : 'not_required',
        payment_amount: paymentAmount,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ id: reservation.id }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    const message = error instanceof Error && error.message.includes('CAPACITY_EXCEEDED')
      ? 'A capacidade para esta data foi atingida.'
      : 'Não foi possível criar a reserva.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
