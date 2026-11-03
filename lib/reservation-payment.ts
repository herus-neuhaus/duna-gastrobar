type ReservationPaymentDate = {
  requires_fee: boolean | null;
  fee_amount: number | null;
};

/** A data especial tem precedência sobre a taxa de grupo, sem somar valores. */
export function getReservationPayment(guests: number, specialDate: ReservationPaymentDate | null) {
  const specialPayment = Boolean(specialDate?.requires_fee);
  const groupPayment = guests >= 15;

  return {
    required: specialPayment || groupPayment,
    amount: specialPayment ? Number(specialDate?.fee_amount || 0) : groupPayment ? 100 : 0,
  };
}
