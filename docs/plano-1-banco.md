# Plano 1 — base verificável do banco

Inspeção e execução: **2026-10-03**. Escopo: reconstrução isolada, migrações,
contratos TypeScript e validação dos mecanismos existentes.

## Fonte de verdade e ambiente

São três fontes distintas:

1. **Aplicação:** Next.js 15, React 19, TypeScript 5.9; APIs em `app/api/`.
2. **Histórico versionado:** 19 arquivos em `supabase/migrations/`, iniciando em
   setembro. Sozinhos não criavam um banco vazio.
3. **Banco observado:** projeto Supabase `gnakcuvfxltbgpssirpv`, PostgreSQL 17.6,
   banco `postgres`. A URL configurada na aplicação corresponde ao projeto MCP.
   Foi tratado como **produção**, não como homologação. A inspeção usou o papel
   `postgres`, exclusivamente para leitura de metadados.

O catálogo observado é a referência para o esquema existente; os tipos não são
prova de existência. `supabase/inspection/catalog.sql` e
`observed-2026-10-03.json` registram a comparação sem registros de negócio.
Não foram exportados clientes, pagamentos, identidades, hashes de tokens de
reservas ou credenciais. Logs foram consultados apenas de forma agregada.
Nenhum DDL, reset, alteração de histórico ou rotina de expiração foi executado
no banco remoto. Não houve chamada ao Pagar.me, commit ou deploy.

Não foi encontrado `AGENTS.md` aplicável. Docker estava disponível; CLI Supabase
foi executada por `npx`, versão fixada em **2.119.0**. Não havia `psql` no host,
senha/URL de conexão PostgreSQL nem token CLI nas variáveis de ambiente
inspecionadas. O MCP forneceu acesso suficiente ao catálogo e ao histórico.
As instruções oficiais Supabase foram instaladas/lidas em `/tmp/opencode`, fora
do projeto. A documentação atual do CLI e changelog também foi consultada.

## Reconstrução isolada

### Requisitos

- Node.js 22+ (executado com 22.23.1), npm e Docker em funcionamento.
- Portas locais 55430–55432 disponíveis; acesso ao npm e ao registro das imagens
  Supabase na primeira execução.
- Recursos para PostgreSQL e Auth. A configuração de teste não inicia a API
  Next.js nem os serviços de pagamento, e não é uma stack E2E de navegador.
- A stack CLI é de desenvolvimento e pode publicar portas em todas as interfaces;
  use máquina/rede isolada de desenvolvimento e encerre ao terminar.

```bash
npm ci
npm run db:start
npm run db:compare
npm run db:types:check
npm run typecheck
npm run lint
npm test
npm run test:db
```

`db:start` monta uma cópia de trabalho em `.local-db/` (ignorada pelo Git), usando
`supabase/local.config.toml`, com projeto fixo `duna-plan1-isolated`.
A primeira migração **somente nessa cópia** é
`20260901000000_local_prerequisites.sql`, proveniente de
`supabase/bootstrap/prerequisites.sql`; depois vêm os 19 arquivos versionados em
ordem lexicográfica. O identificador sintético não representa uma versão remota.

O bootstrap foi composto a partir de definições autorizadas do catálogo e do
histórico (`initial_schema`, definição antiga de capacidade, RPC de busca e módulo
de tarefas). Inclui as tabelas/colunas legadas, funções, trigger de capacidade,
triggers de perfil/Auth e event trigger de RLS necessários à sequência existente.
Não é apresentado como dump histórico byte a byte. As políticas antigas permissivas
não são restauradas: RLS nega acesso até as migrações existentes instalarem as
políticas finais. Grants reproduzem os observados; não foram abertos acessos para
fazer testes passarem. Não há sementes de identidades administrativas reais.

O Auth local precisa estar habilitado para instalar seu esquema completo; apenas
o PostgreSQL inicial do CLI não contém todos os campos de `auth.users`. Os testes
criam usuários sintéticos diretamente no banco, em transações revertidas.

Para reconstruir novamente **somente esse ambiente descartável**:

```bash
npm run db:stop
npm run db:start
```

`db:stop` usa `stop --no-backup`: descarta os dados do projeto local dedicado.
`db:start` sozinho não reaplica arquivos em um banco já iniciado. Depois de mudar
bootstrap/migrações, use a sequência acima. Os scripts não carregam `.env`, não
aceitam URL remota e não vinculam projeto remoto. Os testes verificam o
`system_identifier` do endpoint TCP contra o container dedicado e a presença do
bootstrap antes de escrever. Dados sintéticos são removidos pelos IDs criados;
se houver interrupção, reconstrua o ambiente descartável.

### Tipos

```bash
npm run db:types
npm run typecheck
npm run db:types:check
```

Os tipos são gerados pelo CLI **a partir do esquema local executado**, com
`gen types typescript --local --schema public`, e formatados pelo printer do
TypeScript já instalado. Não editar o arquivo gerado manualmente.
`db:types:check` compara a saída exata do mesmo gerador, sem alterar arquivos.
Os quatro clientes Supabase agora usam `Database`; APIs administrativas deixam
de operar com cliente sem contrato de esquema. O gerador representa parâmetros
RPC opcionais com `undefined`, portanto `p_assigned_by` é omitido quando não há
ator (o default SQL continua sendo `NULL`). Campos nulos de datas especiais são
normalizados na apresentação. Não foram introduzidos `any` ou casts amplos.

### Variáveis da aplicação (nomes, sem credenciais)

Os testes de banco e de unidade não precisam dos valores da aplicação:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` ou fallback `SUPABASE_SERVICE_ROLE_KEY`
- `PAGAR_ME_SECRET_KEY`, `PAGAR_ME_ID_CONTA`
- `RESERVATION_RECOVERY_SECRET`, `RESEND_API_KEY`,
  `RESERVATION_RECOVERY_FROM_EMAIL` para a recuperação atualmente por e-mail.

Não usar as configurações de produção para testes. Os testes PIX existentes usam
mocks; o teste SQL de pagamento só altera registros sintéticos. A stack deste
plano não disponibiliza todo o conjunto de serviços para `npm run dev`/E2E.

## Bootstrap versus atualização incremental

**Banco novo isolado:** bootstrap + sequência versionada, como acima.

**Banco existente:** não executar o bootstrap, não reaplicar os arquivos históricos
e não executar `db push` sobre a pasta atual sem reconciliar seu histórico.
Há timestamps locais que não correspondem aos remotos, além de migrações antigas
com DML de identidades que não devem ser reproduzidas.

As duas correções históricas deste plano foram escolhidas **depois de consultar o
histórico aplicado**:

1. `20260909031500`: `DROP POLICY IF EXISTS` antes de recriar a mesma política
   `USING(false) WITH CHECK(false)`, dentro da transação. O arquivo local anterior
   já a incluía; a migração remota `20260909022933` não a incluía, e a
   `20260909024121` a criou uma única vez. A reconstrução passa sem duplicação.
2. `20260909021204`: regex de WhatsApp com uma barra (`\D`) em vez de duas.
   A definição observada em produção, já aplicada nessa versão, contém uma barra.
   A divergência local admitia duplicidade do mesmo telefone com outra formatação.
   A correção restaura o comportamento do banco observado, não uma nova regra.

**Não há correção remota necessária para esses dois pontos:** a política remota já
existe corretamente e a função remota já normaliza o telefone. Não é necessário
nem correto reaplicar esses arquivos em produção.

**Caminho incremental explícito para próximas mudanças:** criar uma nova migração
com versão posterior ao último histórico remoto, aplicar e testar sobre esta base
isolada, comparar catálogos e revisar o diff. Na implantação autorizada, selecionar
somente essa nova migração e suas precondições, por migração individual controlada;
não enviar toda a pasta histórica. Antes de automatizar `db push`, reconciliar
localmente versões/conteúdos com a matriz abaixo e revisar separadamente qualquer
`migration repair` necessário. Nenhum repair ou deploy foi feito neste plano.
Para um outro banco existente que não corresponda ao catálogo observado, produzir
uma migração aditiva específica após nova inspeção, não aplicar o bootstrap.

### Mapa de versões divergentes

| Arquivo local (prefixo) | Versão remota / observação |
|---|---|
| `20260909030000` operações | `20260909022933` |
| `20260909031500` hardening | `20260909024121` |
| `20260909035000` btree_gist | `20260909024758` |
| `20260909040000` mesas | `20260909024850` |
| `20260909040500` correção mesas | `20260909025158` + `20260909025236`; resultado final de alocação equivalente |
| `20260909041000` índice ator | `20260909030051` |
| `20260909050000` operação diária | `20260909030542` |
| `20260909051000` walk-ins | `20260909031120` |
| `20260909052000` índice fila | `20260909032149` |
| `20260909053000` decoração | `20260910012742` |

As nove versões locais anteriores a operações têm timestamps presentes no remoto.
O histórico remoto tem **32 versões**: inclui 12 anteriores à primeira local e a
correção extra de lock de mesas. As 12 antigas são: `initial_schema`, quatro
revisões de capacidade/status, `create_whatsapp_templates_table`, `add_search_rpc`,
`full_narnia_schema_migration_final`, `fix_narnia_admin_identity_v3`,
`allow_more_user_roles`, `add_tasks_module`, `grant_permissions_roles`.
Correspondência por nome não foi tomada como igualdade de SQL; o catálogo final
foi comparado separadamente.

## Comparação e evidências

`npm run db:compare` consulta apenas o container local e compara com os fingerprints
da inspeção remota de 2026-10-03. Não consulta produção de novo automaticamente.

- **Iguais:** colunas/tipos/defaults/nulabilidade, constraints, índices, políticas,
  triggers de aplicação/Auth, RLS/grants de tabelas e contratos das 33 funções
  próprias de `public`/`private`.
- **31 corpos de função iguais** após normalização de espaços/caixa.
- **Duas diferenças revisadas:** qualificação de colunas com aliases em
  `get_reservation_occupancy_window`; ponto e vírgula final do corpo de
  `validate_reservation_schedule`. Pares exatos de hashes e justificativas ficam
  em `reviewed-body-differences.json`; qualquer mudança diferente falha o comando.
- Fingerprints são auxiliares de inspeção, não provas de equivalência semântica;
  a normalização não é parser SQL. Os comportamentos críticos têm testes separados.
- O catálogo comparado não inclui configuração gerenciada completa de Auth,
  Storage, extensões do provedor ou conteúdo das tabelas de configuração.
- PostgreSQL local é **17.11** (imagem CLI `17.11.0.002`), remoto **17.6**. Isso não
  foi tratado como identidade integral de ambientes nem como autorização de upgrade.

### Diferenças código / histórico / banco encontradas

| Tema | Aplicação / arquivos anteriores | Banco observado |
|---|---|---|
| Base inicial | Tabelas/funções referenciadas sem criação local | Objetos existem; histórico anterior recuperável parcialmente por catálogo/DDL |
| Política recovery | Criação repetida em dois arquivos | Uma política; criação só na segunda migração aplicada |
| Capacidade | Função versionada; trigger ausente do histórico local | `enforce_daily_capacity` habilitado, BEFORE INSERT OR UPDATE |
| Capacidade comercial | APIs e função usam total diário | 80 **por dia**, incluindo walk-ins e estados concluídos; não 80 por turno |
| Expiração | Função só referenciada, sem definição/agendamento local | Rotina existente e job ativo `*/5 * * * *` |
| Realtime | Aplicação assina `postgres_changes` | Nenhuma tabela publicada em `supabase_realtime` |
| Tipos | Faltavam tabelas operacionais, RPCs, campos e nulabilidade | 20 tabelas públicas; tipos agora gerados dessa estrutura validada |
| Telefone | SQL local escapava regex duas vezes | Função de capacidade remota usa uma barra |

O bootstrap reproduz a **definição** da rotina de expiração, mas não inicia o cron.
O job observado executa `release_expired_reservations()` a cada cinco minutos.
A função cancela `pending` com `check_in_status='pending'`, tipo `mesa/camarote`,
após 23:30 da data, e acrescenta uma nota; não consulta `expires_at` nem
`payment_status`. A sessão/timezone afeta a comparação com `NOW()`. Nenhuma
execução dessa rotina foi solicitada no banco remoto.

## Testes e resultados

O teste antigo de disponibilidade falhava porque 10/09/2026 já estava no passado.
Foi fixado o relógio do teste em 09/09/2026, restaurando-o ao terminar. Nenhum
comportamento da API foi alterado para resolver essa falha.

Resultados finais estão registrados abaixo. A suíte PostgreSQL
usa `node:test` + `pg@8.20.0` (tornado dependência direta de desenvolvimento;
essa versão já estava no lockfile como dependência transitiva),
sem serviços externos. Cada disputa abre duas conexões/transações independentes
e comprova espera usando `pg_blocking_pids` antes de liberar o vencedor.

Cobertura comportamental:

- Capacidade concorrente (50 + 40), estados/turnos atualmente contabilizados,
  cancelamento liberando capacidade, constraints de convidados/status.
- Decoração no mesmo período, almoço versus jantar e liberação por cancelamento.
- Conflito real `23P01` de mesas, rollback da alocação perdedora e liberação terminal.
- Transições permitidas/proibidas, timestamps, eventos e disputa de estado esperado.
- Anônimo e cliente autenticado sem leitura direta, funcionário com leitura,
  RPC negada a papéis públicos, token incorreto rejeitado e correto aceito.
- Pagamento **sintético**: valor exato, confirmação e idempotência da função SQL.
- Normalização de telefone, com formatos diferentes do mesmo número sintético.

Os testes antigos que procuram texto SQL continuam como verificações estruturais;
não são apresentados como evidência de concorrência PostgreSQL.

### Registro da execução

| Comando / verificação | Resultado |
|---|---|
| `git status --short` inicial | Limpo |
| MCP: catálogo, histórico, funções, RLS, índices, triggers, cron e publicação | Inspecionados, somente leitura |
| MCP: logs agregados e advisors security/performance | Consultados; achados externos abaixo |
| `npx tsc --noEmit` inicial | Passou; clientes ainda não parametrizados |
| `npm test` inicial | 24 passaram, 1 falhou por relógio/data passada |
| `npm run lint` inicial | 0 erros, 10 avisos |
| `npm run db:start` | Bootstrap + 19 migrações executados do zero, sem política duplicada |
| `npm run db:stop` → `npm run db:start` | Reconstrução repetida após ajustes; esquema Auth completo incluído |
| `npm run db:types` | Arquivo gerado do banco isolado |
| `npm run db:compare` final | 6 categorias iguais, 33 contratos de funções iguais, 2 diferenças de corpo revisadas, nenhuma diferença não revisada |
| `npm run db:types:check` final | Tipos iguais à geração do esquema executado |
| `npm run typecheck` final | Passou, incluindo APIs e quatro clientes tipados |
| `npm run lint` final | 0 erros, os mesmos 10 avisos anteriores (imagens e dependência de hook) |
| `npm test` final | 25 testes passaram, 13 arquivos |
| `npm run test:db` final | 12 casos executados: 10 passaram, 2 reproduções conhecidas falharam como `TODO` |
| `git diff --check` | Passou |
| `npm run db:stop` ao finalizar | Stack local encerrada e dados sintéticos descartados |

Durante a construção da suíte houve dois erros de preparação local: um parâmetro
SQL reutilizado como UUID/texto (fixture corrigida) e o esquema Auth incompleto
quando o serviço estava desabilitado (configuração corrigida e banco reconstruído).
Não foram interpretados como falhas de produção. A primeira tentativa de gerar
tipos também foi interrompida por uma linha em branco na saída do CLI; o script
agora normaliza o início antes de validar e formatar a saída.

### Arquivos e justificativas

- `supabase/bootstrap/prerequisites.sql`, `supabase/local.config.toml`,
  `scripts/local-db.mjs`: reconstrução isolada sem reaplicar histórico em produção.
- Duas migrações históricas citadas acima: correções de reconstrução justificadas
  pelo histórico e catálogo remotos.
- `supabase/inspection/*`, `scripts/compare-db-catalog.mjs`: evidência versionável
  de catálogo, diferenças revisadas e detecção de divergências posteriores.
- `lib/supabase/database.types.ts`: geração integral do esquema executado;
  `admin.ts`, `client.ts`, `server.ts`, `middleware.ts`: uso efetivo do contrato.
- `app/admin/SpecialDatesManager.tsx`: normalização explícita de campos nulos.
- `app/api/admin/operations/route.ts`,
  `app/api/admin/reservations/[id]/tables/route.ts`: uso do default SQL para ator
  ausente, compatível com o contrato gerado.
- `tests/database/current-mechanisms.test.mjs`: testes comportamentais PostgreSQL.
- `tests/reservation-availability-route.test.ts`: relógio determinístico.
- `package.json`, `package-lock.json`: comandos verificáveis e driver PostgreSQL
  direto, fixado na versão previamente existente na árvore.
- `.gitignore`: artefatos CLI/stack descartável;
  `README.md` e este documento: ambiente, comandos, estratégia e relatório.

**Situação do Plano 1: concluído no escopo técnico, com pendências fora de escopo
explicitadas.** Reconstrução e verificações essenciais não ficaram bloqueadas.
Isso não significa ausência de defeitos comerciais nem validação E2E do sistema.

### Reproduções fora de escopo

Os testes `OUT-01` e `OUT-02` são **executados** e sinalizados `TODO`, não ignorados.
O runner pode sair com código zero mesmo apresentando esses dois `not ok # TODO`;
isso não significa que os defeitos foram corrigidos. A regra não foi alterada.

| ID | Reprodução sintética / evidência | Impacto | Destino |
|---|---|---|---|
| OUT-01 | Criar reserva 12h, alocar mesa, atualizar para 18h; comparar `assignment.starts_at` com RPC de janela: diferentes | Mesa continua ocupada no horário antigo; disponibilidade incorreta | Plano de mesas/operação; priorizar no Plano 2. O trigger BEFORE consulta a linha antiga |
| OUT-02 | Criar 14 convidados sem taxa; RPC de alteração para 15; `payment_status` continua `not_required` | Aumento contorna a cobrança futura aprovada | Plano de regras financeiras, expressamente posterior |
| EXT-01 | Inspeção do cron + definição da função; em sandbox uma reserva pendente tipo mesa de data anterior é elegível ao cancelamento de 23:30 | Política de cancelamento automática diverge da orientação futura de contato da equipe; não é expiração PIX por `expires_at` | Plano de estados/expiração/financeiro; rever cron e fuso antes de alterar |
| EXT-02 | `pg_publication_tables` para `supabase_realtime` vazio; UI assina mudanças | Atualizações de reservas podem depender de refresh em vez de Realtime | Plano de operação; validar entrega em homologação e preparar migração incremental autorizada |

As regras atuais serão substituídas pelos planos aprovados: capacidade por turno,
horizonte de 10 dias, confirmação automática sem taxa, cobrança no aumento de grupo,
tratamento de expiração/atraso e comunicação WhatsApp. Nenhuma delas foi antecipada.

## Verificações externas e próximos passos

- Antes do próximo deploy, confirmar projeto/ambiente no pipeline e reconciliar a
  matriz de versões; não usar o timestamp local como prova de migração pendente.
- Homologação não foi disponibilizada. E2E de Auth/Storage/Realtime/navegador e
  integração Pagar.me sandbox precisam de ambiente/configuração próprios; nenhum
  pagamento real deve ser usado. Os testes PostgreSQL essenciais foram executados.
- Os tipos do gerador não garantem nulabilidade de valores calculados retornados
  por RPCs; mantêm-se verificações de resultado vazio nas APIs.
- Advisors remotos: proteção de senhas vazadas desabilitada; 5 avisos de initplan
  em RLS, 14 de políticas permissivas sobrepostas e 16 índices sem uso observado.
  Não remover índices por esse indicador isolado. Referências de remediação:
  [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
  [initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan),
  [políticas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies),
  [índices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- A instalação de `pg` reportou 45 avisos de vulnerabilidade na árvore total
  (1 baixo, 15 moderados, 26 altos, 3 críticos). Não houve atualização ampla nem
  `audit fix`; classificação de explorabilidade/remediação exige tarefa própria.
- Plano 2: usar esta suíte como linha de base, acrescentar casos das regras futuras,
  resolver OUT-01 antes de confiar em reagendamento/alocação e tratar OUT-02 junto
  da política de taxas. Mudanças futuras devem ter migrações incrementais novas.
