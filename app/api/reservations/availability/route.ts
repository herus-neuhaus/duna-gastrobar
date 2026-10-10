import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const lastPublicDate = new Date(`${today}T00:00:00Z`);
  lastPublicDate.setUTCDate(lastPublicDate.getUTCDate() + 10);
  const lastPublicDateString = lastPublicDate.toISOString().slice(0, 10);
  if (to < today) {
    return NextResponse.json({ turnTotals: {}, timeTurns: {}, fullDates: [], specialDates: [], blockedDates: [], availableTimes: {} }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const availableFrom = from < today ? today : from;
  const availableTo = to > lastPublicDateString ? lastPublicDateString : to;
  if (availableFrom > availableTo) {
    return NextResponse.json({ turnTotals: {}, timeTurns: {}, fullDates: [], specialDates: [], blockedDates: [], availableTimes: {} }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const supabase = createAdminClient();
    const [availabilityResult, specialDatesResult, blockedDatesResult] = await Promise.all([
      supabase.rpc('get_reservation_capacity_availability', { p_from: availableFrom, p_to: availableTo }),
      supabase.from('special_dates').select('*').gte('date', availableFrom).lte('date', availableTo),
      supabase.from('blocked_dates').select('*').gte('date', availableFrom).lte('date', availableTo),
    ]);

    if (availabilityResult.error || specialDatesResult.error || blockedDatesResult.error) {
      throw availabilityResult.error || specialDatesResult.error || blockedDatesResult.error;
    }

    const turnTotals: Record<string, number> = {};
    const timeTurns: Record<string, Record<string, string>> = {};
    const availableTimes: Record<string, string[]> = {};
    const turnsByDate: Record<string, Set<string>> = {};
    const fullTurnsByDate: Record<string, Set<string>> = {};
    const unclassifiedDates = new Set<string>();
    for (const slot of availabilityResult.data || []) {
      const time = slot.reservation_time.slice(0, 5);
      const commercialTurn = slot.commercial_turn;
      if (!commercialTurn) continue;
      const turnKey = `${slot.reservation_date}|${commercialTurn}`;
      turnTotals[turnKey] = slot.occupied_guests;
      timeTurns[slot.reservation_date] = { ...(timeTurns[slot.reservation_date] || {}), [time]: commercialTurn };
      (turnsByDate[slot.reservation_date] ||= new Set()).add(commercialTurn);
      if (slot.occupied_guests >= CAPACITY_LIMIT) (fullTurnsByDate[slot.reservation_date] ||= new Set()).add(commercialTurn);
      if (slot.has_unclassified_reservation) unclassifiedDates.add(slot.reservation_date);
      if (!slot.has_unclassified_reservation && slot.occupied_guests < CAPACITY_LIMIT) {
        availableTimes[slot.reservation_date] = [...(availableTimes[slot.reservation_date] || []), time];
      }
    }
    const fullDates = Object.keys(turnsByDate).filter((date) => (
      unclassifiedDates.has(date) || turnsByDate[date].size === fullTurnsByDate[date]?.size
    ));

    return NextResponse.json({
      turnTotals,
      timeTurns,
      fullDates,
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
