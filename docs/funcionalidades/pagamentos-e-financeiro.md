# Pagamentos e financeiro

## Escopo funcional

O fluxo documentado cobre taxas de reserva pagas via PIX e consulta administrativa de pagamentos de reserva. O painel **não equivale ao faturamento completo**: não há nesta tela registro de vendas do salão/PDV nem despesas/contas a pagar.

## Criar cobrança PIX

`POST /api/payments/pix`:

1. Recebe ID da reserva, CPF e token de acesso. Valida CPF e formato do token.
2. Localiza a reserva e compara hash do token; rejeita cancelada, já paga, sem pagamento pendente ou valor inválido.
3. Cria ordem Pagar.me com idempotency key baseada na reserva e finalidade `reservation_fee`; pede transação PIX com validade de 30 minutos.
4. Persiste/atualiza `reservation_payments` por `provider,provider_order_id` e atualiza CPF/expiração/status auxiliar da reserva.
5. Retorna ordem, QR Code, link e expiração à interface.

Arquivo: `app/api/payments/pix/route.ts`; chamadas HTTP em `lib/pagarme.ts`. Segredos não devem ser enviados ao cliente.

## Confirmação de pagamento

`POST /api/pagarme/webhook` só processa `order.paid`. Se configurado, valida conta do evento; consulta a ordem diretamente no Pagar.me (não confia apenas no payload recebido); confirma status, finalidade, reserva, valor pendente e valor da ordem; faz upsert do pagamento como pago; chama `complete_reservation_payment` para finalizar a atualização de domínio.

O endpoint não valida assinatura do corpo do webhook; a evidência de autenticidade do pagamento é a consulta autenticada ao pedido no Pagar.me e as conferências locais. A validação de conta é condicional a `PAGAR_ME_ID_CONTA` estar configurada.

## Estados, fonte usada pelo fluxo e idempotência

- `reservation_payments.status` aceita `pending`, `paid`, `failed`, `expired` e `refunded`; `(provider, provider_order_id)` é único. Esse registro representa o pedido/transação do provedor.
- No fluxo de conclusão, `reservations.payment_status` e `reservations.payment_amount` são os campos que autorizam a transição: `complete_reservation_payment` só altera a reserva se ela ainda estiver `pending` e o valor corresponder exatamente. A RPC define `payment_status='paid'` e muda `status` de `pending` para `confirmed`; uma repetição depois da transição retorna zero linhas. Isso descreve o comportamento implementado, não uma política geral para reembolsos ou novos pagamentos.
- A chave enviada ao Pagar.me é sempre `reservation-${reservation.id}-fee`. O código não inclui identificador de tentativa; o comportamento de uma nova solicitação após expiração/falha depende da semântica do provedor e não está demonstrado pelos testes locais.
- O upsert por `provider,provider_order_id` evita duplicar a linha do mesmo pedido. Porém, não torna idempotentes todos os efeitos: o trigger `record_reservation_payment_event` dispara em INSERT e em UPDATE de `status`, e registra um `reservation_events` a cada upsert que atualiza essa coluna, mesmo se o valor continuar igual.
- A confirmação tem etapas separadas: o webhook grava/upserta `reservation_payments` e depois chama a RPC que atualiza `reservations`; essas operações não estão numa única transação. Se a RPC falhar após o upsert, a rota retorna 500 e pode depender de nova entrega do webhook para concluir. O estado “pago” no pedido do provedor, na linha de pagamento e na reserva pode divergir temporariamente.
- **Pagamento após cancelamento:** as RPCs de cancelamento alteram `reservations.status` para `cancelled`, sem invalidar o pedido Pagar.me nem limpar `payment_status='pending'`. O webhook verifica `payment_status` e valor, mas não exige que a reserva continue ativa; `complete_reservation_payment` marca o pagamento como `paid`, porém só troca o status da reserva de `pending` para `confirmed`. Portanto, um PIX liquidado depois do cancelamento pode resultar em reserva ainda `cancelled` com pagamento `paid`. O código não implementa reembolso automático nem resolução operacional desse caso.
- Apenas `order.paid` é processado. Eventos de falha, expiração e reembolso não são sincronizados por esse handler, apesar de existirem estados correspondentes na tabela. O código não demonstra fluxo de reconciliação ou reembolso.
- `group_reservation_fee` é aceito pelo webhook, mas a busca no código rastreado não encontrou criador de pedido PIX com essa finalidade; `/api/payments/pix` usa `reservation_fee`.

Testes relacionados: `tests/pix-access-route.test.ts` cobre ausência de token; `tests/pagarme.test.ts` cobre validação de CPF; `tests/database/current-mechanisms.test.mjs` cobre valor exato e repetição da RPC de conclusão. Não encontrei teste de rota/webhook que cubra reentrega, falha parcial entre upsert e RPC, estados failed/expired/refunded ou duplicidade de eventos de auditoria.

## Regras confirmadas pelo responsável — ainda não refletidas integralmente no código

- Se o pagamento chegar depois do cancelamento, a reserva deve continuar explicitamente cancelada e o pagamento deve aparecer como pago. O sistema deve sinalizar à equipe que precisa contatar o cliente; após esse contato, o restaurante decide se mantém o cancelamento ou se a reserva foi apenas cancelada por atraso no pagamento. Não automatizar reativação ou reembolso.
- Em falha do pagamento, avisar ao cliente que a equipe do restaurante entrará em contato e marcar a reserva/pagamento para acompanhamento da equipe. Em expiração do PIX, registrar `expired` e oferecer à equipe a opção de contatar o cliente. A rota atual não processa esses eventos nem possui essa sinalização de acompanhamento.
- Ao alterar uma reserva existente de menos de 15 para 15 ou mais pessoas, a interface deve informar a taxa de R$ 100 assim que a quantidade atingir o limite; ao confirmar, deve iniciar o PIX e exibir o QR Code. A alteração deve ficar pendente: manter a quantidade original até o pagamento ser confirmado, e só então aplicar a nova quantidade. A criação pública já informa a regra de grupo e inicia o PIX quando requerido, mas o fluxo de edição atual chama diretamente `PATCH /api/reservations/:id`; a modal de pagamento em `app/page.tsx` não tem caminho que a abra, e a atualização não cria uma cobrança. O teste `OUT-02` está marcado como `todo`, mas essa decisão de negócio foi confirmada pelo responsável; o teste e a implementação ainda precisam ser atualizados.
- Se a pessoa informar CPF que corresponda a uma reserva ativa na mesma data e turno/período de atendimento e tentar reservar pessoas adicionais, o sistema deve perguntar se quer acrescentar à reserva existente ou fazer outra. Almoço e jantar são períodos distintos: não pesquisar uma reserva de jantar ao solicitar almoço, nem o contrário. Se acrescentar pessoas a uma reserva de 15+ já paga, não deve cobrar outra taxa de R$ 100. Deve verificar o CPF e abrir `wa.me` para o cliente enviar manualmente nome, dados da reserva e a opção escolhida ao número do restaurante já configurado. Não incluir CPF na mensagem. A busca por CPF e turno está implementada no handler público; registros históricos sem turno classificado não entram na comparação, pois não é seguro inferir almoço/jantar. Em caso de correspondência, o sistema não cria outra reserva automaticamente: oferece as opções e encaminha a escolha à equipe pelo WhatsApp.
- Toda reserva deve exigir CPF, inclusive reservas sem taxa; e-mail é opcional. Isso foi confirmado para reservas em geral, incluindo os fluxos público e administrativo. Hoje o CPF só é validado como obrigatório quando há pagamento, e o e-mail é obrigatório na interface pública, no handler público e no formulário administrativo. Os tipos gerados também indicam `reservations.email` não anulável e `cpf` anulável; tornar e-mail realmente opcional pode exigir ajuste de schema/migration e tipos.
- Para grupos de 15 ou mais, a taxa confirmada é R$ 100,00. A criação pública já exibe o aviso e cria PIX; a alteração de reserva existente ainda não completa esse fluxo.

O requisito de WhatsApp acima é abrir um link `wa.me` com a mensagem pronta para o cliente enviar manualmente. A tela pública oferece as opções de acrescentar pessoas ou fazer outra reserva e prepara a mensagem com nome e dados da reserva, sem CPF. CRUD de templates existe, mas não foi localizado envio automatizado por provedor — e não é solicitado nesta regra.

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
- Implementar CPF obrigatório e e-mail opcional de ponta a ponta, incluindo validação do handler, formulários, persistência e migration/tipos se necessário; tratar dados históricos sem CPF conforme a política acordada, sem apagar registros automaticamente.
- Usar a mesma data e o mesmo turno/período de atendimento na busca por CPF; almoço e jantar são distintos. Registros históricos sem turno classificado (`commercial_turn` nulo) ficam fora da comparação para não associar períodos incorretos.
- Testar manualmente, no navegador, as duas opções de `wa.me` com nome, dados da reserva e a escolha entre acrescentar ou fazer outra, confirmando que o CPF não aparece na mensagem.
- Investigar alertas do provedor e processo operacional de reconciliação caso webhook falhe; não há evidência nesta leitura de módulo de conciliação contábil.
- Confirmar requisitos atuais do Pagar.me para a consulta autenticada usada em lugar de validação da assinatura do webhook antes de expandir a integração.
- O endpoint aceita `group_reservation_fee`, mas não foi localizado criador dessa finalidade; confirmar se é compatibilidade necessária ou código sem produtor antes de removê-la.
