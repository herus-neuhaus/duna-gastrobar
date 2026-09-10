import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
type DecorationAvailability = { decoration_id: string; available: boolean };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';

  if ((date || time) && (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time))) {
    return NextResponse.json({ error: 'Data ou horário inválido.' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('decorations')
      .select('id, name, image_url')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    let availableIds: Set<string> | null = null;
    if (date && time) {
      const { data: availability, error: availabilityError } = await supabase.rpc('get_reservation_decoration_availability', {
        p_reservation_date: date,
        p_reservation_time: time,
      });
      if (availabilityError) throw availabilityError;
      availableIds = new Set(((availability || []) as DecorationAvailability[])
        .filter((item) => item.available)
        .map((item) => item.decoration_id));
    }

    return NextResponse.json({ decorations: (data || []).map((decoration) => ({
      ...decoration,
      available: availableIds?.has(decoration.id) ?? true,
    })) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao consultar decorações:', error);
    return NextResponse.json({ error: 'Não foi possível consultar as decorações.' }, { status: 500 });
  }
}
