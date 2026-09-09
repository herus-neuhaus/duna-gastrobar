import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from('decorations')
      .select('id, name, image_url')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ decorations: data || [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao consultar decorações:', error);
    return NextResponse.json({ error: 'Não foi possível consultar as decorações.' }, { status: 500 });
  }
}
