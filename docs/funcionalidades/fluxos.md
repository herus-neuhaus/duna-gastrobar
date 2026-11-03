# Fluxos entre módulos

## Reserva pública

1. `app/page.tsx` pede `/api/reservations/availability` para a data/calendário.
2. O handler limita a janela pública e consulta a RPC de disponibilidade, além de datas especiais e bloqueadas.
   O formulário apresenta calendário em grade; selecionar data libera pessoas
   (e evento, quando existir), e selecionar quantidade libera os horários que
   comportam o grupo. Alterar data/evento/quantidade limpa escolhas dependentes,
   sem apagar o contato. O progresso inclui Pagamento apenas quando há cobrança.
3. `PublicReservationForm` separa escolhas da reserva de dados de contato. A segunda etapa contém resumo editável, nome/telefone, e-mail/CPF apenas se houver pagamento e decoração/observações opcionais. O e-mail voltou ao fluxo pago por aprovação de 03/11/2026 e exigência do provedor PIX. A tela consulta `/api/decorations` para decoração ativa e disponibilidade da data/horário.
4. Somente a ação final envia `POST /api/reservations`; continuar/voltar/editar não gravam reservas. O handler calcula pagamento pelo número efetivo de pessoas/evento, valida CPF e e-mail quando necessário e delega ao banco as regras atômicas de capacidade/agenda. Cria reserva e credencial de acesso. A ausência de CPF em reserva gratuita depende da migration `20261029234421_cpf_apenas_reservas_com_pagamento.sql`, aplicada no Duna em 03/11/2026 como versão remota `20261103194610`. A antecedência de duas horas também foi aplicada; ver [implantação](../implantacao-reservas-2026-11-03.md). Isso não publica a aplicação nem implementa a cobrança na edição de quantidade.
5. Se existir taxa pendente, a tela chama `POST /api/payments/pix`; a rota valida token, CPF e e-mail compatível com o provedor antes da chamada. A ordem é criada no Pagar.me e os dados retornam à tela. O e-mail pode vir da reserva ou da solicitação autorizada; só é persistido enquanto o pagamento continua pendente. A ausência de QR Code gera diagnóstico apenas de estados conhecidos/código HTTP e presença de erros, nunca dump do comprador, mensagens livres do gateway ou credenciais.
6. Em pagamentos confirmados, o webhook valida a ordem diretamente no provedor e usa `lib/reservation-payment-persistence.ts` para gravar sem rebaixar estado pago e chamar `complete_reservation_payment`. Reentrega da mesma ordem/valor retorna 200 sem regravar status pago; falha parcial continua exigindo retry. A geração PIX usa a mesma persistência, não reescreve `pending` na reserva e também conclui a confirmação se o provedor já retornar `paid`. Correção apenas local, sem deploy; ver [financeiro](pagamentos-e-financeiro.md).
7. A tela de resultado mantém o resumo e consulta o estado por token (cinco segundos, até 30 minutos), sem inferir confirmação pelo QR Code. Falha ao gerar PIX mantém a reserva existente. WhatsApp só abre quando o cliente escolhe entrar em contato.

Referências: `app/page.tsx`, `app/api/reservations/route.ts`, `app/api/reservations/availability/route.ts`, `app/api/decorations/route.ts`, `app/api/payments/pix/route.ts`, `app/api/pagarme/webhook/route.ts`.

## Acesso do cliente às reservas

- O token aleatório é entregue ao cliente, enquanto o sistema armazena o hash. Leitura/alteração/cancelamento requer token Bearer e RPCs de acesso; a API pública não deve confiar no ID isolado.
- O endpoint legado de recuperação por e-mail/código permanece disponível, com HMAC e desafio persistidos no banco. Não é mais exibido na aba pública “Minhas reservas”.
- “Minhas reservas” consulta por telefone somente as credenciais salvas neste navegador, mantendo o token nas requisições. A tela oferece um botão de WhatsApp para atendimento quando não houver acesso local, resultado ou disponibilidade da consulta. Informar telefone não concede acesso a reservas de terceiros; não foi criada autenticação nova por telefone.
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
