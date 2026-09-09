import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_ROLES = new Set(['admin', 'employee', 'receptionist']);

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const jobRoleId = typeof body.job_role_id === 'string' && body.job_role_id ? body.job_role_id : null;

    if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Dados do membro inválidos. Use uma senha de pelo menos 12 caracteres.' }, { status: 400 });
    }
    if (role !== 'employee' && jobRoleId) {
      return NextResponse.json({ error: 'Cargo operacional só pode ser atribuído a funcionários.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createUserError || !authData.user) {
      return NextResponse.json({ error: 'Não foi possível criar o usuário.' }, { status: 400 });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: name,
        role,
        job_role_id: role === 'employee' ? jobRoleId : null,
        force_password_change: true,
      });
    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ id: authData.user.id }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar membro:', error);
    return NextResponse.json({ error: 'Não foi possível cadastrar o membro.' }, { status: 500 });
  }
}
