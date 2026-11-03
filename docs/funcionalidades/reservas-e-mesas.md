# Reservas, disponibilidade, mesas e operação

## Reservas

### Criação

Interface pública e formulário administrativo reutilizam `/api/reservations` com contexto/permissão diferente. O handler valida e normaliza campos, consulta regras e chama o banco para criação consistente. A reserva pode incluir quantidade de pessoas, data/hora, contato, observações, decoração e dados de cobrança conforme o dia/regra aplicável. Não deduzir valor comercial apenas pelo formulário: validar a função SQL e os campos de `special_dates`/reserva para a regra efetiva.

Credencial do cliente: `lib/reservation-access.ts` gera token aleatório de 32 bytes e guarda SHA-256; token em formato hex de 64 caracteres. RPCs protegidas atendem consulta, atualização e cancelamento sem exigir conta autenticada.

### Fluxo público por etapas — implementação local de 29/10/2026

- `app/components/PublicReservationForm.tsx` apresenta **Reserva → Seus dados**.
  A primeira etapa revela **calendário → pessoas → horários compatíveis**;
  evento da data aparece quando aplicável. A segunda contém resumo editável,
  nome/telefone e personalização opcional (decoração/observações). Voltar preserva
  o contato; mudanças de data/pessoas/evento invalidam horário e decoração.
- A quantidade é digitada em campo com `inputMode="numeric"`, validando inteiros
  entre 1 e 30. Pacotes com quantidade fixa preservam o contrato existente.
  Clicar na data rola até o próximo bloco sem abrir o teclado automaticamente;
  a rolagem respeita a preferência de movimento reduzido.
- `CalendarPicker` reutiliza a janela da API, sem o antigo limite independente de
  três meses. Há navegação por teclado, virada de mês e consulta dos motivos de
  datas indisponíveis também por toque. `ReservationProgress` acrescenta
  **Pagamento** somente quando necessário e mantém a etapa na tela do PIX.
- **Ajuste aprovado em 03/11/2026:** e-mail e CPF são solicitados e enviados
  somente com pagamento: 15+ pessoas ou data especial com taxa, mesmo abaixo de 15.
  O e-mail voltou ao fluxo pago por exigência documentada do PIX Pagar.me; reserva
  gratuita continua somente com nome e telefone. Endereço inválido ou acima de 64
  caracteres é rejeitado, nunca truncado. A API aplica a mesma exigência antes de
  criar uma reserva paga; no painel, o campo existente indica obrigatoriedade
  quando há cobrança, sem redesenhar o restante do formulário.
  `lib/reservation-payment.ts` mantém o valor de grupo e a precedência do valor de
  evento; a API calcula a regra novamente, incluindo quantidade fixa do pacote.
- O PIX exige token válido antes de aceitar contato. Usa o e-mail salvo ou o
  informado na geração autorizada, normaliza e valida antes de chamar o provedor.
  CPF/e-mail/expiração só são atualizados enquanto o pagamento da reserva ainda
  está pendente, preservando a proteção contra disputa com o webhook.
- A API aceita ausência de CPF em reserva gratuita; CPF presente continua sujeito
  à validação. Só pesquisa duplicidade por CPF quando ele foi informado. A guarda
  concorrente de duplicidade por WhatsApp, agenda e capacidade permanece no banco.
- Seleções de 1–30 pessoas e o contato com a equipe para grupos maiores são
  preservados. Calendário e antecedência usam `America/Porto_Velho` também no cliente.
- Erro de disponibilidade não aparece como falta de horários. Falha de decoração
  é identificada separadamente e não impede continuar sem esse opcional.
- A confirmação exibe resumo e estado real. PIX é gerado para a reserva já criada;
  repetir a geração não envia novamente o pedido de reserva. Durante até 30 minutos,
  a tela consulta o estado por token a cada cinco segundos e interrompe ao receber
  pagamento ou estado terminal. Não faz reativação nem estorno automático.
- O WhatsApp só abre por ação explícita do cliente; não há envio automático de
  mensagem. A solicitação sem taxa continua pendente conforme o contrato existente.

**Banco atualizado em 03/11/2026:** a migration
`20261029234421_cpf_apenas_reservas_com_pagamento.sql` substitui a função do trigger
de CPF somente para novas reservas. Não apaga dados históricos, muda grants,
relaxa capacidade ou altera o fluxo de walk-in. Foi aplicada individualmente no
Duna como versão remota `20261103194610`, após aprovação específica. Triggers e
ACLs foram conferidos antes/depois. Deploy da aplicação continua separado; ver
[registro de implantação](../implantacao-reservas-2026-11-03.md).

**Limites:** formulário administrativo mantém seus campos atuais, com indicação
de e-mail obrigatório para pagamento; aumento de uma
reserva existente de 14 para 15 continua com a lacuna financeira documentada.
Recuperação em outro dispositivo sem e-mail continua assistida pela equipe;
não há autenticação nova por telefone. Conversão em consumação continua sendo a
regra comunicada, não um novo mecanismo de crédito contábil.

O retorno do e-mail foi implementado apenas localmente, sem migration, backfill,
reparação de reservas/ordens existentes ou deploy. Se uma tentativa já falhou no
provedor, não trocar a chave de idempotência nem criar outra cobrança às cegas;
conferir o pedido existente antes de aprovar recuperação. A coleta do contato não
reintroduz a interface de recuperação por e-mail em “Minhas reservas”.

A aba “Minhas reservas” não exibe mais recuperação por e-mail/código. O telefone
filtra o acesso salvo neste navegador; falhas e ausência de resultado orientam
contato pelo botão de WhatsApp. O endpoint legado de recuperação foi preservado.

Validação local: `npm run typecheck`, `npm run lint`, `npm test`; teste PostgreSQL
específico com `node --test tests/database/reserva-cpf-pagamento.test.mjs`. Este
último verifica a identidade do container `duna-plan1-isolated` já ativo e aplica
a função/fixtures somente dentro de transações revertidas, sem registrar migration
nem modificar sua versão persistente. Testes de navegador usam APIs simuladas,
sem stack Next/Supabase/Pagar.me real. Revisão independente ainda necessária.

Resultados da primeira entrega: TypeScript/lint sem erros, 136 testes Vitest e sete
testes PostgreSQL específicos aprovados. No Chrome isolado, APIs simuladas
validaram ida/volta, contato preservado, limite 14/15, evento pago com duas pessoas,
validação, clique duplo, erro/repetição de PIX sem nova reserva, confirmação por
consulta, erro/repetição da disponibilidade e conflito mantendo os dados. Ação
principal visível e ausência de overflow horizontal em 320/390/768/1440 px.
As fontes Google e a implementação Next/Image não foram carregadas nesse harness;
não é E2E da stack publicada nem comprovação de acessibilidade completa. As
primeiras tentativas do harness falharam por bloqueio DNS do próprio loopback e
escape de seletor; corrigidas somente nos artefatos temporários de QA.

Incremento de calendário e progressão: 149 testes Vitest, TypeScript e lint
aprovados. O lint excedeu o timeout na execução paralela e passou na repetição
isolada. Chrome com APIs simuladas verificou calendário por setas/Enter, revelação
data→pessoas→horários, filtro por capacidade, troca de mês/data/quantidade,
progresso de pagamento, CPF e regressões de envio/PIX em 320/390/768/1440 px.
Sem novas mudanças de banco, operações remotas ou deploy neste incremento.

Para implantação em outros ambientes, reconciliar a precondição da função/trigger no ambiente alvo,
guardar sua definição para reversão revisada e aplicar só a nova migration com
autorização específica. Verificar gratuitamente 14 pessoas sem CPF, 15 com CPF e
evento pago abaixo de 15 em ambiente sintético; então publicar API e UI juntas.
Não reenviar a pasta histórica nem fazer backfill. A alteração do trigger é
compatível com o cliente antigo, que ainda informa CPF. Reverter a aplicação não
deve apagar documentos nem reservas criadas pelo novo fluxo. A suíte completa de
banco não foi executada/reconstruída nesta tarefa; o teste específico faz rollback
da função e dos registros ao terminar.

### Horizonte de 60 dias e antecedência de 2 horas

- A decisão atual substitui hoje +10 dias / 8 horas por **hoje até hoje +60 dias,
  inclusive (61 datas)** e **mínimo de 2 horas**, em `America/Porto_Velho`.
  Agenda, bloqueios e capacidade continuam podendo indisponibilizar essas datas.
- `lib/public-reservation-form.ts` compartilha a janela entre calendário e APIs
  de disponibilidade, criação e edição pública; os textos usam as mesmas constantes.
  O horizonte estendido da equipe permanece. Token e autorização não mudam.
- `20261030013127_antecedencia_reservas_duas_horas.sql`, criada pelo CLI 2.119.0
  e aplicada no Duna em 03/11/2026 como versão remota `20261103194630`,
  substitui `validate_reservation_schedule` mudando
  somente o intervalo de 8 para 2 horas. Mantém agenda, override autorizado,
  exceção de walk-in e a não revalidação quando data/hora não mudam. Não altera
  reservas, capacidade/locks, financeiro, grants/RLS, contratos ou tipos gerados.

Critérios e evidências desta alteração:

- Hoje e +60 aceitos; passado e +61 recusados na criação/edição pública.
  Disponibilidade recortada no mesmo intervalo, sem consultar além dele.
- Exatamente 2 horas aceitas e menos de 2 recusadas pelo helper e ao habilitar
  Continuar; testes incluem milissegundos, meia-noite de Porto Velho, ano novo,
  meses e ano bissexto. O banco continua sendo a guarda final no instante da gravação.
- `npm test`: **174 testes em 29 arquivos passaram**, incluindo regressões de
  autorização, capacidade e cobrança com mocks; `npm run typecheck`,
  `npm run lint` e `git diff --check` passaram. `git diff` foi inspecionado;
  alterações preexistentes foram mantidas. Nenhuma falha nesses comandos.
- Nove casos PostgreSQL preparados em `tests/database/reserva-antecedencia.test.mjs`
  para o trigger real em tabela temporária: igualdade/abaixo/acima de 2h,
  origem ausente, walk-in, reagendamento, preservação, agenda e privilégios.
  **Não executados nesta etapa**: não há sandbox MCP confirmado/autorizado;
  não se acessou o container por conexão direta como substituto do MCP.
  Não houve nova execução de navegador/E2E ou verificação de concorrência real.

**Atualização de implantação em 03/11/2026:** as duas migrations foram aplicadas
individualmente por `supabase_duna` no projeto confirmado `gnakcuvfxltbgpssirpv`.
O catálogo confirmou as novas definições, triggers ativos, mesma segurança
invoker e ACLs preservadas. A cópia anterior está em
`supabase/inspection/2026-11-03-reservas-publicas-antes.sql`; sua execução para
reversão exige nova aprovação e não deve apagar reservas ou reparar o histórico.
As versões remotas foram geradas pelo MCP e diferem dos timestamps locais;
não renomear os arquivos históricos nem reenviar toda a pasta de migrations.
TypeScript, lint e os 174 testes passaram novamente. Não houve deploy da aplicação,
teste de navegador/provedor ou fixtures em produção; os nove testes PostgreSQL
de antecedência continuam não executados. Revisão independente e fluxo financeiro
14→15 permanecem pendentes. Performance real da janela de 61 datas não foi medida.
Ver [relatório](../implantacao-reservas-2026-11-03.md) para evidências e bloqueios.

### Status e transições

`lib/reservation-status.ts` normaliza `cancelado` legado como `cancelled` e descreve permissões de ação: confirmar pending, cancelar pending/confirmed, acomodar confirmed e concluir seated. O banco também possui `transition_reservation_status` e trilha de eventos. A função client-side é orientação/UX; a operação persistente deve respeitar validação no servidor/banco.

Estados adicionais e exceções devem ser verificados na versão atual das migrations; este documento não cria uma nova máquina de estados.

## Disponibilidade e capacidade

- Endpoint: `GET /api/reservations/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Usa fuso `America/Porto_Velho`, limita consulta pública a hoje e próximos 60 dias (implementação local atual), combina disponibilidade de capacidade, datas especiais e datas bloqueadas.
- A resposta agrega ocupação por turno/horário e datas consideradas completas. A capacidade limite de 80 aparece no handler para classificar disponibilidade, enquanto as RPCs e migrations definem a contabilização final; divergência entre limites é item para revisão.
- Funções de banco relevantes incluem versões de `get_reservation_capacity_availability`, `get_reservation_commercial_turn`, `get_reservation_service_start_for_commercial_turn`, `get_reservation_occupancy_window`, `validate_reservation_schedule` e verificações de disponibilidade. As migrations posteriores substituem versões históricas; usar o código mais recente aplicado, não somar regras antigas.
- A consulta informa disponibilidade, mas não reserva capacidade por si só; criação/alteração precisa revalidar atomicamente no banco.
- Alteração local aprovada: contar apenas pessoas de reservas pendentes,
  confirmadas e acomodadas (também `pendente`/`confirmado` legados), liberando a
  cota ao concluir, cancelar ou registrar não comparecimento. Não há liberação
  automática por permanência estimada ou intervalo entre entradas. A cota segue
  conservadora por data/turno; walk-ins continuam excluídos por decisão explícita.
  Ver [funcionamento](funcionamento-estabelecimento.md) para migration e limites
  de validação/implantação. O fallback do painel segue o mesmo conjunto de estados.
- Alterar funcionamento ou remover janelas mantém reservas anteriores, mesas e
  decorações. Novas reservas e reagendamentos normais respeitam a nova agenda.

## Mesas e áreas

- Modelo: `restaurant_areas`, `restaurant_tables` e `reservation_table_assignments`.
- API de configuração: `/api/admin/restaurant` (admin na rota) consulta e mantém cadastro.
- API de atribuição: `/api/admin/reservations/:id/tables` obtém disponibilidade e sugestão; gravação é substituição do conjunto de mesas por função SQL.
- RPCs/triggers consideram janela de ocupação da reserva, integridade das atribuições e estado ativo das áreas/mesas. Há testes em `tests/restaurant-tables.test.ts` e migration para impedir nova atribuição em área inativa.
- Sugestão de mesas no endpoint é uma heurística local: filtra disponíveis e combina até duas mesas da mesma área, priorizando capacidade próxima. Ela não é a regra final de conflito; o banco valida gravação.

## Operação do dia

`OperationsDashboard` e `/api/admin/operations` concentram visualização/ações diárias: status de reserva, walk-in, lista de espera e classificação de ocorrências. Walk-in cria reserva operacional com regras próprias (data do dia, dados, agenda e capacidade). O domínio usa `waitlist_entries` e `reservation_turn_classification_issues`; registros operacionais e status podem produzir eventos.

Permissões especiais de exceder capacidade passam por `reservation_capacity_permissions` e auditoria, além de nonce/uso quando aplicável. O endpoint que gerencia concessões é restrito ao dono; as RPCs fazem a autorização final. Consultar `permissoes.md` e as migrations de hardening.

## Dados relacionados

| Tabela | Uso no domínio |
|---|---|
| `reservations` | Registro principal e campos de contato, horário, estado e pagamento. |
| `reservation_events` | Eventos associados a mudanças operacionais. |
| `reservation_schedule_slots`, `reservation_schedule_date_slots` | Configuração de horários/agenda, conforme migrações e funções de disponibilidade. |
| `special_dates`, `blocked_dates`, `blacklist` | Exceções e restrições consultadas na agenda/reserva. |
| `restaurant_areas`, `restaurant_tables`, `reservation_table_assignments` | Cadastro e alocação de mesas. |
| `waitlist_entries`, `reservation_turn_classification_issues` | Fila e pendências de classificação operacional. |
| `reservation_capacity_*`, `reservation_override_audits` | Autorizações, usos e trilhas de override. |

## Testes relacionados

`reservations-create-route`, `reservation-status-route`, `reservation-availability-route`, `reservation-operations`, `reservation-concurrency`, `restaurant-tables`, `admin-operations-route`, `admin-operations-capacity-route`, `capacity-permissions-route`, `decoration-period-conflicts` e testes incrementais de banco.
