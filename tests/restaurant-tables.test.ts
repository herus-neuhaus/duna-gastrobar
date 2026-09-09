import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('restaurant table allocation migration', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260909040000_restaurant_tables.sql'), 'utf8');

  it('uses an exclusion constraint and atomic assignment replacement', () => {
    expect(migration).toContain('restaurant_areas');
    expect(migration).toContain('restaurant_tables');
    expect(migration).toContain('reservation_table_assignments');
    expect(migration).toContain('exclude using gist (table_id with =, occupancy_range with &&)');
    expect(migration).toContain('replace_reservation_table_assignments');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('release_terminal_reservation_tables');
    expect(migration).toContain('TABLE_ASSIGNMENT_CAPACITY_INSUFFICIENT');
  });
});
