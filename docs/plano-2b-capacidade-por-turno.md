# Plano 2B: capacidade por turno

Execução local: **2026-10-03**. Este plano muda a capacidade pública para 80
convidados por data e turno, sem escrever, promover usuários ou aplicar DDL no
projeto Supabase remoto.

## Regra efetiva

- O limite é 80 convidados para cada par `reservation_date` e
  `service_starts_at`.
- `service_starts_at` é gravado na reserva no momento da criação/reagendamento.
  Mudanças posteriores da agenda não reinterpretam reservas históricas.
- Todos os estados não cancelados contam, inclusive `completed`, `no_show` e
  legados. Somente `cancelled` e `cancelado` não contam.
- Registros com `source = 'walk_in'` não entram na cota pública, mas continuam
  sujeitos à agenda e às regras operacionais existentes.
- A verificação usa advisory locks por data/turno, ordenados também durante uma
  mudança de turno. Duas inserções concorrentes não podem exceder 80.
- Capacidade e mesas são independentes. A reserva pública não exige mesa e a
  alocação de mesas continua protegida pelas regras do Plano 2A.

`public.get_reservation_capacity_availability(date, date)` alimenta a API de
disponibilidade. O site mostra horários que comportam a quantidade escolhida;
o formulário público e a alteração por token aceitam apenas de hoje até hoje +
10 dias, em `America/Porto_Velho`. A validação final continua no banco.

## Exceções e auditoria

Há duas autorizações independentes, ambas exclusivas de `profiles.role = 'dono'`:

| Exceção | Efeito |
|---|---|
| Capacidade | Permite ultrapassar 80 somente com motivo obrigatório. |
| Horário | Permite um horário fora da agenda somente com motivo e turno de referência válido. |

`create_reservation_with_owner_overrides(...)` verifica o dono no banco, cria a
reserva e registra em `reservation_override_audits` o ator, motivo, data,
turno e efeito da capacidade. A API pública não aceita bypass de um body sem
sessão de dono. O formulário de reserva interna expõe os campos de motivo; para
qualquer outro papel, a API responde 403.

Não há dono observado na leitura agregada do ambiente remoto em 2026-10-03.
Isso não foi corrigido automaticamente. Antes de usar exceções, uma pessoa
autorizada deve designar o dono inicial pelo procedimento corporativo aprovado,
com registro de quem foi designado, em qual ambiente e por qual motivo. Não
promover contas reais como parte desta migração.

## Histórico sem turno

A migração preenche `service_starts_at` somente quando a reserva ativa é
inequívoca na agenda instalada. Ela não tenta inferir um turno para horários
que não pertencem à agenda atual.

Esses casos aparecem em `public.reservation_turn_classification_issues`. Enquanto
existir uma linha ativa sem turno para uma data, novas reservas públicas para a
data falham fechadas com `RESERVATION_TURN_CLASSIFICATION_REQUIRED`; a API de
disponibilidade também a esconde. A resolução autorizada é
`classify_reservation_service_period(reservation_id, service_starts_at, reason)`,
restrita ao dono e registrada em `reservation_events` com o ator e motivo.

Leitura agregada remota anterior identificou **10** reservas ativas que não
podiam ser classificadas pela agenda atual. Portanto, este plano **não está
autorizado para promoção em produção** até que a equipe, em ambiente confirmado,
revise cada uma, defina o turno correto e execute a classificação autorizada.
Não substituir essa revisão por preenchimento em massa ou regra baseada apenas
no horário.

## Implantação autorizada

1. Confirmar ambiente, backup e compatibilidade com a migração imediatamente
   anterior `20261003090000_sync_rescheduled_table_assignments.sql`.
2. Executar somente leitura em `reservation_turn_classification_issues` e
   registrar a decisão de turno para cada linha, sem exportar dados pessoais.
3. Designar o dono inicial por processo aprovado, se ainda não houver um.
4. Aplicar somente `20261003100000_capacity_by_service.sql` pelo mecanismo de
   migração autorizado. Não usar bootstrap, `db push`, reset ou promotion
   automática de usuário.
5. Com sessão do dono, classificar os casos revisados via rota operacional
   `POST /api/admin/operations` com `action: "classify_reservation_turn"`,
   `reservationId`, `serviceStartsAt` e `reason`.
6. Confirmar que a view não retorna linhas ativas, revisar auditorias e fazer
   smoke test em homologação antes de liberar reservas públicas.

Se a migração falhar, ela é transacional. Após aplicada, não apagar auditorias
nem desabilitar triggers para contornar incidentes; criar uma nova migração de
reversão somente após análise de impacto.

## Verificação local

`npm run test:db` cobre capacidade concorrente no mesmo turno, almoço/jantar
independentes, exclusão de walk-ins, estados `completed`/`no_show`, detecção e
classificação de histórico sem turno e exceções de dono auditadas. OUT-02
permanece `TODO` e não é contado como aprovação.

O snapshot remoto original continua imutável em
`supabase/inspection/observed-2026-10-03.json`. As diferenças estruturais e de
funções deste plano ficam em
`supabase/inspection/expected-catalog-differences-plan-2b.json`; `npm run
db:compare` deve terminar sem diferenças não revisadas.
