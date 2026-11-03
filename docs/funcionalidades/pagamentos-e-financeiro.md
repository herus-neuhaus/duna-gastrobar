# Pagamentos e financeiro

## Escopo funcional

O fluxo documentado cobre taxas de reserva pagas via PIX e consulta administrativa de pagamentos de reserva. O painel **não equivale ao faturamento completo**: não há nesta tela registro de vendas do salão/PDV nem despesas/contas a pagar.

## Criar cobrança PIX

`POST /api/payments/pix`:

1. Recebe ID da reserva, CPF e token de acesso. Valida CPF e formato do token.
2. Localiza a reserva e compara hash do token; rejeita cancelada, já paga, sem pagamento pendente ou valor inválido.
3. Cria ordem Pagar.me com idempotency key baseada na reserva e finalidade `reservation_fee`; pede transação PIX com validade de 30 minutos.
4. Confere o valor retornado pelo provedor e usa `lib/reservation-payment-persistence.ts`: insere por `provider,provider_order_id` ignorando conflito, verifica o vínculo/valor existente e só atualiza expiração de pagamento ainda `pending`. Não sobrescreve status/`paid_at` de um pagamento existente com uma resposta pendente.
5. Atualiza CPF/expiração somente enquanto `reservations.payment_status='pending'`, sem escrever esse status novamente. Retorna ordem, QR Code, link e expiração à interface. Se o provedor já retornar `paid`, persiste/confirma o pagamento mesmo sem QR Code e retorna o conflito já usado para reserva paga (HTTP 409); a consulta protegida por token continua sendo a fonte de estado para a tela.

Arquivo: `app/api/payments/pix/route.ts`; chamadas HTTP em `lib/pagarme.ts`. Segredos não devem ser enviados ao cliente.

## Confirmação de pagamento

`POST /api/pagarme/webhook` só processa `order.paid`. Se configurado, valida conta do evento; consulta a ordem diretamente no Pagar.me (não confia apenas no payload recebido); confirma status, finalidade, reserva e valor da ordem. Usa o helper compartilhado para inserir sem sobrescrever conflito, promover um pagamento ainda não pago e chamar `complete_reservation_payment`. Para reserva já paga, só reconhece reentrega de ordem já vinculada à mesma reserva e valor; responde HTTP 200 sem regravar `paid_at` ou atualizar novamente a coluna `status` paga. Ordem diferente não é automaticamente aceita como nova cobrança de reserva já paga.

O endpoint não valida assinatura do corpo do webhook; a evidência de autenticidade do pagamento é a consulta autenticada ao pedido no Pagar.me e as conferências locais. A validação de conta é condicional a `PAGAR_ME_ID_CONTA` estar configurada.

## Estados, fonte usada pelo fluxo e idempotência

- `reservation_payments.status` aceita `pending`, `paid`, `failed`, `expired` e `refunded`; `(provider, provider_order_id)` é único. Esse registro representa o pedido/transação do provedor.
- No fluxo de conclusão, `reservations.payment_status` e `reservations.payment_amount` são os campos que autorizam a transição: `complete_reservation_payment` só altera a reserva se ela ainda estiver `pending` e o valor corresponder exatamente. A RPC define `payment_status='paid'` e muda `status` de `pending` para `confirmed`; uma repetição depois da transição retorna zero linhas. Isso descreve o comportamento implementado, não uma política geral para reembolsos ou novos pagamentos.
- A chave enviada ao Pagar.me é sempre `reservation-${reservation.id}-fee`. O código não inclui identificador de tentativa; o comportamento de uma nova solicitação após expiração/falha depende da semântica do provedor e não está demonstrado pelos testes locais.
- A persistência usa `ignoreDuplicates: true` (INSERT ON CONFLICT DO NOTHING) e UPDATE com filtros no servidor: não há escrita de `pending` em linhas de pagamento existentes, e a promoção a `paid` exige status diferente de `paid`. O trigger `record_reservation_payment_event` continua disparando em INSERT/UPDATE de status, mas a reentrega pelo novo fluxo não atualiza status já pago nem duplica esse evento. `paid_at` original é preservado. O vínculo e valor da linha existente são conferidos antes de continuar; conflito divergente retorna erro, sem reassociar silenciosamente o pagamento.
- A confirmação tem etapas separadas: gravação condicional de `reservation_payments` e RPC de `reservations` não estão numa única transação. Se a RPC falhar após gravar o pagamento, a rota retorna 500 e depende de nova entrega do webhook (ou nova consulta PIX que devolva `paid`) para concluir. O retry não rebaixa nem regrava o pagamento já pago. Ainda pode haver divergência temporária; não foi criado reconciliador automático nem reparação de dados históricos.
- **Pagamento após cancelamento:** as RPCs de cancelamento alteram `reservations.status` para `cancelled`, sem invalidar o pedido Pagar.me nem limpar `payment_status='pending'`. O webhook verifica `payment_status` e valor, mas não exige que a reserva continue ativa; `complete_reservation_payment` marca o pagamento como `paid`, porém só troca o status da reserva de `pending` para `confirmed`. Portanto, um PIX liquidado depois do cancelamento pode resultar em reserva ainda `cancelled` com pagamento `paid`. O código não implementa reembolso automático nem resolução operacional desse caso.
- Apenas `order.paid` é processado. Eventos de falha, expiração e reembolso não são sincronizados por esse handler, apesar de existirem estados correspondentes na tabela. O código não demonstra fluxo de reconciliação ou reembolso.
- `group_reservation_fee` é aceito pelo webhook, mas a busca no código rastreado não encontrou criador de pedido PIX com essa finalidade; `/api/payments/pix` usa `reservation_fee`.

Testes relacionados: `tests/pix-access-route.test.ts` cobre ausência de token; `tests/pagarme.test.ts` cobre validação de CPF; `tests/database/current-mechanisms.test.mjs` contém os casos de valor exato e repetição da RPC. `tests/reservation-payment-race.test.ts` usa o cliente Supabase instalado com transporte HTTP em memória e provedor mockado: cobre filtros/Prefer, interleaving em geração e UPDATE, reentrega, `paid_at`, eventos, falha parcial/retry, cancelamento, valor, conta, token e conflitos de vínculo. Não é teste PostgreSQL/RLS/locks nem Pagar.me sandbox; estados failed/expired/refunded e reconciliação continuam sem cobertura integrada.

**Situação em 03/11/2026:** proteção de concorrência/reentrega implementada apenas
no código local, sem migration, deploy ou alteração de produção. Revisão independente,
PostgreSQL concorrente real e provedor sandbox continuam pendentes. A edição 14→15
foi explicitamente adiada pelo responsável; o fluxo existente não foi alterado nesta correção.

## Regras confirmadas pelo responsável e situação da implementação

- Se o pagamento chegar depois do cancelamento, a reserva deve continuar explicitamente cancelada e o pagamento deve aparecer como pago. O sistema deve sinalizar à equipe que precisa contatar o cliente; após esse contato, o restaurante decide se mantém o cancelamento ou se a reserva foi apenas cancelada por atraso no pagamento. Não automatizar reativação ou reembolso.
- Em falha do pagamento, avisar ao cliente que a equipe do restaurante entrará em contato e marcar a reserva/pagamento para acompanhamento da equipe. Em expiração do PIX, registrar `expired` e oferecer à equipe a opção de contatar o cliente. A rota atual não processa esses eventos nem possui essa sinalização de acompanhamento.
- Ao alterar uma reserva existente de menos de 15 para 15 ou mais pessoas, a interface deve informar a taxa de R$ 100 assim que a quantidade atingir o limite; ao confirmar, deve iniciar o PIX e exibir o QR Code. A alteração deve ficar pendente: manter a quantidade original até o pagamento ser confirmado, e só então aplicar a nova quantidade. A criação pública já informa a regra de grupo e inicia o PIX quando requerido, mas o fluxo de edição atual chama diretamente `PATCH /api/reservations/:id`; a modal de pagamento em `app/page.tsx` não tem caminho que a abra, e a atualização não cria uma cobrança. O teste `OUT-02` está marcado como `todo`, mas essa decisão de negócio foi confirmada pelo responsável; o teste e a implementação ainda precisam ser atualizados.
- Se a pessoa informar CPF que corresponda a uma reserva ativa na mesma data e turno/período de atendimento e tentar reservar pessoas adicionais, o sistema deve perguntar se quer acrescentar à reserva existente ou fazer outra. Almoço e jantar são períodos distintos: não pesquisar uma reserva de jantar ao solicitar almoço, nem o contrário. Se acrescentar pessoas a uma reserva de 15+ já paga, não deve cobrar outra taxa de R$ 100. Deve verificar o CPF e abrir `wa.me` para o cliente enviar manualmente nome, dados da reserva e a opção escolhida ao número do restaurante já configurado. Não incluir CPF na mensagem. A busca por CPF e turno está implementada no handler público; registros históricos sem turno classificado não entram na comparação, pois não é seguro inferir almoço/jantar. Em caso de correspondência, o sistema não cria outra reserva automaticamente: oferece as opções e encaminha a escolha à equipe pelo WhatsApp.
- **Decisão atual de 29/10/2026, substituindo CPF obrigatório em toda reserva:** no fluxo público, pedir somente nome e telefone quando não houver pagamento; pedir também CPF quando houver pagamento (15+ ou data especial paga, qualquer quantidade). Não pedir e-mail nesse formulário. A API mantém compatibilidade com e-mail/CPF opcionais de outros consumidores e exige CPF válido quando calcula pagamento. A migration `20261029234421_cpf_apenas_reservas_com_pagamento.sql` ajusta a exigência no banco; aplicada no Duna em 03/11/2026 como versão remota `20261103194610` ([registro](../implantacao-reservas-2026-11-03.md)). Não apaga CPF/e-mail histórico. O formulário administrativo não foi redesenhado nesta etapa.
- Para grupos de 15 ou mais, a taxa confirmada é R$ 100,00. A criação pública já exibe o aviso e cria PIX; a alteração de reserva existente ainda não completa esse fluxo.

O requisito de WhatsApp acima é abrir um link `wa.me` com a mensagem pronta para o cliente enviar manualmente. A tela pública oferece as opções de acrescentar pessoas ou fazer outra reserva e prepara a mensagem com nome e dados da reserva, sem CPF. CRUD de templates existe, mas não foi localizado envio automatizado por provedor — e não é solicitado nesta regra.

Na criação pública por etapas, a busca de correspondência por CPF só ocorre quando
há documento informado; sem CPF, a guarda existente de WhatsApp permanece. A nova
tela distingue solicitação recebida, pagamento pendente, pago e reserva confirmada
consultando o endpoint protegido por token. Essa consulta não substitui webhook nem
cria novos créditos de consumação. O prazo exibido vem de `expiresAt`; as mensagens
de WhatsApp não pedem mais envio de comprovante. A recuperação por e-mail continua
restrita às reservas que já possuem esse contato.

## Dados financeiros

- `reservation_payments`: provedor, ID da ordem, método, estado, valor, moeda, timestamps.
- `reservations`: relacionamento com cliente/data/hora e campos que refletem status/valor de cobrança.
- O endpoint financeiro seleciona pagamentos e relacionamento com `reservations`; autorização é `isFinanceStaff()` (dono ou gerente).

## Painel

`app/admin/FinanceDashboard.tsx` mostra resumo/listagem e busca. Página visual contém 10 itens; filtros são preparados localmente e aplicados sob ação do usuário. `GET /api/admin/finance` valida datas e status, usa limites temporais de `America/Porto_Velho` e retorna registros/resumo consultados. Detalhes de paginação/limite no código: `PAGE_SIZE` da UI e `PAGE_SIZE`/consulta no endpoint não representam necessariamente o mesmo nível de paginação.

## Limitações e verificações

- Valor de taxa vem da regra de reserva e é verificado novamente antes de aceitar webhook.
- CPF é coletado/gravado no fluxo de pagamento; confirmar política de retenção/acesso fora do escopo do código não é possível apenas por leitura.
- Definir com o responsável do produto se é necessário sincronizar falha/expiração/reembolso e qual operação pode reabrir uma cobrança; esta documentação não escolhe esses comportamentos.
- Implementar alerta/etiqueta de contato para pagamento pago após cancelamento, mantendo explícitos os estados cancelado e pago; a decisão do restaurante ocorre depois do contato, sem reativação automática.
- Definir se uma reserva pode ter novas tentativas de cobrança e como elas se identificam; o código atual reutiliza a mesma chave de idempotência por reserva.
- Atualizar o caminho de edição de convidados para pedir consentimento e iniciar o PIX ao atingir 15+, conforme regra confirmada; revisar o teste `OUT-02`, hoje marcado como `todo` apesar da decisão já fornecida.
- A migration de CPF condicionado ao pagamento foi aplicada individualmente em 03/11/2026. Publicação e validação integrada do formulário/API são separadas; não fazer backfill, remoção de documentos históricos ou alteração incidental de outros formulários.
- Usar a mesma data e o mesmo turno/período de atendimento na busca por CPF; almoço e jantar são distintos. Registros históricos sem turno classificado (`commercial_turn` nulo) ficam fora da comparação para não associar períodos incorretos.
- Testar manualmente, no navegador, as duas opções de `wa.me` com nome, dados da reserva e a escolha entre acrescentar ou fazer outra, confirmando que o CPF não aparece na mensagem.
- Investigar alertas do provedor e processo operacional de reconciliação caso webhook falhe; não há evidência nesta leitura de módulo de conciliação contábil.
- Confirmar requisitos atuais do Pagar.me para a consulta autenticada usada em lugar de validação da assinatura do webhook antes de expandir a integração.
- O endpoint aceita `group_reservation_fee`, mas não foi localizado criador dessa finalidade; confirmar se é compatibilidade necessária ou código sem produtor antes de removê-la.
