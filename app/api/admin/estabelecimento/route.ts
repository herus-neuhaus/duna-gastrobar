import { NextResponse } from 'next/server';
import { isReservationOwner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { consultarFuncionamento } from '@/lib/estabelecimento-server';
import { validarConfiguracaoEstabelecimento, type ConfiguracaoEstabelecimento } from '@/lib/estabelecimento';
import type { Json } from '@/lib/supabase/database.types';

export async function GET() {
  if (!(await isReservationOwner())) return NextResponse.json({ error: 'Somente administradores podem configurar o estabelecimento.' }, { status: 403 });
  try {
    return NextResponse.json(await consultarFuncionamento(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar o funcionamento. Confira se a migração de configurações foi aplicada.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!(await isReservationOwner())) return NextResponse.json({ error: 'Somente administradores podem configurar o estabelecimento.' }, { status: 403 });
  let body: ConfiguracaoEstabelecimento;
  try {
    body = await request.json();
    const error = validarConfiguracaoEstabelecimento(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('salvar_funcionamento_estabelecimento', { p_configuracao: body.dias as unknown as Json, p_versao: body.versao });
  if (error) {
    if (error.message.includes('CONFIGURACAO_DESATUALIZADA')) return NextResponse.json({ error: 'Outra pessoa alterou a configuração. Recarregue antes de salvar.' }, { status: 409 });
    if (error.message.includes('AGENDA_CONFLITO_RESERVAS')) {
      return NextResponse.json({ error: 'Existem reservas antigas sem contexto de agenda suficiente para preservar seus horários e mesas. Solicite a revisão desses registros. Nenhuma alteração foi aplicada.' }, { status: 409 });
    }
    if (error.message.includes('OWNER_REQUIRED')) return NextResponse.json({ error: 'Somente administradores podem alterar o funcionamento.' }, { status: 403 });
    const mensagem = error.message.includes('RESERVA_FORA_FUNCIONAMENTO') ? 'As reservas e sua permanência devem caber no funcionamento.'
      : /SOBREPOST/.test(error.message) ? 'Existem períodos ou janelas de reserva sobrepostos.'
        : error.code === '23505' ? 'Existem horários de reserva com o mesmo início. Salve a remoção antes de reutilizar esse horário.'
          : 'Não foi possível salvar. Confira os dias e os horários informados.';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
  return NextResponse.json({ versao: data });
}
