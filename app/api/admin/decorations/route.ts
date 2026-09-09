import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/auth';

const BUCKET = 'decorations';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

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
  if (lookupError) throw lookupError;
  if (!decoration) return NextResponse.json({ error: 'Decoração não encontrada.' }, { status: 404 });

  const { error: deleteError } = await supabase
    .from('decorations')
    .delete()
    .eq('id', id);
  if (deleteError) {
    console.error('Erro ao excluir decoração:', deleteError);
    return NextResponse.json({ error: 'Não foi possível excluir a decoração.' }, { status: 500 });
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([decoration.image_path]);
  if (storageError) {
    console.error('Erro ao remover imagem de decoração:', storageError);
    return NextResponse.json({ error: 'A decoração foi excluída, mas a imagem não pôde ser removida.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
