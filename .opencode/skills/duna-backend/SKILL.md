---
name: duna-backend
description: Implemente e revise Route Handlers Next.js do Duna, contratos, validação, autorização, erros, integrações e idempotência; use em mudanças de API ou regras de servidor.
---

# Backend Next.js do Duna

Leia a [arquitetura](../../../docs/funcionalidades/arquitetura.md), as
[permissões](../../../docs/funcionalidades/permissoes.md), o handler/helper e
testes existentes. Não introduza Laravel, ORM ou camada genérica de serviços.
Extraia helper apenas quando houver responsabilidade/reuso concreto.

## Contrato e fronteira confiável

1. Identifique método, ator, payload, resposta, efeitos e consumidores. Preserve
   códigos, campos e compatibilidade; mudança de contrato exige revisão explícita.
2. Valide formato e semântica no servidor: tipos, limites, enumerações, datas/fuso,
   identificadores, campos permitidos e combinações inválidas. Evite mass assignment.
3. Autentique e autorize cada ação/objeto antes de usar cliente privilegiado.
   Middleware, UUID, cargo operacional e botão oculto não são autorização.
4. Reutilize `lib/auth.ts` e clientes de `lib/supabase/` adequados ao fluxo. Regras
   por papel precisam refletir o domínio: `admin`, `dono` e `gerente` não são aliases.
   Chamadas diretas do navegador também dependem de RLS/grants.
5. Confirme isolamento por estabelecimento onde houver esse modelo; não declare
   multi-tenancy seguro sem rastrear vínculo e consultas. Negue acesso cruzado.
6. Mantenha invariantes concorrentes na transação/constraint/RPC apropriada.
   Disponibilidade consultada antes da gravação não evita corrida. Para SQL,
   carregue `duna-data-workflow` e as skills Supabase pertinentes.
7. Erros públicos úteis sem detalhes SQL, tokens ou PII. Registre diagnóstico
   mínimo seguro; respostas sensíveis não devem ter cache compartilhado indevido.

## Integrações e financeiro

Consulte [pagamentos](../../../docs/funcionalidades/pagamentos-e-financeiro.md)
e confirme no código as partes desatualizadas. Carregue `supabase` para trabalho
de integração Supabase, preservando o workflow local/remoto do Duna.

- Valor/finalidade do pagamento vêm da regra confiável, não do body do cliente.
- Diferencie status de reserva, pagamento e tentativa. Não reative reserva ou
  converta taxa em consumo sem regra aprovada.
- Defina idempotência por operação: chave, escopo, repetição, eventos duplicados,
  entrega fora de ordem e falha entre chamada externa e persistência.
- Verifique autenticação/validação do provedor e timeout/retry segundo contrato
  atual; não assuma que upsert torna todos os efeitos idempotentes.
- Nunca efetue cobrança real para validar mudança; use mocks e sandbox autorizado.

## Aceite técnico

Teste autorizado/negado, entradas inválidas, estado esperado, conflito e repetição.
Mocks não comprovam comportamento de RLS/locks: indique integração local necessária.
Atualize contrato/documentação de domínio quando mudar comportamento. Entregue
evidências e falhas restantes; testes indisponíveis não podem virar aprovação.
