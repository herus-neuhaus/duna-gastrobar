---
name: duna-quality-security
description: Revise independentemente mudanças do Duna com evidências de testes, autorização, dados, financeiro, concorrência, regressão e acessibilidade; use antes de considerar uma implementação concluída.
---

# Revisão independente e verificável

Leia critérios aprovados, diff/arquivos, testes e consumidores. Consulte
[permissões](../../../docs/funcionalidades/permissoes.md) e o domínio afetado.
Não altere o objeto da revisão nem aprove apenas por compilação.

## Plano proporcional ao risco

1. Mapeie critério → implementação → teste/evidência → lacuna. Identifique testes
   existentes e os que precisam ser criados pelo implementador.
2. Diferencie unidade (helpers/transições), integração de rota, PostgreSQL real
   (RLS/constraints/locks), provedor sandbox e navegador (interação/visual).
3. Inspecione scripts e destino antes de executar comandos permitidos. Use dados
   sintéticos e mocks; testes podem escrever artefatos. Não use produção, contas,
   cobranças ou ferramentas remotas como teste de permissão.
4. Execute verificações locais autorizadas e registre comando/resultado. Testes
   de banco dependem do fluxo isolado revisado; consulte `duna-data-workflow`.
5. Não conte `TODO` falho como caso aprovado, nem teste textual como evidência de
   concorrência. Avalie assertions, falsos positivos, relógio e casos de fronteira.

## Checklist de risco

- Auth versus autorização por papel, ação, objeto e estabelecimento quando houver;
  chamadas diretas sem UI, troca forçada de senha e acesso cruzado/IDOR.
- Cliente privilegiado, RLS/grants/funções, dados expostos, entrada permitida,
  mass assignment, mensagens de erro, logs, tokens e retenção de PII.
- Repetição, disputa concorrente, rollback, retries, ordem de eventos e atualização
  de reserva/mesas/capacidade/pagamento sem estados intermediários inconsistentes.
- Financeiro: valor e finalidade, unidade monetária do contrato, idempotência,
  cancelamento/pagamento tardio, falha parcial e duplicidade de crédito/baixa.
- Regressões em consumidores de helpers/primitives, contratos e dados legados.
- UI: loading, vazio, erro, sucesso, sem permissão; teclado, foco, labels,
  responsividade e contraste quando houver inspeção renderizada.
- Performance demonstrável: consultas/listas sem limite, N+1, índices necessários
  e renders; não recomende otimização especulativa por contagem isolada.

## Relatório obrigatório

Achados: **crítico** (comprometimento/perda grave), **alto** (falha importante),
**médio** (impacto limitado ou recorrente), **baixo** (menor impacto). Para cada
um, dê evidência por arquivo/linha quando útil, cenário, impacto e correção sugerida;
distinga confirmado de hipótese. Preferência estética não é vulnerabilidade.

Sempre termine com: **o que foi verificado**, **como**, **o que falhou**,
**o que não foi possível verificar** e **riscos restantes**. Se não houver
achados, diga isso com limites; não conclua segurança absoluta ou UI testada
sem execução. Recomende correções ao implementador e nova revisão do que mudar.
