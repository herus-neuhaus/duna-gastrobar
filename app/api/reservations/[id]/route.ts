import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isPanelStaff } from '@/lib/auth';
import { getBearerReservationAccessToken, hashReservationAccessToken, isReservationAccessToken } from '@/lib/reservation-access';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = getBearerReservationAccessToken(request);

  if (!isUuid(id) || !accessToken) {
    return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
  }

  try {
    const { data, error } = await createAdminClient().rpc('get_reservation_with_access_token', {
      p_reservation_id: id,
      p_access_token_hash: hashReservationAccessToken(accessToken),
    });
    if (error) throw error;
    if (!data?.[0]) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });

    return NextResponse.json({ reservation: data[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao consultar reserva:', error);
    return NextResponse.json({ error: 'Não foi possível consultar a reserva.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    if (!isUuid(id) || !['confirm', 'cancel', 'arrive', 'seat', 'complete', 'no_show', 'update_details'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }

    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const isPublicUpdate = ['cancel', 'update_details'].includes(action) && isReservationAccessToken(accessToken);
    if (!isPublicUpdate && !(await isPanelStaff())) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = createAdminClient();
    if (action === 'arrive') {
      if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
      const { data, error } = await supabase.from('reservations').update({ arrived_at: new Date().toISOString() }).eq('id', id).in('status', ['pending', 'confirmed']).select('id, status, arrived_at').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Esta reserva não pode registrar chegada.' }, { status: 409 });
      return NextResponse.json({ reservation: data });
    }
    if (action === 'update_details') {
      const reservationDate = typeof body.date === 'string' ? body.date : '';
      const reservationTime = typeof body.time === 'string' ? body.time : '';
      const guests = Number(body.guests);
      const capacityOverrideReason = typeof body.capacityOverrideReason === 'string' ? body.capacityOverrideReason.trim() : '';
      const scheduleOverrideReason = typeof body.scheduleOverrideReason === 'string' ? body.scheduleOverrideReason.trim() : '';
      const commercialTurn = body.commercialTurn === 'lunch' || body.commercialTurn === 'dinner' ? body.commercialTurn : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) || !/^\d{2}:\d{2}$/.test(reservationTime) || !Number.isInteger(guests)) {
        return NextResponse.json({ error: 'Dados da reserva inválidos.' }, { status: 400 });
      }
      if (isPublicUpdate) {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
        const lastAvailableDate = new Date(`${today}T00:00:00Z`);
        lastAvailableDate.setUTCDate(lastAvailableDate.getUTCDate() + 10);
        if (reservationDate < today || reservationDate > lastAvailableDate.toISOString().slice(0, 10)) {
          return NextResponse.json({ error: 'Data ou horário indisponível para alteração.' }, { status: 400 });
        }
      }
      if ((capacityOverrideReason || scheduleOverrideReason) && !(await isPanelStaff())) {
        return NextResponse.json({ error: 'A exceção exige uma conta autorizada da equipe.' }, { status: 403 });
      }
      if (scheduleOverrideReason && !commercialTurn) {
        return NextResponse.json({ error: 'Informe o turno comercial da exceção de horário.' }, { status: 400 });
      }
      const { data, error } = capacityOverrideReason || scheduleOverrideReason
        ? await (await createClient()).rpc('update_reservation_with_authorized_overrides', {
          p_reservation_id: id,
          p_reservation_date: reservationDate,
          p_reservation_time: reservationTime,
          p_num_guests: guests,
          p_capacity_override_reason: capacityOverrideReason || null as never,
          p_schedule_override_reason: scheduleOverrideReason || null as never,
          p_commercial_turn: scheduleOverrideReason ? commercialTurn : null as never,
        })
        : await supabase.rpc('update_reservation_with_access_token', {
          p_reservation_id: id,
          p_access_token_hash: hashReservationAccessToken(accessToken),
          p_reservation_date: reservationDate,
          p_reservation_time: reservationTime,
          p_num_guests: guests,
        });
      if (error) throw error;
      if (!data?.[0]) return NextResponse.json({ error: 'Esta reserva não pode mais ser alterada online.' }, { status: 409 });
      return NextResponse.json({ reservation: data[0] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const transitions = {
      confirm: { expected: ['pending'], next: 'confirmed' },
      cancel: { expected: ['pending', 'confirmed'], next: 'cancelled' },
      seat: { expected: ['confirmed'], next: 'seated' },
      complete: { expected: ['seated'], next: 'completed' },
      no_show: { expected: ['confirmed'], next: 'no_show' },
    } as const;
    const transition = transitions[action as Exclude<keyof typeof transitions, 'update_details'>];
    const { data: updatedReservation, error: updateError } = action === 'cancel' && isPublicUpdate
      ? await supabase.rpc('cancel_reservation_with_access_token', {
        p_reservation_id: id,
        p_access_token_hash: hashReservationAccessToken(accessToken),
      })
      : await supabase.rpc('transition_reservation_status', {
        p_reservation_id: id,
        p_expected_statuses: [...transition.expected],
        p_next_status: transition.next,
      });

    if (updateError) throw updateError;
    if (!updatedReservation?.[0]) {
      return NextResponse.json({ error: isPublicUpdate ? 'Reserva não encontrada.' : 'Esta alteração de status não é permitida.' }, { status: isPublicUpdate ? 404 : 409 });
    }

    return NextResponse.json({ reservation: updatedReservation[0] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao atualizar reserva:', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
    const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (errorCode === '23P01' || message.includes('reservation_table_assignments_no_overlap')) {
      return NextResponse.json({ error: 'Uma das mesas não está disponível para o novo horário.' }, { status: 409 });
    }
    if (message.includes('RESERVATION_TIME_UNAVAILABLE') || message.includes('RESERVATION_LEAD_TIME_NOT_MET')) {
      return NextResponse.json({ error: 'Data ou horário indisponível para alteração.' }, { status: 409 });
    }
    if (message.includes('CAPACITY_EXCEEDED') || message.includes('RESERVATION_TURN_CLASSIFICATION_REQUIRED')) {
      return NextResponse.json({ error: 'Não há capacidade disponível neste turno.' }, { status: 409 });
    }
    if (message.includes('CAPACITY_OVERRIDE_NOT_AUTHORIZED')) return NextResponse.json({ error: 'Você não tem permissão para exceder a capacidade.' }, { status: 403 });
    if (message.includes('CAPACITY_OVERRIDE_NOT_NEEDED')) return NextResponse.json({ error: 'A nova operação não precisa de uma exceção de capacidade.' }, { status: 400 });
    if (message.includes('SCHEDULE_OVERRIDE_NOT_AUTHORIZED')) return NextResponse.json({ error: 'Somente administradores podem autorizar horário fora da agenda.' }, { status: 403 });
    if (message.includes('SCHEDULE_OVERRIDE_NOT_NEEDED')) return NextResponse.json({ error: 'O horário escolhido está dentro da agenda; não precisa de exceção.' }, { status: 400 });
    return NextResponse.json({ error: 'Não foi possível atualizar a reserva.' }, { status: 500 });
  }
}
