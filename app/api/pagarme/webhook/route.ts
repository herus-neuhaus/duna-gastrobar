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

    if (
      order.status !== 'paid' ||
      order.amount !== 10000 ||
      order.metadata?.purpose !== 'group_reservation_fee' ||
      !reservationId
    ) {
      return NextResponse.json({ error: 'Pagamento não confirmado.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('status, num_guests')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation || reservation.num_guests < 15) {
      return NextResponse.json({ error: 'Reserva de grupo não encontrada.' }, { status: 404 });
    }

    const currentStatus = (reservation.status || 'pending').toLowerCase();
    const wasCancelled = currentStatus === 'cancelled' || currentStatus === 'cancelado';
    const { error } = await supabase
      .from('reservations')
      .update({
        payment_status: 'paid',
        ...(wasCancelled ? {} : { status: 'confirmed' }),
      })
      .eq('id', reservationId);

    if (error) throw error;

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook Pagar.me:', error);
    return NextResponse.json({ error: 'Não foi possível processar o webhook.' }, { status: 500 });
  }
}
