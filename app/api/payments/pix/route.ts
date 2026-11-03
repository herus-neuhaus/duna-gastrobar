import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidCpf, pagarmeRequest } from '@/lib/pagarme';
import { hashReservationAccessToken, isReservationAccessToken } from '@/lib/reservation-access';
import { persistReservationPayment } from '@/lib/reservation-payment-persistence';

export const runtime = 'nodejs';

type PagarmeOrder = {
  id: string;
  status: string;
  amount: number;
  charges?: Array<{
    id: string;
    last_transaction?: {
      qr_code?: string;
      qr_code_url?: string;
      expires_at?: string;
    };
  }>;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';

    if (!reservationId || !isValidCpf(cpf) || !isReservationAccessToken(accessToken)) {
      return NextResponse.json({ error: 'Reserva ou CPF inválido.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id, name, email, whatsapp, status, payment_status, payment_amount, reservation_access_token_hash')
      .eq('id', reservationId)
      .single();

    if (error || !reservation || reservation.reservation_access_token_hash !== hashReservationAccessToken(accessToken)) {
      return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
    }

    if ((reservation.status || 'pending').toLowerCase() === 'cancelled') {
      return NextResponse.json({ error: 'Não é possível gerar PIX para uma reserva cancelada.' }, { status: 409 });
    }

    const paymentAmount = Number(reservation.payment_amount || 0);
    if (reservation.payment_status === 'paid') {
      return NextResponse.json({ error: 'Esta reserva já está paga.' }, { status: 409 });
    }
    if (reservation.payment_status !== 'pending' || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Esta reserva não possui pagamento pendente.' }, { status: 400 });
    }

    const phone = reservation.whatsapp.replace(/\D/g, '');
    const localPhone = phone.startsWith('55') && phone.length >= 12 ? phone.slice(2) : phone;
    const areaCode = localPhone.slice(0, 2);
    const number = localPhone.slice(2);

    if (areaCode.length !== 2 || number.length < 8) {
      return NextResponse.json({ error: 'WhatsApp inválido para gerar o PIX.' }, { status: 400 });
    }

    const order = await pagarmeRequest<PagarmeOrder>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': `reservation-${reservation.id}-fee` },
      body: JSON.stringify({
        code: reservation.id,
        closed: true,
        items: [{
          code: 'reserva-tax',
          amount: Math.round(paymentAmount * 100),
          description: 'Taxa de reserva - Duna Cozinha e Bar',
          quantity: 1,
        }],
        customer: {
          name: reservation.name.slice(0, 64),
          ...(reservation.email ? { email: reservation.email.slice(0, 64) } : {}),
          type: 'individual',
          document: cpf,
          document_type: 'CPF',
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: areaCode,
              number,
            },
          },
        },
        payments: [{
          payment_method: 'pix',
          pix: {
            expires_in: 1800,
            additional_information: [
              { name: 'Reserva', value: reservation.id },
              { name: 'Taxa', value: `R$ ${paymentAmount.toFixed(2)}` },
            ],
          },
        }],
        metadata: {
          reservation_id: reservation.id,
          purpose: 'reservation_fee',
        },
      }),
    });

    if (order.amount !== Math.round(paymentAmount * 100)) {
      throw new Error('O valor do pedido PIX não corresponde ao pagamento da reserva.');
    }

    const transaction = order.charges?.[0]?.last_transaction;
    if (order.status === 'paid') {
      await persistReservationPayment(supabase, {
        reservationId: reservation.id,
        orderId: order.id,
        amount: paymentAmount,
        status: 'paid',
        expiresAt: transaction?.expires_at || null,
      });
      return NextResponse.json({ error: 'Esta reserva já está paga.' }, { status: 409 });
    }
    if (!transaction?.qr_code) {
      throw new Error('O Pagar.me não retornou os dados do QR Code PIX.');
    }

    await persistReservationPayment(supabase, {
      reservationId: reservation.id,
      orderId: order.id,
      amount: paymentAmount,
      status: 'pending',
      expiresAt: transaction.expires_at || null,
    });

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        cpf,
        expires_at: transaction.expires_at || null,
      })
      .eq('id', reservation.id)
      .eq('payment_status', 'pending');
    if (updateError) throw updateError;

    return NextResponse.json({
      orderId: order.id,
      qrCode: transaction.qr_code,
      qrCodeUrl: transaction.qr_code_url,
      expiresAt: transaction.expires_at,
      amount: paymentAmount,
    });
  } catch (error) {
    console.error('Erro ao criar PIX Pagar.me:', error);
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o PIX.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
