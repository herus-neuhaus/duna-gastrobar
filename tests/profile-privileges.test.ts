import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('profile privilege trigger migration', () => {
  it('uses the private manager helper and protects the forced password flag', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260909021444_secure_forced_password_change.sql'), 'utf8');

    expect(migration).toContain('not private.is_manager()');
    expect(migration).toContain('new.force_password_change is distinct from old.force_password_change');
  });
});
