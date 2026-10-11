# Fluxos entre módulos

## Reserva pública

1. `app/page.tsx` pede `/api/reservations/availability` para a data/calendário.
2. O handler limita a janela pública e consulta a RPC de disponibilidade, além de datas especiais e bloqueadas.
3. A tela consulta `/api/decorations` para decoração ativa e disponibilidade da data/horário.
4. `POST /api/reservations` recebe os dados e delega ao banco as regras que precisam ser atômicas (capacidade/agenda), cria reserva e credencial de acesso.
5. Se existir taxa pendente, a tela chama `POST /api/payments/pix`; a ordem é criada no Pagar.me e os dados retornam à tela.
6. Em pagamentos confirmados, o webhook valida a ordem diretamente no provedor, grava pagamento e chama `complete_reservation_payment`.

Referências: `app/page.tsx`, `app/api/reservations/route.ts`, `app/api/reservations/availability/route.ts`, `app/api/decorations/route.ts`, `app/api/payments/pix/route.ts`, `app/api/pagarme/webhook/route.ts`.

## Acesso do cliente às reservas

- O token aleatório é entregue ao cliente, enquanto o sistema armazena o hash. Leitura/alteração/cancelamento requer token Bearer e RPCs de acesso; a API pública não deve confiar no ID isolado.
- A recuperação começa por e-mail e código, com HMAC e desafio persistidos no banco. Após validação, o sistema emite nova credencial.
- Código: `lib/reservation-access.ts`, `lib/reservation-recovery.ts`, `app/api/reservations/[id]/route.ts`, `app/api/reservations/recovery/route.ts` e migrations de operações/estabilização.

## Operação do dia

1. `OperationsDashboard` carrega `/api/admin/operations`.
2. Ações de status de reserva usam `/api/reservations/:id`; fila de espera, walk-in e ocorrências usam `/api/admin/operations`.
3. API verifica acesso de painel e valida payload; regras de concorrência/transição e histórico são mantidos por RPCs/triggers no banco.
4. Alocação de mesas é um fluxo separado: `ReservationTableAllocator` consulta `/api/admin/reservations/:id/tables` e envia a seleção ao endpoint, que delega a substituição à função SQL.

## Mesa e capacidade

- A administração cria/ativa áreas e mesas por `/api/admin/restaurant`.
- Disponibilidade de mesa é calculada considerando ocupação/reservas e janela operacional no banco; o endpoint oferece sugestão e persiste associações via RPC.
- Desativar área/mesa não deve permitir atribuição nova a área inativa; há migration específica para reforçar essa condição.
- Capacidade por serviço/turno é responsabilidade central de funções SQL; a tela pública lê o resultado e a criação revalida no momento da gravação para reduzir corrida entre consulta e confirmação.

## Equipe e tarefas

- Login usa Supabase Auth. Navegação de `/admin` e `/funcionario` é direcionada por papel (`lib/route-access.ts`/middleware) e também protegida por chamadas no servidor/RLS.
- Cadastro de usuário usa `/api/admin/employees`; gerenciamento de cargos de trabalho e operações de tarefas, categorias, conclusões e parte dos perfis usam `supabase-js` direto no navegador.
- Checklist busca tarefas aplicáveis ao colaborador/função/data e registros de conclusão do dia; as regras de acesso dessas consultas dependem de RLS e funções SQL.
- Produtividade consulta conclusões e atualiza/revisa registros conforme ações disponíveis.

## Financeiro

1. `FinanceDashboard` guarda filtros em edição e só requisita após ação explícita de aplicar.
2. `GET /api/admin/finance` exige `isFinanceStaff`, valida intervalo/status, consulta pagamentos e relacionamento com cliente/reserva.
3. UI exibe páginas de 10; o handler pode buscar lote maior para produzir resumo/filtro no servidor. É visão de pagamentos de reserva, não razão contábil nem faturamento total do restaurante.

## Datas e decorações

- Datas especiais e bloqueadas são editadas diretamente pelo cliente Supabase nas telas de gestão; a API de disponibilidade as combina com a capacidade.
- Decoração usa handlers: administração persiste metadados/arquivos e o endpoint público filtra itens ativos e consulta disponibilidade por período.

## Pontos de integração observáveis

- A mesma reserva conecta disponibilidade, pagamento, cliente, operação e atribuição de mesas.
- `reservation_events` e tabelas de auditoria registram mudanças especializadas; não presumir que cada mutação é registrada no mesmo histórico.
- Chamadas diretas do navegador ao banco e chamadas via Route Handler podem coexistir no mesmo domínio. A autorização precisa ser avaliada por fluxo (handler, RLS, RPC e service role), não apenas pelo componente visual.

## Cardápio digital e atendimento de mesa (planejado)

O futuro atendimento por QR/mini PDV é separado de reservas: o primeiro pedido confirmado abre a sessão da mesa, pedidos pertencem simultaneamente à sessão e a um participante, e a mesa só é liberada quando não há pedido ou saldo pendente. O cardápio público será somente consulta; cozinha/bar, caixa e mapa de mesas consumirão o mesmo domínio de pedidos. Consulte [cardápio digital](cardapio-digital.md) para estados, canais, segurança, modelo conceitual e decisões pendentes.
