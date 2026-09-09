import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('reservation operations migration', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260909030000_reservation_operations.sql'), 'utf8');

  it('keeps scheduling, recovery and operational state changes in database functions', () => {
    expect(migration).toContain('reservation_schedule_slots');
    expect(migration).toContain('reservation_time_is_available');
    expect(migration).toContain('update_reservation_with_access_token');
    expect(migration).toContain("'seated', 'completed', 'no_show'");
    expect(migration).toContain('reservation_recovery_challenges');
    expect(migration).toContain('attempts > 5');
    expect(migration).toContain('reservation_payments');
    expect(migration).toContain('reservation_events');
  });
});
