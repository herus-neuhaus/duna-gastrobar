import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isPanelStaff } from '@/lib/auth';
import { isValidCpf } from '@/lib/pagarme';
import { createReservationAccessToken, hashReservationAccessToken } from '@/lib/reservation-access';

export const runtime = 'nodejs';
type DecorationAvailability = { decoration_id: string; available: boolean };

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
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
    const decorationId = typeof body.decorationId === 'string' && body.decorationId ? body.decorationId : null;
    const requestedGuests = Number(body.guests);
    const capacityOverrideReason = typeof body.capacityOverrideReason === 'string' ? body.capacityOverrideReason.trim() : '';
    const scheduleOverrideReason = typeof body.scheduleOverrideReason === 'string' ? body.scheduleOverrideReason.trim() : '';
    const commercialTurn = body.commercialTurn === 'lunch' || body.commercialTurn === 'dinner' ? body.commercialTurn : '';
    const hasOwnerOverride = Boolean(capacityOverrideReason || scheduleOverrideReason);
    const panelStaff = await isPanelStaff();

    const supabase = createAdminClient();
    if (
      name.length < 2 || name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{10,11}$/.test(normalizePhone(whatsapp)) ||
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
    lastAvailableDate.setUTCDate(lastAvailableDate.getUTCDate() + 10);
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day ||
      calendarDate < today ||
       (calendarDate > lastAvailableDate && !panelStaff)
    ) {
      return NextResponse.json({ error: 'Data ou horário indisponível.' }, { status: 400 });
    }

    if (!scheduleOverrideReason) {
      const { data: timeAvailable, error: timeError } = await supabase.rpc('reservation_time_is_available', {
        p_reservation_date: date,
        p_reservation_time: time,
      });
      if (timeError) throw timeError;
      if (!timeAvailable) return NextResponse.json({ error: 'Data ou horário indisponível.' }, { status: 400 });
    }
    if (decorationId) {
      const [{ data: decoration, error: decorationError }, { data: decorationAvailability, error: decorationAvailabilityError }] = await Promise.all([
        supabase
          .from('decorations')
          .select('id')
          .eq('id', decorationId)
          .eq('active', true)
          .maybeSingle(),
        supabase.rpc('get_reservation_decoration_availability', {
          p_reservation_date: date,
          p_reservation_time: time,
        }),
      ]);

      if (decorationError || !decoration) {
        return NextResponse.json({ error: 'A decoração escolhida não está disponível.' }, { status: 400 });
      }
      if (decorationAvailabilityError) throw decorationAvailabilityError;
      if (!((decorationAvailability || []) as DecorationAvailability[]).some((item) => item.decoration_id === decorationId && item.available)) {
        return NextResponse.json({ error: 'Esta mesa já está reservada neste período.', code: 'DECORATION_UNAVAILABLE' }, { status: 409 });
      }
    }

    const { data: blockedDate, error: blockedDateError } = await supabase
      .from('blocked_dates')
      .select('id')
      .eq('date', date)
      .maybeSingle();

    if (blockedDateError) throw blockedDateError;

    if (blockedDate) {
      return NextResponse.json({ error: 'As reservas estão bloqueadas para esta data.' }, { status: 409 });
    }

    let guests = requestedGuests;
    let specialDate = null;
    const { data: specialDates, error: specialDatesError } = await supabase
      .from('special_dates')
      .select('id, date, included_guests, requires_fee, fee_amount')
      .eq('date', date);

    if (specialDatesError) throw specialDatesError;

    if (specialDateId) {
      specialDate = (specialDates || []).find((item) => item.id === specialDateId) || null;
      if (!specialDate) {
        return NextResponse.json({ error: 'Evento especial inválido.' }, { status: 400 });
      }
    } else if ((specialDates || []).length === 1) {
      specialDate = specialDates![0];
    } else if ((specialDates || []).length > 1) {
      return NextResponse.json({ error: 'Selecione o evento especial para esta data.' }, { status: 400 });
    }

    if (specialDate?.included_guests) guests = specialDate.included_guests;

    const requiresGroupPayment = guests >= 15;
    const requiresSpecialPayment = Boolean(specialDate?.requires_fee);
    const requiresPayment = requiresGroupPayment || requiresSpecialPayment;
    const paymentAmount = requiresSpecialPayment ? Number(specialDate?.fee_amount || 0) : requiresGroupPayment ? 100 : 0;
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';

    if (requiresPayment && (!isValidCpf(cpf) || paymentAmount <= 0)) {
      return NextResponse.json({ error: 'CPF inválido para o pagamento PIX.' }, { status: 400 });
    }

    const accessToken = createReservationAccessToken();

    let reservation: { id: string } | null = null;
    let insertError: { message: string; code?: string } | null = null;

    if (hasOwnerOverride) {
      if (!panelStaff) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
      if (scheduleOverrideReason && !commercialTurn) {
        return NextResponse.json({ error: 'Informe o turno de referência para uma reserva fora do horário.' }, { status: 400 });
      }
      const ownerClient = await createClient();
      const result = await ownerClient.rpc('create_reservation_with_authorized_overrides', {
        p_name: name,
        p_email: email,
        p_whatsapp: whatsapp,
        p_reservation_date: date,
        p_reservation_time: time,
        p_num_guests: guests,
        p_notes: notes || null as never,
        p_special_date_id: specialDate?.id || null as never,
        p_decoration_id: decorationId || null as never,
        p_cpf: requiresPayment ? cpf : null as never,
        p_payment_status: requiresPayment ? 'pending' : 'not_required',
        p_payment_amount: paymentAmount,
        p_reservation_access_token_hash: hashReservationAccessToken(accessToken),
        p_capacity_override_reason: capacityOverrideReason || null as never,
        p_schedule_override_reason: scheduleOverrideReason || null as never,
        p_commercial_turn: scheduleOverrideReason ? commercialTurn : null as never,
      });
      reservation = result.data?.[0] || null;
      insertError = result.error;
    } else {
      const result = await supabase
        .from('reservations')
        .insert({
          name,
          email,
          whatsapp,
          reservation_date: date,
          reservation_time: time,
          num_guests: guests,
          notes: notes || null,
          decoration_id: decorationId,
          special_date_id: specialDate?.id || null,
          cpf: requiresPayment ? cpf : null,
          status: 'pending',
          payment_status: requiresPayment ? 'pending' : 'not_required',
          payment_amount: paymentAmount,
          reservation_access_token_hash: hashReservationAccessToken(accessToken),
        })
        .select('id')
        .single();
      reservation = result.data;
      insertError = result.error;
    }

    if (insertError) throw insertError;
    if (!reservation) throw new Error('Reservation insert returned no row.');

    return NextResponse.json({ id: reservation.id, accessToken, paymentRequired: requiresPayment, paymentAmount }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
    const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (errorCode === '23505' && errorMessage.includes('reservations_active_decoration_period_unique')) {
      return NextResponse.json({ error: 'Esta mesa já está reservada neste período.', code: 'DECORATION_UNAVAILABLE' }, { status: 409 });
    }
    if (errorMessage.includes('CAPACITY_EXCEEDED')) {
      return NextResponse.json({ error: 'A capacidade para este turno foi atingida.', code: 'CAPACITY_EXCEEDED' }, { status: 409 });
    }
    if (errorMessage.includes('OWNER_REQUIRED')) return NextResponse.json({ error: 'Somente o dono pode autorizar esta exceção.' }, { status: 403 });
    if (errorMessage.includes('CAPACITY_OVERRIDE_NOT_AUTHORIZED')) return NextResponse.json({ error: 'Você não tem permissão para exceder a capacidade.' }, { status: 403 });
    if (errorMessage.includes('SCHEDULE_OVERRIDE_NOT_AUTHORIZED')) return NextResponse.json({ error: 'Somente administradores ou o dono podem autorizar horário fora da agenda.' }, { status: 403 });
    if (errorMessage.includes('RESERVATION_TURN_CLASSIFICATION_REQUIRED')) return NextResponse.json({ error: 'A data possui reservas históricas que precisam ser classificadas antes de novas reservas.' }, { status: 409 });
    if (errorMessage.includes('ACTIVE_RESERVATION_EXISTS')) {
      return NextResponse.json({ error: 'Já existe uma reserva ativa para este WhatsApp nesta data.' }, { status: 409 });
    }
    if (errorMessage.includes('RESERVATION_LEAD_TIME_NOT_MET')) {
      return NextResponse.json({ error: 'A reserva precisa ser feita com pelo menos 8 horas de antecedência.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Não foi possível criar a reserva.' }, { status: 500 });
  }
}
