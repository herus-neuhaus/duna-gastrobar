import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('decoration period availability migration', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260909053000_prevent_decoration_period_conflicts.sql'), 'utf8');

  it('splits weekend lunch and dinner while preventing active duplicate table bookings', () => {
    expect(migration).toContain("where day_of_week in (0, 5, 6)");
    expect(migration).toContain("(0, '18:00', '21:00')");
    expect(migration).toContain("(5, '18:00', '21:00')");
    expect(migration).toContain("(6, '18:00', '21:00')");
    expect(migration).toContain('reservations_active_decoration_period_unique');
    expect(migration).toContain('get_reservation_decoration_availability');
  });
});
