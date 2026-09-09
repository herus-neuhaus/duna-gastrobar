import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pagarmeRequest } from '@/lib/pagarme';

export const runtime = 'nodejs';

type PagarmeOrder = {
  id: string;
  status: string;
  amount: number;
  metadata?: { reservation_id?: string; purpose?: string };
  charges?: Array<{ id: string; status: string; paid_amount?: number }>;
};

export async function POST(request: Request) {
  try {
    const event = await request.json();

    if (event.type !== 'order.paid') {
      return NextResponse.json({ received: true });
    }

    const configuredAccountId = process.env.PAGAR_ME_ID_CONTA;
    if (configuredAccountId && event.account?.id !== configuredAccountId) {
      return NextResponse.json({ error: 'Conta Pagar.me inválida.' }, { status: 403 });
    }

    const orderId = event.data?.id;
    if (typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }

    // O evento só é aceito após consultar o pedido diretamente no Pagar.me.
    const order = await pagarmeRequest<PagarmeOrder>(`/orders/${encodeURIComponent(orderId)}`);
    const reservationId = order.metadata?.reservation_id;

    if (order.status !== 'paid' || !['reservation_fee', 'group_reservation_fee'].includes(order.metadata?.purpose || '') || !reservationId) {
      return NextResponse.json({ error: 'Pagamento não confirmado.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('payment_amount, payment_status')
      .eq('id', reservationId)
      .single();

    const paymentAmount = Number(reservation?.payment_amount || 0);
    if (reservationError || !reservation || reservation.payment_status !== 'pending' || paymentAmount <= 0 || order.amount !== Math.round(paymentAmount * 100)) {
      return NextResponse.json({ error: 'Pagamento não confirmado.' }, { status: 400 });
    }

    const { error: paymentError } = await supabase
      .from('reservation_payments')
      .upsert({
        reservation_id: reservationId,
        provider: 'pagarme',
        provider_order_id: order.id,
        method: 'pix',
        status: 'paid',
        amount: paymentAmount,
        paid_at: new Date().toISOString(),
      }, { onConflict: 'provider,provider_order_id' });
    if (paymentError) throw paymentError;

    const { data, error } = await supabase.rpc('complete_reservation_payment', {
      p_reservation_id: reservationId,
      p_payment_amount: paymentAmount,
    });

    if (error) throw error;
    if (!data?.[0]) return NextResponse.json({ received: true });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook Pagar.me:', error);
    return NextResponse.json({ error: 'Não foi possível processar o webhook.' }, { status: 500 });
  }
}
