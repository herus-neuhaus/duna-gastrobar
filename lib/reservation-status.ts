export function normalizeReservationStatus(status: string | null) {
  const normalizedStatus = (status || 'pending').toLowerCase();
  return normalizedStatus === 'cancelado' ? 'cancelled' : normalizedStatus;
}

export function isCancelledReservation(status: string | null) {
  return normalizeReservationStatus(status) === 'cancelled';
}

// Lugares são liberados pela conclusão do atendimento, não pelo intervalo
// entre entradas nem pelo tempo de preparação de uma mesa.
export function consumesReservationCapacity(status: string | null) {
  return ['pending', 'pendente', 'confirmed', 'confirmado', 'seated'].includes(normalizeReservationStatus(status));
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
