import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return a dummy client or handle it safely during build
    // This prevents the entire build from crashing if env vars are missing
    if (typeof window === 'undefined') {
      console.warn('Supabase env variables are missing during server-side rendering/build.');
    }
  }

  return createBrowserClient(
    supabaseUrl || '',
    supabaseKey || ''
  )
}
