# Reservas, disponibilidade, mesas e operação

## Reservas

### Criação

Interface pública e formulário administrativo reutilizam `/api/reservations` com contexto/permissão diferente. O handler valida e normaliza campos, consulta regras e chama o banco para criação consistente. A reserva pode incluir quantidade de pessoas, data/hora, contato, observações, decoração e dados de cobrança conforme o dia/regra aplicável. Não deduzir valor comercial apenas pelo formulário: validar a função SQL e os campos de `special_dates`/reserva para a regra efetiva.

Credencial do cliente: `lib/reservation-access.ts` gera token aleatório de 32 bytes e guarda SHA-256; token em formato hex de 64 caracteres. RPCs protegidas atendem consulta, atualização e cancelamento sem exigir conta autenticada.

### Status e transições

`lib/reservation-status.ts` normaliza `cancelado` legado como `cancelled` e descreve permissões de ação: confirmar pending, cancelar pending/confirmed, acomodar confirmed e concluir seated. O banco também possui `transition_reservation_status` e trilha de eventos. A função client-side é orientação/UX; a operação persistente deve respeitar validação no servidor/banco.

Estados adicionais e exceções devem ser verificados na versão atual das migrations; este documento não cria uma nova máquina de estados.

## Disponibilidade e capacidade

- Endpoint: `GET /api/reservations/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Usa fuso `America/Porto_Velho`, limita consulta pública a hoje e próximos 10 dias, combina disponibilidade de capacidade, datas especiais e datas bloqueadas.
- A resposta agrega ocupação por turno/horário e datas consideradas completas. A capacidade limite de 80 aparece no handler para classificar disponibilidade, enquanto as RPCs e migrations definem a contabilização final; divergência entre limites é item para revisão.
- Funções de banco relevantes incluem versões de `get_reservation_capacity_availability`, `get_reservation_commercial_turn`, `get_reservation_service_start_for_commercial_turn`, `get_reservation_occupancy_window`, `validate_reservation_schedule` e verificações de disponibilidade. As migrations posteriores substituem versões históricas; usar o código mais recente aplicado, não somar regras antigas.
- A consulta informa disponibilidade, mas não reserva capacidade por si só; criação/alteração precisa revalidar atomicamente no banco.

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
