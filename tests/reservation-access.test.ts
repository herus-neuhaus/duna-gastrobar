import { describe, expect, it } from 'vitest';
import {
  createReservationAccessToken,
  getBearerReservationAccessToken,
  hashReservationAccessToken,
  isReservationAccessToken,
} from '@/lib/reservation-access';

describe('reservation access tokens', () => {
  it('creates opaque tokens and stores only their stable hash', () => {
    const token = createReservationAccessToken();

    expect(isReservationAccessToken(token)).toBe(true);
    expect(token).toHaveLength(64);
    expect(hashReservationAccessToken(token)).not.toBe(token);
    expect(hashReservationAccessToken(token)).toHaveLength(64);
  });

  it('accepts access tokens only from a bearer header', () => {
    const token = 'a'.repeat(64);
    expect(getBearerReservationAccessToken(new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } }))).toBe(token);
    expect(getBearerReservationAccessToken(new Request('http://localhost', { headers: { Authorization: token } }))).toBeNull();
  });
});
