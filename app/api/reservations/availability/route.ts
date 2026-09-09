import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCancelledReservation } from '@/lib/reservation-status';

const CAPACITY_LIMIT = 80;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(new Date());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || from;

  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });
  }

  const today = getToday();
  if (to < today) {
    return NextResponse.json({ totals: {}, fullDates: [], specialDates: [], blockedDates: [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const availableFrom = from < today ? today : from;

  try {
    const supabase = createAdminClient();
    const [reservationsResult, specialDatesResult, blockedDatesResult, timesResult] = await Promise.all([
      supabase.from('reservations').select('reservation_date, num_guests, status').gte('reservation_date', availableFrom).lte('reservation_date', to),
      supabase.from('special_dates').select('*').gte('date', availableFrom).lte('date', to),
      supabase.from('blocked_dates').select('*').gte('date', availableFrom).lte('date', to),
      supabase.rpc('get_reservation_available_times', { p_from: availableFrom, p_to: to }),
    ]);

    if (reservationsResult.error || specialDatesResult.error || blockedDatesResult.error || timesResult.error) {
      throw reservationsResult.error || specialDatesResult.error || blockedDatesResult.error || timesResult.error;
    }

    const totals: Record<string, number> = {};
    for (const reservation of reservationsResult.data || []) {
      if (!isCancelledReservation(reservation.status)) {
        totals[reservation.reservation_date] = (totals[reservation.reservation_date] || 0) + (reservation.num_guests || 0);
      }
    }

    const availableTimes: Record<string, string[]> = {};
    for (const slot of timesResult.data || []) {
      const time = slot.reservation_time.slice(0, 5);
      availableTimes[slot.reservation_date] = [...(availableTimes[slot.reservation_date] || []), time];
    }

    return NextResponse.json({
      totals,
      fullDates: Object.keys(totals).filter((date) => totals[date] >= CAPACITY_LIMIT),
      specialDates: specialDatesResult.data || [],
      blockedDates: blockedDatesResult.data || [],
      availableTimes,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao consultar disponibilidade:', error);
    return NextResponse.json({ error: 'Não foi possível consultar a disponibilidade.' }, { status: 500 });
  }
}
