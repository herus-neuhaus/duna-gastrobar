import type { createAdminClient } from '@/lib/supabase/admin';

type ReservationPayment = {
  reservationId: string;
  orderId: string;
  amount: number;
  status: 'pending' | 'paid';
  expiresAt?: string | null;
};

/** Somente após validar o acesso à reserva e/ou a ordem diretamente no provedor. */
export async function persistReservationPayment(
  supabase: ReturnType<typeof createAdminClient>,
  payment: ReservationPayment,
) {
  const paidAt = payment.status === 'paid' ? new Date().toISOString() : null;
  // ON CONFLICT DO NOTHING: uma resposta antiga do PIX nunca sobrescreve o webhook.
  const { error: insertError } = await supabase.from('reservation_payments').upsert({
    reservation_id: payment.reservationId,
    provider: 'pagarme',
    provider_order_id: payment.orderId,
    method: 'pix',
    status: payment.status,
    amount: payment.amount,
    paid_at: paidAt,
    ...(payment.expiresAt !== undefined ? { expires_at: payment.expiresAt } : {}),
  }, { onConflict: 'provider,provider_order_id', ignoreDuplicates: true });
  if (insertError) throw insertError;

  const { data: savedPayment, error: lookupError } = await supabase.from('reservation_payments')
    .select('reservation_id, amount')
    .eq('provider', 'pagarme')
    .eq('provider_order_id', payment.orderId)
    .single();
  if (lookupError) throw lookupError;
  if (!savedPayment || savedPayment.reservation_id !== payment.reservationId || Number(savedPayment.amount) !== payment.amount) {
    throw new Error('O pedido PIX não corresponde ao pagamento da reserva.');
  }

  if (payment.status === 'paid') {
    const { error: paymentError } = await supabase.from('reservation_payments')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('provider', 'pagarme')
      .eq('provider_order_id', payment.orderId)
      .eq('reservation_id', payment.reservationId)
      .neq('status', 'paid');
    if (paymentError) throw paymentError;

    // Repetir a RPC também recupera falha após gravar o pagamento. Ela só muda
    // reservas ainda pendentes, com valor exato, sem reativar as canceladas.
    const { error: completionError } = await supabase.rpc('complete_reservation_payment', {
      p_reservation_id: payment.reservationId,
      p_payment_amount: payment.amount,
    });
    if (completionError) throw completionError;
  } else if (payment.expiresAt !== undefined) {
    const { error: expiryError } = await supabase.from('reservation_payments')
      .update({ expires_at: payment.expiresAt })
      .eq('provider', 'pagarme')
      .eq('provider_order_id', payment.orderId)
      .eq('reservation_id', payment.reservationId)
      .eq('status', 'pending');
    if (expiryError) throw expiryError;
  }
}
