import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ browserClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.browserClient }));
import { updateSession } from '@/lib/supabase/middleware';

describe('redirecionamento autenticado por nível', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    mocks.browserClient.mockReset();
  });
  it('redireciona funcionário para operação sem perder cookies renovados ou cabeçalhos de cache', async () => {
    mocks.browserClient.mockImplementation((_url, _key, options) => ({
      auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'synthetic-token', options: { path: '/' } }], { 'Cache-Control': 'private, no-store' });
        return { data: { user: { id: 'employee' } } };
      } },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'employee' } }) }) }) }),
    }));
    const response = await updateSession(new NextRequest('https://example.invalid/admin?view=estabelecimento'));
    expect(response.headers.get('location')).toBe('https://example.invalid/admin?view=operations');
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('synthetic-token');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
