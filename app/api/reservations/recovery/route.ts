import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReservationAccessToken, hashReservationAccessToken } from '@/lib/reservation-access';
import { createRecoveryCode, hashRecoveryValue, normalizeRecoveryEmail, sendRecoveryCode } from '@/lib/reservation-recovery';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? normalizeRecoveryEmail(body.email) : '';
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('email', email);
    if (error) throw error;

    const reservationIds = (reservations || [])
      .filter((reservation) => !['cancelled', 'cancelado'].includes((reservation.status || 'pending').toLowerCase()))
      .map((reservation) => reservation.id);
    const code = createRecoveryCode();
    const { data: challengeId, error: challengeError } = await supabase.rpc('create_reservation_recovery_challenge', {
      p_email_hash: hashRecoveryValue(email),
      p_code_hash: hashRecoveryValue(code),
      p_reservation_ids: reservationIds,
    });

    if (challengeError) {
      if (challengeError.message.includes('RECOVERY_RATE_LIMITED')) {
        return NextResponse.json({ accepted: true }, { status: 202 });
      }
      throw challengeError;
    }

    if (reservationIds.length) await sendRecoveryCode(email, code);
    return NextResponse.json({ accepted: true, challengeId }, { status: 202 });
  } catch (error) {
    console.error('Erro ao solicitar recuperação de reserva:', error);
    return NextResponse.json({ error: 'A recuperação de reservas está indisponível no momento.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? normalizeRecoveryEmail(body.email) : '';
    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
    if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code) || !challengeId) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: challenge, error: challengeError } = await supabase
      .from('reservation_recovery_challenges')
      .select('reservation_ids')
      .eq('id', challengeId)
      .maybeSingle();
    if (challengeError || !challenge) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });

    const reservationIds = Array.isArray(challenge.reservation_ids) ? challenge.reservation_ids as string[] : [];
    const credentials = reservationIds.map((id) => ({
      reservation_id: id,
      token: createReservationAccessToken(),
    }));
    const { data, error } = await supabase.rpc('complete_reservation_access_recovery', {
      p_challenge_id: challengeId,
      p_email_hash: hashRecoveryValue(email),
      p_code_hash: hashRecoveryValue(code),
      p_access_tokens: credentials.map(({ reservation_id, token }) => ({
        reservation_id,
        token_hash: hashReservationAccessToken(token),
      })),
    });
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });

    const recoveredIds = new Set((data as Array<{ id: string }>).map((reservation) => reservation.id));
    return NextResponse.json({
      credentials: credentials
        .filter((credential) => recoveredIds.has(credential.reservation_id))
        .map(({ reservation_id, token }) => ({ id: reservation_id, token })),
    });
  } catch (error) {
    console.error('Erro ao concluir recuperação de reserva:', error);
    return NextResponse.json({ error: 'Não foi possível validar o código.' }, { status: 500 });
  }
}
