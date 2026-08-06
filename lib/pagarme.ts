const PAGARME_API_URL = 'https://api.pagar.me/core/v5';

function getAuthorization() {
  const secretKey = process.env.PAGAR_ME_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Pagar.me não configurado.');
  }

  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export async function pagarmeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PAGARME_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorization(),
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.errors?.[0]?.message || 'Não foi possível comunicar com o Pagar.me.';
    throw new Error(message);
  }

  return data as T;
}

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}
