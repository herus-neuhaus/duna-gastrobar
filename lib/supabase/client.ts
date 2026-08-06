import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e reinicie o servidor.'
    );
  }

  if (supabaseKey.startsWith('sb_secret_')) {
    throw new Error('Uma chave secreta do Supabase não pode ser usada no navegador. Use a chave sb_publishable_.');
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
