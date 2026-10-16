# Permissões e segurança

## Camadas

1. **Auth** identifica usuário/sessão Supabase.
2. **Redirecionamento de rota** em `lib/route-access.ts`/middleware encaminha papéis para áreas apropriadas; redirecionamento não substitui autorização.
3. **Route Handler** valida sessão e papel (`lib/auth.ts`) ou token de acesso de cliente.
4. **RLS e grants** controlam operações feitas diretamente com `supabase-js` e limitam clientes não confiáveis.
5. **RPCs/triggers/constraints** validam transições, concorrência e regras críticas no banco.
6. **Admin client/service role** contorna RLS; só deve ser utilizado no servidor após verificação explícita da permissão e validação dos dados.

## Regra atual: dois níveis de acesso

Administrador pode acessar todas as áreas e ações, sempre respeitando validação,
auditoria e regras de integridade. Funcionário fica em reservas, operação do dia,
criação de reservas e checklist. Não vê configuração do estabelecimento,
financeiro completo, gestão de equipe, cadastros ou produtividade da equipe.

O cadastro detalhado de papéis fica para uma etapa posterior. `lib/permissoes.ts`
centraliza a matriz para menus, rotas e helpers de servidor. A migração
`20261016041810_alinhar_acessos_administrador_operacao.sql`, aplicada no Supabase
remoto com autorização, alinha RLS e RPCs à mesma regra. Contas
antigas não são promovidas automaticamente.

O deploy do frontend/servidor é separado da migração: enquanto o código antigo
estiver publicado, menus e handlers antigos ainda podem ter a matriz anterior.

## Compatibilidade dos cargos existentes

| Papel | Acesso de rota / helper observado |
|---|---|
| `admin` | Administrador com acesso completo, inclusive estabelecimento, financeiro, permissões e exceções auditadas. |
| `dono` | Alias legado de Administrador, sem perder acessos existentes. |
| `gerente`, `receptionist`, `portaria` | Funcionários operacionais; não recebem gestão ou financeiro apenas por esses nomes antigos. |
| `employee` | Funcionário com operação e checklist, sem áreas administrativas. |

`isAdmin()`, `isFinanceStaff()` e o helper legado `isReservationOwner()` aceitam
`admin` e `dono`. `isPanelStaff()` inclui todos os cargos internos, mas nenhum
helper libera ações enquanto há troca obrigatória de senha. O banco usa o cargo
em `profiles`, nunca `user_metadata` editável pelo próprio usuário.

Alterações de nível ficam em `alteracoes_cargos`. Não é permitido alterar o
próprio acesso nem remover/desativar o último administrador pelo fluxo da API.

Validação local (executar as suítes de banco sequencialmente):

```sh
npm run db:apply:acessos
npm run test:db:acessos
npm run test:db:estabelecimento
npm run test:db
```

## Endpoints com controles explicitamente observados

- Financeiro: `GET /api/admin/finance` exige Administrador. A leitura direta de `reservation_payments` também é administrativa; informações de cobrança necessárias ao atendimento permanecem na reserva operacional.
- Áreas/mesas: `/api/admin/restaurant` exige Administrador. Em decorações, a consulta aceita equipe para criar reservas; inclusão, alteração e exclusão exigem Administrador.
- Criação de funcionário: `POST /api/admin/employees` exige `isAdmin()` e allowlist de cargos (`admin`, `employee`); cargo operacional só pode ser atribuído a `employee`.
- Permissões excepcionais de capacidade: GET/POST em `/api/admin/capacity-permissions` exigem Administrador; a gravação usa RPC com sessão e nova validação no banco. Funcionários só recebem exceção de capacidade mediante concessão explícita e auditada, nunca por padrão.
- Operação e atribuição de mesas: GET/POST em `/api/admin/operations` e GET/PUT de `/api/admin/reservations/:id/tables` exigem `isPanelStaff()`; classificação histórica exige Administrador. Walk-in/classificação usam RPC com sessão.
- Reserva do cliente: GET usa token bearer comparado por hash no RPC; PATCH permite token para cancelamento/edição pública e exige equipe para demais ações. Exceções de agenda/capacidade têm validações adicionais no banco.
- Troca de senha: `POST /api/account/password` exige usuário autenticado e atualiza o perfil pelo ID dessa sessão.

### Inventário dos usos de `createAdminClient()`

`createAdminClient()` usa a chave privilegiada e contorna RLS. A tabela registra a barreira observada antes do uso; fluxos públicos são intencionais, mas dependem das credenciais específicas descritas.

| Handler / método | Barreira observada antes da operação privilegiada | Uso privilegiado e observação |
|---|---|---|
| `/api/admin/finance` GET | `isFinanceStaff()` (Administrador). | Consulta pagamentos e reservas. |
| `/api/admin/capacity-permissions` GET | `isReservationOwner()` (Administrador, nome legado). | Consulta perfis, permissões e auditorias; POST usa RPC com cliente de sessão, não grava com service role. |
| `/api/admin/operations` GET/POST | `isPanelStaff()`; classificar reserva histórica também exige Administrador. | Consulta operação e altera fila com service role; walk-in/classificação chamam RPC com sessão. No walk-in, atribuição de mesas usa service role após o guard de equipe. |
| `/api/admin/reservations/:id/tables` GET/PUT | `isPanelStaff()`. | Consulta e substitui atribuições via RPC privilegiado; a regra final fica na função SQL. |
| `/api/admin/restaurant` GET/POST/PATCH | `isAdmin()` em cada método. | Leitura e cadastro/ativação de áreas e mesas. |
| `/api/admin/employees` POST | `isAdmin()` antes de criar usuário; allowlist de papel/cargo. | Supabase Auth Admin e upsert do perfil. |
| `/api/admin/decorations` GET/POST/PATCH/DELETE | GET: `isPanelStaff()`; mutações: `isAdmin()`. | CRUD de metadados e Storage; upload valida tipo e tamanho. |
| `/api/account/password` POST | `auth.getUser()`; perfil alterado apenas no `user.id` autenticado, após troca da senha. | Usa service role apenas para limpar `force_password_change`. |
| `/api/reservations` POST | Criação pública por desenho; valida payload e regras. `isPanelStaff()` só autoriza janela estendida; exceções exigem painel e passam por RPC com sessão/banco. | Caminho público insere reserva com service role; não confundir ausência de login do cliente com ausência de validação de domínio. |
| `/api/reservations/availability` GET | Público; intervalo e horizonte limitados, resposta de disponibilidade. | Consulta RPC e datas por service role; dados retornados são disponibilidade pública. |
| `/api/decorations` GET | Público; lista apenas decoração ativa e disponibilidade. | Leitura privilegiada filtrada antes de responder. |
| `/api/reservations/:id` GET/PATCH | GET exige token bearer cuja hash é validada por RPC. PATCH usa token para ações públicas específicas ou `isPanelStaff()` para ações de equipe. | RPCs de acesso/status e atualizações privilegiadas; não autoriza por UUID isolado. |
| `/api/reservations/recovery` POST/PATCH | Público; código + e-mail normalizado/hash e challenge validados por RPC; POST trata rate limit do RPC. | Consulta dados para emissão de desafio e emite credenciais apenas após RPC de conclusão. |
| `/api/payments/pix` POST | Público; token de reserva validado por hash, CPF, status e valor pendente. | Cria/atualiza pedido e registros de pagamento após validação. |
| `/api/pagarme/webhook` POST | Evento `order.paid`, conta comparada se configurada e pedido consultado diretamente no Pagar.me com credencial do servidor; confere finalidade, reserva e valor. | Atualiza pagamento e chama RPC de conclusão. A validação observada é consulta autenticada ao provedor, não assinatura do corpo do webhook. |

**Diferença intencional entre API e acesso direto:** a regra de negócio confirmada pelo responsável permite que `receptionist` e `portaria` consultem/alterem reservas e lista de espera. Os handlers correspondentes verificam `isPanelStaff()`; a operação da fila usa service role. A policy `Managers can manage waitlist` em `20260909050000_daily_operations.sql` continua mais restrita para acesso direto à tabela, que não herda a permissão do handler. Manter testes por papel/ação para garantir essa fronteira.

Consultar cada `route.ts` antes de mudar a matriz: uma lista completa de acessos por ação depende de combinar handler, RLS e SQL.

## RLS e funções

### Evidência nas migrations rastreadas

Esta matriz resume policies e comandos `ENABLE ROW LEVEL SECURITY` encontrados no histórico local de `supabase/migrations`. **Ela não confirma o estado do banco implantado**: policies só são aplicadas quando RLS está habilitado, e alterações fora deste histórico podem existir.

| Tabelas acessadas pelo navegador | Evidência local encontrada | Limite da evidência |
|---|---|---|
| `employee_roles` | RLS habilitado em `20260904000331_harden_rls_and_database_functions.sql`; `Managers can manage employee roles` dá acesso total somente a `private.is_manager()`. | Não há policy de leitura para funcionário comum nessa migration; validar se outras migrations/estado-base complementam isso. |
| `task_categories` | RLS habilitado; `Managers can manage task categories`. | Policy encontrada é exclusiva para managers. |
| `tasks` | RLS habilitado; managers podem gerenciar; `Employees can read assigned tasks` restringe leitura por `private.can_access_task(...)`. | A UI ainda filtra data/recorrência em JavaScript. A policy documentada restringe atribuição, mas não a data da tarefa; verificar se a exposição de tarefas atribuídas fora do dia é aceitável. |
| `task_completions` | RLS habilitado; managers podem gerenciar; funcionário lê conclusões próprias, inicia tarefa atribuída e atualiza conclusão própria em andamento, com checks de funcionário/status e `private.can_start_task(...)`. | Confirmar no schema efetivo e testar as transições, inclusive tentativas de alterar linha/campos alheios. |
| `profiles` | Policies encontradas: leitura própria, gestão por manager e atualização do próprio perfil. Há trigger contra mudança própria de papel/cargo; migrations posteriores endurecem a mudança de papel `dono`. | **Não foi encontrado `ENABLE ROW LEVEL SECURITY` para `profiles` nas migrations rastreadas.** Se RLS estiver desligado no banco, as policies não protegem acesso direto. O trigger não substitui RLS. |
| `special_dates` | Leitura pública e gestão por manager. | **Não foi encontrado `ENABLE ROW LEVEL SECURITY` para esta tabela nas migrations rastreadas.** Escritas do painel dependem criticamente do estado efetivo de RLS. |
| `blocked_dates` | Leitura pública e gestão por manager. | **Não foi encontrado `ENABLE ROW LEVEL SECURITY` para esta tabela nas migrations rastreadas.** Escritas do painel dependem criticamente do estado efetivo de RLS. |
| `whatsapp_templates` | Policy de gestão total por manager. | **Não foi encontrado `ENABLE ROW LEVEL SECURITY` para esta tabela nas migrations rastreadas.** A policy, isoladamente, não comprova proteção. |

As funções `private.can_access_task` e `private.can_start_task` são usadas pelas policies do checklist; a migração `20260904000739_move_rls_helpers_to_private_schema.sql` moveu helpers para o schema `private`. Para `profiles`, há ainda a migration `20261010181221_assign_finance_roles.sql`, que substitui a função de proteção de papel com uma exceção de bootstrap privilegiado delimitada. Conferir a sequência completa antes de inferir a regra final.

Migrations a consultar:

- `20260904000331_harden_rls_and_database_functions.sql` — helpers de manager/staff, acesso a tarefas e proteção contra elevação de perfil.
- `20260904000500_revoke_internal_function_access.sql`, `20260904000739_move_rls_helpers_to_private_schema.sql`, `20260904000918_restrict_public_default_privileges.sql` — privilégios e exposição de funções.
- `20260909030000_reservation_operations.sql`, `20260909040000_restaurant_tables.sql`, `20260909050000_daily_operations.sql` — operações, mesas, eventos e fila.
- `20261010001004_capacity_by_service_20261003100000.sql` e `20261010001025_harden_capacity_permissions_and_turn_identity_20261003110000.sql` — capacidade, autorização e auditoria.
- `20261010181221_assign_finance_roles.sql` — proteção de alterações de papel e atribuição inicial de papéis financeiros.

Tipos gerados não descrevem RLS. Antes de afirmar que o acesso direto está protegido, verificar no ambiente alvo tanto `pg_class.relrowsecurity` quanto `pg_policies`, além de grants; a existência de uma policy no arquivo SQL não basta.

## Itens de atenção

- Algumas telas administrativas fazem escrita direta pelo client. Para `profiles`, `special_dates`, `blocked_dates` e `whatsapp_templates`, a habilitação de RLS não aparece nas migrations rastreadas: tratar como **lacuna de verificação prioritária**, não como prova de RLS desligado nem de vulnerabilidade confirmada.
- `createAdminClient()` ignora RLS. Em cada uso, garantir autorização antes de consulta/mutação; teste de UI ou esconder botão é insuficiente.
- O middleware e helpers podem filtrar usuários com `force_password_change`; verificar que nenhuma rota sensível fica acessível por chamada direta antes da troca.
- Segredos de Pagar.me/Resend e chave service role somente no ambiente servidor.
- Token de acesso de reserva é segredo bearer; não registrar token em logs e usar hash persistente.
