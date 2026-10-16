# Arquitetura e inventário

## Visão geral

Aplicação Next.js com App Router, React/TypeScript e Supabase. A interface vive em `app/`; endpoints HTTP em `app/api/`; autenticação e funções utilitárias em `lib/`; persistência e regras concorrentes no Postgres/Supabase; e integrações de pagamento via Pagar.me. O cliente Supabase é usado tanto no servidor quanto diretamente em algumas telas client-side.

```text
Navegador
  ├─ páginas React ───────────────┬─ Route Handlers (app/api)
  │                               │       ├─ lib/auth e lib/*
  │                               │       ├─ Supabase RPC / tabelas
  │                               │       └─ Pagar.me / Resend
  └─ supabase-js client ──────────────────┴─ tabelas protegidas por RLS
                                          └─ funções, triggers e constraints
```

> Planejamento confirmado: o módulo de cardápio digital, atendimento de mesa, pedidos, produção, comandas e fechamento será um domínio novo e separado de reservas. Seu desenho, fronteiras e dados propostos estão em [cardápio digital](cardapio-digital.md); ele não descreve funcionalidades já implementadas.

## Páginas e módulos de interface

| Rota / área | Responsabilidade observada | Implementação principal |
|---|---|---|
| `/` | Reserva pública: calendário/disponibilidade, dados do cliente, decoração, pagamento PIX e acesso/recuperação de reserva. | `app/page.tsx` |
| `/login` | Login por e-mail e senha Supabase Auth. | `app/login/page.tsx` |
| `/admin` | Painel com navegação e views selecionadas por `?view=`. | `app/admin/page.tsx`, `app/admin/AdminLayoutShell.tsx` |
| Admin: reservas/criar reserva | Lista, filtros e ações sobre reservas; formulário administrativo de criação. | `app/admin/page.tsx` |
| Admin: operação | Reservas do serviço, walk-ins, fila de espera e ocorrências operacionais. | `app/admin/OperationsDashboard.tsx` |
| Admin: áreas e mesas | Cadastro e ativação de áreas/mesas. | `app/admin/RestaurantManager.tsx` |
| Admin: datas especiais/bloqueadas | Cadastro de exceções de agenda e datas sem atendimento. | `app/admin/SpecialDatesManager.tsx`, `app/admin/BlockedDatesManager.tsx` |
| Admin: decorações | Cadastro, ativação e remoção de decoração/imagem. | `app/admin/DecorationsManager.tsx` |
| Admin: funcionários | Perfis, cargos operacionais e permissões excepcionais de capacidade. | `app/admin/FuncionariosManager.tsx` |
| Admin: tarefas/produtividade | Configuração de tarefas e categorias; acompanhamento de conclusões. | `app/admin/TarefasManager.tsx`, `app/admin/ProdutividadeDashboard.tsx` |
| Admin: financeiro | Consulta de pagamentos de reservas, busca, filtros e paginação. | `app/admin/FinanceDashboard.tsx` |
| `/funcionario/checklist` | Tarefas aplicáveis ao colaborador, registro de início/conclusão e edição de perfil. | `app/funcionario/checklist/page.tsx` |

`app/layout.tsx` define fontes, metadados, idioma e viewport; `app/globals.css` mantém estilos/tokens globais. Componentes compartilhados ficam em `components/ui/` e `app/components/`.

## Controllers / Route Handlers

Todos os endpoints encontrados no inventário:

| Método e endpoint | Papel | Persistência / integrações |
|---|---|---|
| `POST /api/reservations` | Criar reserva pública ou administrativa; valida payload, disponibilidade, dados e credencial de acesso. | RPCs/tabelas de reservas; admin client conforme fluxo. |
| `GET /api/reservations/availability` | Consultar disponibilidade por intervalo, turnos, datas especiais e bloqueadas; janela pública limitada. | RPC `get_reservation_capacity_availability`, `special_dates`, `blocked_dates`. |
| `GET/PATCH /api/reservations/:id` | Leitura e alteração; o PATCH também trata cancelamento conforme ação e autorização. | RPCs de token/status e tabelas de reserva. |
| `POST /api/reservations/recovery` | Iniciar recuperação de acesso por e-mail/código. | RPCs de challenge, helper de hash/código e Resend. |
| `PATCH /api/reservations/recovery` | Concluir recuperação e emitir nova credencial de acesso. | RPC de recuperação e tabela de reservas. |
| `GET /api/decorations` | Listar decoração pública e, se data/hora informadas, indicar disponibilidade. | `decorations`, RPC `get_reservation_decoration_availability`. |
| `GET/POST /api/admin/decorations` | Administrar decoração e arquivos. | `decorations`, Supabase Storage bucket `decorations`; admin. |
| `POST /api/payments/pix` | Validar reserva/token/CPF, criar ordem PIX e persistir tentativa de pagamento. | Pagar.me, `reservation_payments`, `reservations`. |
| `POST /api/pagarme/webhook` | Confirmar evento de pagamento consultando a ordem no provedor e concluir taxa. | Pagar.me, `reservation_payments`, RPC `complete_reservation_payment`. |
| `GET/POST /api/admin/operations` | Consultar operação do dia e executar ações operacionais (inclui fila/walk-in/ocorrências). | RPCs/tabelas operacionais; exige equipe do painel, com controles adicionais por ação. |
| `GET/POST/PATCH /api/admin/restaurant` | Consultar e administrar áreas/mesas. | `restaurant_areas`, `restaurant_tables`; autorização admin na rota. |
| `GET /api/admin/reservations/:id/tables`, `PUT` conforme handler | Consultar disponibilidade/sugestão e gravar atribuição de mesas. | RPCs de disponibilidade e substituição de atribuições. |
| `POST /api/admin/employees` | Criar usuário e perfil de funcionário. | Supabase Auth Admin, `profiles`; exige admin. |
| `GET/POST /api/admin/capacity-permissions` | Consultar/conceder/revogar autorização excepcional de capacidade e auditoria. | `profiles`, `reservation_capacity_permissions`, auditoria e RPC de escrita; dono. |
| `GET /api/admin/finance` | Listar/resumir pagamentos com recorte temporal/status e autorização financeira. | `reservation_payments` + relacionamento com reserva; dono/gerente. |
| `POST /api/account/password` | Alterar senha da sessão e remover flag de troca obrigatória. | Supabase Auth e `profiles`. |

O método preciso, contrato, códigos de retorno e filtros devem ser lidos no handler citado. Endpoints de admin não são necessariamente protegidos pelo middleware de rota: cada handler precisa aplicar sua própria checagem.

## Serviços, helpers e clientes

| Arquivo | Responsabilidade |
|---|---|
| `lib/auth.ts` | Resolver papel do usuário autenticado (`isAdmin`, `isPanelStaff`, `isReservationOwner`, `isFinanceStaff`) e consultar funções de autorização de capacidade/reserva. |
| `lib/route-access.ts` | Decidir redirecionamento entre `/admin`, checklist e login segundo papel. |
| `lib/reservation-status.ts` | Normalizar status legado `cancelado` e avaliar transições permitidas para ações. |
| `lib/reservation-access.ts` | Criar token aleatório, validar formato, extrair Bearer e armazenar/validar hash SHA-256. |
| `lib/reservation-recovery.ts` | Normalizar e-mail, gerar código, produzir HMAC e enviar e-mail pelo Resend. |
| `lib/pagarme.ts` | Cliente HTTP autenticado para Pagar.me e validação de CPF. |
| `lib/supabase/client.ts` | Cliente Supabase para navegador. |
| `lib/supabase/server.ts` | Cliente Supabase associado à sessão/cookies no servidor. |
| `lib/supabase/admin.ts` | Cliente privilegiado de servidor (service role); contorna RLS, portanto deve permanecer apenas em código confiável. |
| `lib/utils.ts` | Utilitários gerais compartilhados. |

Não foi encontrada uma camada única de `services/` nem controllers separados: parte da lógica está diretamente nos handlers e parte nas funções SQL.

## Domínios e principais tabelas (tipos gerados)

- **Convenção:** novas tabelas usam nomes em português do Brasil, em `snake_case` e sem acentos. Tabelas existentes mantêm seus nomes, salvo migração de renomeação explicitamente planejada.
- **Estabelecimento/funcionamento:** `configuracoes_estabelecimento`, `dias_funcionamento`, `periodos_funcionamento`, `alteracoes_funcionamento`. Consulte [funcionamento do estabelecimento](funcionamento-estabelecimento.md).
- **Reservas/agenda:** `reservations`, `reservation_events`, `special_dates`, `blocked_dates`, `blacklist`, `reservation_recovery_challenges`, `reservation_schedule_slots`, `reservation_schedule_date_slots`.
- **Pagamento:** `reservation_payments` e campos de cobrança em `reservations`.
- **Mesas/operação:** `restaurant_areas`, `restaurant_tables`, `reservation_table_assignments`, `waitlist_entries`, `reservation_turn_classification_issues`.
- **Permissões/auditoria:** `profiles`, `reservation_capacity_permissions`, `reservation_capacity_permission_audits`, `reservation_capacity_override_nonces`, `reservation_capacity_override_uses`, `reservation_override_audits`.
- **Equipe:** `employee_roles`, `tasks`, `task_categories`, `task_completions`.
- **Outros:** `decorations`, `whatsapp_templates`.

Os tipos gerados listam tabelas e contratos, mas não substituem consultar migrations para constraints, RLS, índices, triggers e evolução histórica.

## Integrações e configuração

- **Supabase:** Auth, Postgres/RPC, Storage e RLS. Clientes em `lib/supabase/`.
- **Pagar.me:** API Core v5; segredo em `PAGAR_ME_SECRET_KEY`; validação opcional de conta via `PAGAR_ME_ID_CONTA`.
- **Resend:** envio de código de recuperação via `RESEND_API_KEY` e `RESERVATION_RECOVERY_FROM_EMAIL`; HMAC requer `RESERVATION_RECOVERY_SECRET`.
- **Fuso usado em disponibilidade/financeiro:** `America/Porto_Velho` em implementações consultadas.
- Nunca colocar segredos ou valores de produção nesta documentação.

## Testes e comandos

Os testes Vitest cobrem contratos selecionados de rotas, autorização, status, concorrência, disponibilidade, capacidade, pagamentos e mesas; os testes `tests/database/*.mjs` exercitam migrations em banco local. Scripts estão em `package.json`: `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`. Testes de banco dependem de ambiente local configurado.
