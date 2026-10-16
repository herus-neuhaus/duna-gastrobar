import { NextResponse } from 'next/server';
import { consultarFuncionamento } from '@/lib/estabelecimento-server';
import { resumirFuncionamento } from '@/lib/estabelecimento';

export async function GET() {
  try {
    const configuracao = await consultarFuncionamento();
    // Não publica as regras internas de permanência/preparação nem auditorias.
    const dias = configuracao.dias.map(({ reservas: _reservas, ...dia }) => dia);
    return NextResponse.json({ dias, resumo: resumirFuncionamento(configuracao.dias), fuso_horario: 'America/Porto_Velho' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Horário de funcionamento indisponível.' }, { status: 503 });
  }
}
