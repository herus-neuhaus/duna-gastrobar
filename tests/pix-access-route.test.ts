import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/payments/pix/route';

describe('POST /api/payments/pix', () => {
  it('rejects PIX generation without the reservation access token before querying data', async () => {
    const response = await POST(new Request('http://localhost/api/payments/pix', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '11111111-1111-4111-8111-111111111111',
        cpf: '52998224725',
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Reserva ou CPF inválido.' });
  });
});
