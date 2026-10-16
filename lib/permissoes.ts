// Dois níveis por enquanto. Os nomes antigos continuam compatíveis, sem
// promover contas em massa nem misturar cargo operacional com nível de acesso.
export const CARGOS_ADMINISTRATIVOS = ['admin', 'dono'] as const;
export const CARGOS_OPERACIONAIS = ['employee', 'gerente', 'receptionist', 'portaria'] as const;
export const CARGOS_PAINEL = [...CARGOS_ADMINISTRATIVOS, ...CARGOS_OPERACIONAIS];

const VISOES_OPERACIONAIS = new Set(['reservations', 'operations', 'new_reservation', 'checklist']);
const VISOES_ADMINISTRATIVAS = new Set([
  ...VISOES_OPERACIONAIS, 'restaurant', 'estabelecimento', 'decorations',
  'special_dates', 'blocked_dates', 'funcionarios', 'tarefas', 'produtividade', 'finance',
]);

export function ehAdministrador(cargo: string | null | undefined) {
  return CARGOS_ADMINISTRATIVOS.some((permitido) => permitido === cargo);
}

export function ehEquipeOperacional(cargo: string | null | undefined) {
  return CARGOS_PAINEL.some((permitido) => permitido === cargo);
}

export function podeAcessarVisao(cargo: string | null | undefined, visao: string) {
  if (ehAdministrador(cargo)) return VISOES_ADMINISTRATIVAS.has(visao);
  return ehEquipeOperacional(cargo) && VISOES_OPERACIONAIS.has(visao);
}

export function nomeNivelAcesso(cargo: string | null | undefined) {
  if (ehAdministrador(cargo)) return 'Administrador';
  if (ehEquipeOperacional(cargo)) return 'Funcionário';
  return cargo === 'customer' ? 'Cliente' : 'Sem acesso';
}
