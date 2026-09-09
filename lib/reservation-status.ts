export function normalizeReservationStatus(status: string | null) {
  const normalizedStatus = (status || 'pending').toLowerCase();
  return normalizedStatus === 'cancelado' ? 'cancelled' : normalizedStatus;
}

export function isCancelledReservation(status: string | null) {
  return normalizeReservationStatus(status) === 'cancelled';
}

export function canConfirmReservation(status: string | null) {
  return normalizeReservationStatus(status) === 'pending';
}

export function canCancelReservation(status: string | null) {
  const normalizedStatus = normalizeReservationStatus(status);
  return normalizedStatus === 'pending' || normalizedStatus === 'confirmed';
}

export function canSeatReservation(status: string | null) {
  return normalizeReservationStatus(status) === 'confirmed';
}

export function canCompleteReservation(status: string | null) {
  return normalizeReservationStatus(status) === 'seated';
}
