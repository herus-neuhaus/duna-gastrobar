import { describe, expect, it } from 'vitest';
import {
  canCancelReservation,
  canConfirmReservation,
  isCancelledReservation,
  normalizeReservationStatus,
} from '@/lib/reservation-status';

describe('reservation status transitions', () => {
  it('normalizes legacy cancelled status', () => {
    expect(normalizeReservationStatus('cancelado')).toBe('cancelled');
    expect(isCancelledReservation('CANCELLED')).toBe(true);
  });

  it('only confirms pending reservations', () => {
    expect(canConfirmReservation('pending')).toBe(true);
    expect(canConfirmReservation('confirmed')).toBe(false);
    expect(canConfirmReservation('cancelled')).toBe(false);
  });

  it('only cancels pending or confirmed reservations', () => {
    expect(canCancelReservation('pending')).toBe(true);
    expect(canCancelReservation('confirmed')).toBe(true);
    expect(canCancelReservation('completed')).toBe(false);
    expect(canCancelReservation('cancelled')).toBe(false);
  });
});
