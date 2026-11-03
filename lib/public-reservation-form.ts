import { isValidCpf } from '@/lib/cpf';

export const PUBLIC_RESERVATION_HORIZON_DAYS = 60;
export const RESERVATION_MIN_LEAD_HOURS = 2;

export type PublicReservationContact = { name: string; whatsapp: string; cpf: string };
export type PublicReservationContactErrors = Partial<Record<keyof PublicReservationContact, string>>;

export function validatePublicReservationContact(contact: PublicReservationContact, requiresPayment: boolean) {
  const errors: PublicReservationContactErrors = {};
  if (contact.name.trim().length < 2 || contact.name.trim().length > 120) {
    errors.name = 'Informe seu nome, entre 2 e 120 caracteres.';
  }
  if (!/^\d{10,11}$/.test(contact.whatsapp.replace(/\D/g, ''))) {
    errors.whatsapp = 'Informe um telefone com DDD, com 10 ou 11 dígitos.';
  }
  if (requiresPayment && !isValidCpf(contact.cpf)) {
    errors.cpf = 'Informe um CPF válido para gerar o pagamento.';
  }
  return errors;
}

export function formatReservationCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function getPublicReservationDateRange(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Porto_Velho' }).format(now);
  const lastDate = new Date(`${today}T12:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() + PUBLIC_RESERVATION_HORIZON_DAYS);
  return { today, lastDate: lastDate.toISOString().slice(0, 10) };
}

export function getPublicReservationDates(now = new Date()) {
  const { today } = getPublicReservationDateRange(now);
  return Array.from({ length: PUBLIC_RESERVATION_HORIZON_DAYS + 1 }, (_, index) => {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Compara horários de parede no mesmo fuso utilizado pelo trigger de agenda. */
export function hasReservationLeadTime(date: string, time: string, now = new Date()) {
  if (!date || !time) return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Porto_Velho', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const businessNow = Date.parse(`${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}Z`) + now.getUTCMilliseconds();
  const selected = Date.parse(`${date}T${time}:00Z`);
  return selected - businessNow >= RESERVATION_MIN_LEAD_HOURS * 60 * 60 * 1000;
}
