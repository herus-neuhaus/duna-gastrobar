import { describe, expect, it } from 'vitest';
import { buildDuplicateReservationMessage } from '@/lib/reservation-duplicate-message';

const reservation = {
  name: 'Ana da Silva',
  date: '2026-10-12',
  time: '19:00',
  guests: 3,
  existingTime: '18:00',
  existingGuests: 4,
};

describe('mensagens de reserva duplicada para WhatsApp', () => {
  it('monta pedido para acrescentar pessoas e não inclui CPF', () => {
    const message = buildDuplicateReservationMessage({ ...reservation, choice: 'add_to_existing' });

    expect(message).toContain('Ana da Silva');
    expect(message).toContain('12/10/2026');
    expect(message).toContain('18:00');
    expect(message).toContain('acrescentar mais 3 pessoas');
    expect(message).not.toMatch(/cpf|52998224725/i);
  });

  it('monta pedido para outra reserva separada e não inclui CPF', () => {
    const message = buildDuplicateReservationMessage({ ...reservation, choice: 'create_another' });

    expect(message).toContain('outra reserva separada');
    expect(message).toContain('às 19:00');
    expect(message).not.toMatch(/cpf|52998224725/i);
  });
});
