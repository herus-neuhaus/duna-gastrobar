import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 12) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 12 caracteres.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      return NextResponse.json({ error: 'Não foi possível atualizar a senha.' }, { status: 400 });
    }

    const { error: profileError } = await createAdminClient()
      .from('profiles')
      .update({ force_password_change: false })
      .eq('id', user.id);
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao concluir troca obrigatória de senha:', error);
    return NextResponse.json({ error: 'A senha foi atualizada, mas não foi possível concluir o acesso. Tente novamente.' }, { status: 500 });
  }
}
