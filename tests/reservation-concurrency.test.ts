import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('reservation capacity concurrency guard', () => {
  it('serializes writes for a reservation date before checking capacity', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260909021204_stabilize_reservations.sql'), 'utf8');

    expect(migration).toContain("pg_advisory_xact_lock(hashtext(new.reservation_date::text))");
    expect(migration).toContain("raise exception 'CAPACITY_EXCEEDED");
    expect(migration).toContain("raise exception 'ACTIVE_RESERVATION_EXISTS");
    expect(migration).toContain('transition_reservation_status');
    expect(migration).toContain('complete_reservation_payment');
  });
});
