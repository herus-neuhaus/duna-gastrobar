import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const supabase = createAdminClient();
  const [areas, tables] = await Promise.all([
    supabase.from('restaurant_areas').select('*').order('display_order').order('name'),
    supabase.from('restaurant_tables').select('*').order('code'),
  ]);
  if (areas.error || tables.error) return NextResponse.json({ error: 'Não foi possível consultar as mesas.' }, { status: 500 });
  return NextResponse.json({ areas: areas.data || [], tables: tables.data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json();
  const supabase = createAdminClient();
  if (body.kind === 'area') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Área inválida.' }, { status: 400 });
    const { data, error } = await supabase.from('restaurant_areas').insert({ name, description: typeof body.description === 'string' ? body.description.trim() || null : null, display_order: Number.isInteger(body.displayOrder) ? body.displayOrder : 0 }).select('*').single();
    if (error) return NextResponse.json({ error: 'Não foi possível criar a área.' }, { status: 400 });
    return NextResponse.json({ area: data }, { status: 201 });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const minCapacity = Number(body.minCapacity);
  const maxCapacity = Number(body.maxCapacity);
  if (body.kind !== 'table' || typeof body.areaId !== 'string' || !code || !Number.isInteger(minCapacity) || !Number.isInteger(maxCapacity) || minCapacity < 1 || maxCapacity < minCapacity) return NextResponse.json({ error: 'Mesa inválida.' }, { status: 400 });
  const { data, error } = await supabase.from('restaurant_tables').insert({ area_id: body.areaId, code, min_capacity: minCapacity, max_capacity: maxCapacity }).select('*').single();
  if (error) return NextResponse.json({ error: 'Não foi possível criar a mesa.' }, { status: 400 });
  return NextResponse.json({ table: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const body = await request.json();
  const supabase = createAdminClient();
  if (body.kind === 'area' && typeof body.id === 'string' && typeof body.active === 'boolean') {
    const { error } = await supabase.from('restaurant_areas').update({ active: body.active }).eq('id', body.id);
    return error ? NextResponse.json({ error: 'Não foi possível atualizar a área.' }, { status: 400 }) : NextResponse.json({ success: true });
  }
  if (body.kind === 'table' && typeof body.id === 'string' && typeof body.active === 'boolean') {
    const { error } = await supabase.from('restaurant_tables').update({ active: body.active }).eq('id', body.id);
    return error ? NextResponse.json({ error: 'Não foi possível atualizar a mesa.' }, { status: 400 }) : NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Atualização inválida.' }, { status: 400 });
}
