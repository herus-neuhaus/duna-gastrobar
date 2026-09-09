import { createHmac, randomInt } from 'node:crypto';

export function normalizeRecoveryEmail(value: string) {
  return value.trim().toLowerCase();
}

export function hashRecoveryValue(value: string) {
  const secret = process.env.RESERVATION_RECOVERY_SECRET;
  if (!secret) throw new Error('Recuperação de reservas não configurada.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createRecoveryCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function sendRecoveryCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESERVATION_RECOVERY_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Recuperação de reservas não configurada.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Código para acessar suas reservas Duna',
      text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Se você não solicitou este código, ignore este e-mail.`,
    }),
  });

  if (!response.ok) throw new Error('Não foi possível enviar o código de recuperação.');
}
