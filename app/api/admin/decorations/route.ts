import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isPanelStaff } from '@/lib/auth';

const BUCKET = 'decorations';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function GET() {
  // A equipe usa a lista para criar reservas; manutenção continua administrativa.
  if (!(await isPanelStaff())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    const { data, error } = await createAdminClient()
      .from('decorations')
      .select('*')
      .order('active', { ascending: false })
      .order('name');
    if (error) throw error;

    return NextResponse.json({ decorations: data || [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Erro ao consultar decorações:', error);
    return NextResponse.json({ error: 'Não foi possível consultar as decorações. Verifique se a migration foi aplicada.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const formData = await request.formData();
  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '';
  const image = formData.get('image');

  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: 'Informe um nome entre 2 e 100 caracteres.' }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 });
  }
  const extension = ALLOWED_IMAGE_TYPES.get(image.type);
  if (!extension || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'Envie uma imagem JPG, PNG ou WebP de até 5 MB.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const imagePath = `spaces/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, image, { contentType: image.type, upsert: false });
  if (uploadError) {
    console.error('Erro ao enviar imagem de decoração:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar a imagem. Verifique se o bucket foi criado.' }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  const { data: decoration, error: insertError } = await supabase
    .from('decorations')
    .insert({ name, image_path: imagePath, image_url: publicUrl.publicUrl })
    .select('*')
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([imagePath]);
    console.error('Erro ao criar decoração:', insertError);
    return NextResponse.json({ error: 'Não foi possível salvar a decoração.' }, { status: 500 });
  }

  return NextResponse.json({ decoration }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || typeof body.active !== 'boolean') return NextResponse.json({ error: 'Decoração inválida.' }, { status: 400 });

  try {
    const { data, error } = await createAdminClient()
      .from('decorations')
      .update({ active: body.active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ decoration: data });
  } catch (error) {
    console.error('Erro ao atualizar decoração:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar a decoração.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Decoração inválida.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: decoration, error: lookupError } = await supabase
    .from('decorations')
    .select('id, image_path')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    console.error('Erro ao consultar decoração para excluir:', lookupError);
    return NextResponse.json({ error: 'Não foi possível consultar a decoração.' }, { status: 500 });
  }
  if (!decoration) return NextResponse.json({ error: 'Decoração não encontrada.' }, { status: 404 });

  const storage = supabase.storage.from(BUCKET);
  const { data: image, error: downloadError } = await storage.download(decoration.image_path);
  if (downloadError || !image) {
    console.error('Erro ao preservar imagem antes da exclusão:', downloadError);
    return NextResponse.json({ error: 'Não foi possível acessar a imagem. O cadastro foi mantido.' }, { status: 500 });
  }

  const { error: storageError } = await storage.remove([decoration.image_path]);
  if (storageError) {
    console.error('Erro ao remover imagem de decoração:', storageError);
    return NextResponse.json({ error: 'Não foi possível remover a imagem. O cadastro foi mantido.' }, { status: 500 });
  }

  const { data: deletedDecoration, error: deleteError } = await supabase
    .from('decorations')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (deleteError) {
    console.error('Erro ao excluir decoração:', deleteError);
    const { error: restoreError } = await storage.upload(decoration.image_path, image, {
      contentType: image.type || 'application/octet-stream',
      upsert: false,
    });
    if (restoreError) console.error('Não foi possível restaurar imagem após falha ao excluir decoração:', restoreError);
    return NextResponse.json({ error: 'Não foi possível excluir a decoração.' }, { status: 500 });
  }
  if (!deletedDecoration) {
    const { error: restoreError } = await storage.upload(decoration.image_path, image, {
      contentType: image.type || 'application/octet-stream',
      upsert: false,
    });
    if (restoreError) console.error('Não foi possível restaurar imagem após conflito ao excluir decoração:', restoreError);
    return NextResponse.json({ error: 'A decoração foi alterada durante a exclusão. Atualize a lista e tente novamente.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
