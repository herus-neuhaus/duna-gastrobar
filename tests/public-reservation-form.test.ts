import { describe, expect, it } from 'vitest';
import { getReservationPayment, isValidReservationPaymentEmail } from '@/lib/reservation-payment';
import { getPublicReservationDateRange, getPublicReservationDates, hasReservationLeadTime, validatePublicReservationContact } from '@/lib/public-reservation-form';

const contact = { name: 'Cliente sintético', whatsapp: '(69) 91234-5678', cpf: '', email: '' };

describe('regras do formulário público', () => {
  it.each([1, 14])('não pede CPF para %i pessoas sem pagamento', (guests) => {
    const payment = getReservationPayment(guests, null);
    expect(payment).toEqual({ required: false, amount: 0 });
    expect(validatePublicReservationContact(contact, payment.required)).toEqual({});
  });

  it.each([15, 30])('pede CPF a partir de %i pessoas', (guests) => {
    const payment = getReservationPayment(guests, null);
    expect(payment).toEqual({ required: true, amount: 100 });
    expect(validatePublicReservationContact(contact, payment.required)).toHaveProperty('cpf');
  });

  it('pede CPF para data especial paga com menos de 15 pessoas', () => {
    const payment = getReservationPayment(2, { requires_fee: true, fee_amount: 75 });
    expect(payment).toEqual({ required: true, amount: 75 });
    expect(validatePublicReservationContact(contact, payment.required)).toHaveProperty('cpf');
  });

  it('preserva a precedência do preço de data especial', () => {
    expect(getReservationPayment(20, { requires_fee: true, fee_amount: 75 })).toEqual({ required: true, amount: 75 });
  });

  it('valida contato e CPF somente no fluxo correspondente', () => {
    expect(validatePublicReservationContact({ ...contact, name: ' ', whatsapp: '12' }, false)).toHaveProperty('name');
    expect(validatePublicReservationContact({ ...contact, whatsapp: '12' }, false)).toHaveProperty('whatsapp');
    expect(validatePublicReservationContact({ ...contact, cpf: '52998224725', email: 'guest@example.invalid' }, true)).toEqual({});
  });

  it.each(['', 'invalid', 'guest @example.invalid', `${'x'.repeat(49)}@example.invalid`])('exige e-mail válido de até 64 caracteres somente com pagamento: %s', (email) => {
    expect(validatePublicReservationContact({ ...contact, cpf: '52998224725', email }, true)).toHaveProperty('email');
    expect(validatePublicReservationContact({ ...contact, email }, false)).not.toHaveProperty('email');
  });

  it('aceita e-mail com espaços externos e não trunca o endereço no limite do provedor', () => {
    const email = `${'x'.repeat(48)}@example.invalid`;
    expect(email).toHaveLength(64);
    expect(isValidReservationPaymentEmail(email)).toBe(true);
    expect(isValidReservationPaymentEmail(`x${email}`)).toBe(false);
    expect(validatePublicReservationContact({ ...contact, cpf: '52998224725', email: ` ${email} ` }, true)).toEqual({});
  });

  it('oferece hoje e mais sessenta datas em Porto Velho, mesmo após meia-noite UTC', () => {
    const dates = getPublicReservationDates(new Date('2026-10-30T02:00:00Z'));
    expect(dates).toHaveLength(61);
    expect(dates[0]).toBe('2026-10-29');
    expect(dates[60]).toBe('2026-12-28');
    expect(dates).not.toContain('2026-12-29');
    expect(new Set(dates).size).toBe(61);
  });

  it.each([
    ['2026-12-31T16:00:00Z', '2026-12-31', '2027-03-01'],
    ['2028-02-28T16:00:00Z', '2028-02-28', '2028-04-28'],
  ])('mantém 61 datas consecutivas na virada de ano ou ano bissexto: %s', (instant, today, lastDate) => {
    const now = new Date(instant);
    expect(getPublicReservationDateRange(now)).toEqual({ today, lastDate });
    const dates = getPublicReservationDates(now);
    expect(dates).toHaveLength(61);
    expect(dates[0]).toBe(today);
    expect(dates[60]).toBe(lastDate);
    for (let index = 1; index < dates.length; index++) {
      expect(Date.parse(dates[index]) - Date.parse(dates[index - 1])).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('aceita exatamente duas horas e rejeita menos no fuso do restaurante', () => {
    const now = new Date('2026-10-29T16:00:00Z');
    expect(hasReservationLeadTime('2026-10-29', '14:01', now)).toBe(true);
    expect(hasReservationLeadTime('2026-10-29', '14:00', now)).toBe(true);
    expect(hasReservationLeadTime('2026-10-29', '13:59', now)).toBe(false);
    expect(hasReservationLeadTime('2026-10-29', '14:00', new Date('2026-10-29T16:00:00.001Z'))).toBe(false);
    expect(hasReservationLeadTime('', '', now)).toBe(false);
  });

  it('calcula a antecedência através da meia-noite e da virada do ano em Porto Velho', () => {
    const now = new Date('2027-01-01T03:00:00Z'); // 31/12 às 23h em Porto Velho.
    expect(hasReservationLeadTime('2027-01-01', '01:00', now)).toBe(true);
    expect(hasReservationLeadTime('2027-01-01', '00:59', now)).toBe(false);
    expect(hasReservationLeadTime('2026-12-31', '23:30', now)).toBe(false);
  });
});
