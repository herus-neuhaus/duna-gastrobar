import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createReservationAccessToken() {
  return randomBytes(32).toString('hex');
}

export function hashReservationAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isReservationAccessToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function getBearerReservationAccessToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return isReservationAccessToken(token) ? token : null;
}
