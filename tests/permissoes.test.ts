import { describe, expect, it } from 'vitest';
import { ehAdministrador, ehEquipeOperacional, podeAcessarVisao } from '@/lib/permissoes';

const sensiveis = ['finance', 'funcionarios', 'estabelecimento', 'restaurant', 'decorations', 'special_dates', 'blocked_dates', 'tarefas', 'produtividade'];
describe('níveis de acesso', () => {
  it.each(['admin', 'dono'])('%s tem acesso a todas as áreas', (cargo) => {
    expect(ehAdministrador(cargo)).toBe(true);
    for (const visao of [...sensiveis, 'operations', 'reservations', 'new_reservation', 'checklist']) expect(podeAcessarVisao(cargo, visao)).toBe(true);
  });
  it.each(['employee', 'gerente', 'receptionist', 'portaria'])('%s fica na operação, sem gestão ou financeiro', (cargo) => {
    expect(ehAdministrador(cargo)).toBe(false); expect(ehEquipeOperacional(cargo)).toBe(true);
    for (const visao of sensiveis) expect(podeAcessarVisao(cargo, visao)).toBe(false);
    for (const visao of ['operations', 'reservations', 'new_reservation', 'checklist']) expect(podeAcessarVisao(cargo, visao)).toBe(true);
  });
  it.each([null, 'customer', 'unknown'])('%s não recebe acesso interno', (cargo) => {
    expect(ehEquipeOperacional(cargo)).toBe(false); expect(podeAcessarVisao(cargo, 'operations')).toBe(false);
  });
});
