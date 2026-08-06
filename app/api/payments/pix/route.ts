import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidCpf, pagarmeRequest } from '@/lib/pagarme';

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

    if (!reservationId || !isValidCpf(cpf)) {
      return NextResponse.json({ error: 'Reserva ou CPF inválido.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id, name, email, whatsapp, num_guests, payment_status')
      .eq('id', reservationId)
      .single();

    if (error || !reservation) {
      return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
    }

    if (reservation.num_guests < 15) {
      return NextResponse.json({ error: 'O PIX de grupo é exclusivo para reservas com 15 ou mais pessoas.' }, { status: 400 });
    }

    if (reservation.payment_status === 'paid') {
      return NextResponse.json({ error: 'Esta reserva já está paga.' }, { status: 409 });
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
      headers: { 'Idempotency-Key': `reservation-${reservation.id}-group-fee` },
      body: JSON.stringify({
        code: reservation.id,
        closed: true,
        items: [{
          code: 'reserva-grupo',
          amount: 10000,
          description: 'Taxa de reserva para grupo - Duna Cozinha e Bar',
          quantity: 1,
        }],
        customer: {
          name: reservation.name.slice(0, 64),
          email: reservation.email.slice(0, 64),
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
              { name: 'Convidados', value: String(reservation.num_guests) },
            ],
          },
        }],
        metadata: {
          reservation_id: reservation.id,
          purpose: 'group_reservation_fee',
        },
      }),
    });

    const transaction = order.charges?.[0]?.last_transaction;
    if (!transaction?.qr_code) {
      throw new Error('O Pagar.me não retornou os dados do QR Code PIX.');
    }

    await supabase
      .from('reservations')
      .update({
        cpf,
        payment_status: 'pending',
        payment_amount: 100,
        expires_at: transaction.expires_at || null,
      })
      .eq('id', reservation.id);

    return NextResponse.json({
      orderId: order.id,
      qrCode: transaction.qr_code,
      qrCodeUrl: transaction.qr_code_url,
      expiresAt: transaction.expires_at,
      amount: 100,
    });
  } catch (error) {
    console.error('Erro ao criar PIX Pagar.me:', error);
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o PIX.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
