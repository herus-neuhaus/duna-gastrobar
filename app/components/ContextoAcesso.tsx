'use client';

import { createContext, useContext } from 'react';
import { ehAdministrador } from '@/lib/permissoes';

export const ContextoAcesso = createContext<string | null>(null);

export function useAcessoAdministrativo() {
  return ehAdministrador(useContext(ContextoAcesso));
}
