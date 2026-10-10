import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ isAdmin: mocks.isAdmin }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { POST as createRestaurantResource } from '@/app/api/admin/restaurant/route';
import { DELETE as deleteDecoration } from '@/app/api/admin/decorations/route';

describe('admin resource routes', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.isAdmin.mockReset();
    mocks.isAdmin.mockResolvedValue(true);
  });

  it('rejects a table assigned to an inactive area', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => table === 'restaurant_areas'
        ? { select }
        : { insert },
    });

    const response = await createRestaurantResource(new Request('http://localhost/api/admin/restaurant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'table', areaId: 'inactive-area', code: 'T-1', minCapacity: 1, maxCapacity: 4 }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Selecione uma área ativa.' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('retains the decoration record when its image cannot be removed', async () => {
    const deleteQuery = vi.fn();
    const order: string[] = [];
    const lookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'dec-1', image_path: 'spaces/dec-1.jpg' }, error: null }) }) }),
    };
    const storage = {
      download: async () => ({ data: new Blob(['image'], { type: 'image/jpeg' }), error: null }),
      remove: async () => { order.push('remove'); return { error: { message: 'storage unavailable' } }; },
      upload: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => table === 'decorations' ? {
        ...lookup,
        delete: () => { order.push('delete'); return deleteQuery(); },
      } : undefined,
      storage: { from: () => storage },
    });

    const response = await deleteDecoration(new Request('http://localhost/api/admin/decorations?id=dec-1'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Não foi possível remover a imagem. O cadastro foi mantido.' });
    expect(order).toEqual(['remove']);
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it('restores the image if deleting the decoration record fails', async () => {
    const order: string[] = [];
    const image = new Blob(['image'], { type: 'image/jpeg' });
    const storage = {
      download: async () => ({ data: image, error: null }),
      remove: async () => { order.push('remove'); return { error: null }; },
      upload: vi.fn(async () => { order.push('restore'); return { error: null }; }),
    };
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'dec-1', image_path: 'spaces/dec-1.jpg' }, error: null }) }) }),
        delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'database unavailable' } }) }) }) }),
      }),
      storage: { from: () => storage },
    });

    const response = await deleteDecoration(new Request('http://localhost/api/admin/decorations?id=dec-1'));

    expect(response.status).toBe(500);
    expect(order).toEqual(['remove', 'restore']);
    expect(storage.upload).toHaveBeenCalledWith('spaces/dec-1.jpg', image, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });
});
