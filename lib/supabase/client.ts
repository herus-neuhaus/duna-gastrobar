import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se as variáveis estiverem ausentes (como durante o build do Vercel),
  // fornecemos valores temporários para evitar que o @supabase/ssr quebre o build.
  // No runtime, as variáveis reais devem ser configuradas no painel do Vercel.
  if (!supabaseUrl || !supabaseKey) {
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-key'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
