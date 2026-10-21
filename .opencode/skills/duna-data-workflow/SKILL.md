---
name: duna-data-workflow
description: Proponha, desenvolva localmente ou revise modelagem PostgreSQL/Supabase do Duna, relações, RLS, migrations e concorrência; use antes de alterações de dados persistentes, sem implantação automática.
---

# Dados: proposta, desenvolvimento e implantação são etapas distintas

Reutilize `supabase` para a plataforma e `supabase-postgres-best-practices` antes
de escrever/alterar SQL, modelagem, RLS, índices, funções ou seus testes. Leia só
as referências relevantes. Não reinstale, duplique ou edite essas skills.

Leia [base e limites locais](../../../docs/plano-1-banco.md),
[arquitetura](../../../docs/funcionalidades/arquitetura.md),
[permissões](../../../docs/funcionalidades/permissoes.md) e a sequência final de
migrations afetada. Tipos gerados são contrato, não prova do catálogo implantado.

## 1. Proposta — sem executar SQL

- Registre entidades, cardinalidades, invariantes, estados, acesso por ação,
  histórico e consumidores. Distinga reserva, mesa, atendimento, pagamento e crédito.
- Justifique tipos, nulabilidade, chaves, FKs, unicidade, checks e índices pelas
  consultas/regras reais. Não adicione extensões, tabelas ou abstrações especulativas.
- Avalie dados legados, compatibilidade, backfill, rollout, falha e reversão.
  Não altere identidade de turno ou valores históricos por configuração nova.
- SaaS não prova existência de tenant: investigue o modelo de estabelecimento;
  se houver, rastreie isolamento em relações, filtros, RLS e funções privilegiadas.

## 2. Desenvolvimento local — somente com escopo autorizado

- Inspecione os scripts antes de executá-los. Use o ambiente descartável dedicado,
  sem URL/credencial de produção; não use MCP remoto como substituto do banco local.
- A auditoria registra nomes antigos no runner/testes incrementais. Confirme e
  trate a pendência em tarefa própria antes de confiar nesse procedimento.
- Histórico local e remoto divergente exige reconciliação revisada. Não renomeie
  migrations aplicadas nem rode repair/reset/db push para fazer o teste passar.
- Gere novas migrations pelo mecanismo CLI aprovado após conferir `--help` e
  versão; teste reconstrução e atualização incremental válidas. Nunca aplique o
  bootstrap de reconstrução a um banco existente.
- Constraints/locks/transações protegem invariantes; teste duas sessões reais
  concorrentes em sandbox. Mocks ou busca textual de SQL não comprovam atomicidade.
- Em tabelas expostas, revise RLS, grants, policies e papéis negativos. Função
  privilegiada exige necessidade, guarda, `search_path` seguro e EXECUTE restrito.
- Regenere tipos pelo fluxo revisado; não edite o arquivo gerado manualmente.

## 3. Implantação remota — fora do fluxo automático

Os agentes Duna não têm ferramentas de mutação remota habilitadas por padrão.
Entregue plano com ambiente, precondições, diff, backup, verificação e reversão;
implantação depende de autorização específica e executor apropriado. Não peça
relaxamento de permissões só para terminar uma tarefa local.

Orientação genérica upstream sobre `execute_sql`, `.mcp.json` ou iteração de DDL
não autoriza operação remota nem mudança de configuração: OpenCode V2 usa
`mcp.servers`; preserve a configuração Supabase existente. Com MCP indisponível
no perfil, consulte documentação oficial via web permitida, não contorne o bloqueio.

Entregue proposta versus arquivos locais versus implantação **não realizada**,
testes executados, limites da evidência e riscos de migração/dados restantes.
