import { describe, expect, it } from 'vitest';
import { isValidCpf } from '@/lib/pagarme';

describe('isValidCpf', () => {
  it('accepts valid formatted and unformatted CPFs', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejects invalid or repeated CPFs', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});
