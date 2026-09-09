import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) || !/^\d{2}:\d{2}$/.test(reservationTime) || !Number.isInteger(guests)) {
        return NextResponse.json({ error: 'Dados da reserva inválidos.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('update_reservation_with_access_token', {
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
    const message = error instanceof Error ? error.message : '';
    if (message.includes('RESERVATION_TIME_UNAVAILABLE') || message.includes('RESERVATION_LEAD_TIME_NOT_MET')) {
      return NextResponse.json({ error: 'Data ou horário indisponível para alteração.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Não foi possível atualizar a reserva.' }, { status: 500 });
  }
}
