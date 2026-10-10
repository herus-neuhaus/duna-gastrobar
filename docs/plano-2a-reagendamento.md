# Plano 2A — reagendamento com mesas alocadas

Execução: **2026-10-03**. Escopo: corrigir OUT-01 sem alterar regras comerciais,
pagamentos, duração configurada ou dados existentes.

## Situação

**Concluído.** A correção foi validada na reconstrução integral e na aplicação
incremental sobre uma base local anterior com dados sintéticos. Não houve escrita,
DDL, migração, `migration repair`, `db push`, reset, chamada Pagar.me ou alteração
de reservas/pagamentos no projeto Supabase remoto. A stack local foi usada apenas
em Docker e será encerrada ao fim das verificações.

## Causa confirmada

`sync_reservation_table_assignments` é um trigger `BEFORE UPDATE` em
`public.reservations`. Sua versão anterior detectava `NEW.reservation_date/time`,
mas chamava `get_reservation_occupancy_window(NEW.id)`. Como a linha ainda não
estava persistida, a função consultava a data/hora anterior; por isso a alocação
ativa permanecia na janela velha mesmo com a reserva atualizada.

O problema foi reproduzido na base pré-2A: reserva sintética às 12h, mesa alocada,
`UPDATE` para 18h, e comparação entre `assignment.starts_at` e a janela da reserva
atual retornou `false`.

## Solução adotada

A migração incremental
`20261003090000_sync_rescheduled_table_assignments.sql` é posterior ao último
histórico local/observado do Plano 1 (`20260910012742` remoto), portanto não altera
arquivos históricos.

Ela introduz `private.get_reservation_occupancy_window_for_slot(date, time)`, helper
não chamável por `anon` ou `authenticated`. O helper concentra a seleção de duração
e buffer da agenda específica da data ou semanal, e converte o início com
`America/Porto_Velho`.

- `public.get_reservation_occupancy_window(uuid)` mantém contrato e permissões,
  mas delega ao helper usando a linha persistida. Alocação e disponibilidade seguem
  utilizando o mesmo cálculo.
- O trigger continua `BEFORE`. Não foi convertido mecanicamente para `AFTER`.
  Agora ele passa explicitamente `NEW.reservation_date` e `NEW.reservation_time`
  ao helper, logo não lê valores antigos.
- Antes de mover alocações ativas, o trigger adquire `pg_advisory_xact_lock` de cada
  mesa ativa em ordem por ID. É a mesma chave/ordem usada na substituição de mesas.
  Isso serializa reagendamentos e substituições concorrentes que envolvem as mesmas
  mesas, sem tornar a constraint de exclusão dispensável.
- Apenas registros com `released_at IS NULL` são atualizados. Histórico liberado não
  é reescrito.
- A update da reserva e as updates das janelas ocorrem na mesma transação do
  `UPDATE`. A constraint `reservation_table_assignments_no_overlap` continua ativa:
  conflito `23P01`, agenda inválida, capacidade insuficiente ou outra exceção
  desfazem todas as mudanças, inclusive aquelas feitas anteriormente pelo trigger.
- A validação de quantidade permanece no mesmo trigger. Em alteração simultânea de
  horário e convidados, a janela é calculada para o novo horário e a validação de
  capacidade das mesas continua usando `NEW.num_guests`; uma falha é atômica.

Não houve alteração de duração, buffer, política de cobrança, limite de capacidade,
estado de reserva, status de pagamento ou regras de permanência.

## API e objetos alterados

- `app/api/reservations/[id]/route.ts`: o conflito de exclusão de mesa (`23P01` ou
  nome da constraint) passa a retornar HTTP 409 e a mensagem pública
  `Uma das mesas não está disponível para o novo horário.` Detalhes SQL permanecem
  apenas no log do servidor.
- `tests/reservation-status-route.test.ts`: valida a resposta 409 pública.
- `tests/database/rescheduling.test.mjs`: cobertura comportamental do PostgreSQL.
- `tests/database/rescheduling-incremental.test.mjs`: valida aplicação incremental.
- `scripts/local-db.mjs` e `package.json`: comandos locais explícitos para iniciar
  a base pré-2A e aplicar apenas esta migração; não aceitam URL/flags remotas.
- `supabase/inspection/expected-catalog-differences-plan-2a.json` e
  `scripts/compare-db-catalog.mjs`: diferenças intencionais de catálogo.

## Catálogo

O snapshot remoto original de 2026-10-03 em
`supabase/inspection/observed-2026-10-03.json` foi preservado e não foi alterado.
`npm run db:compare` compara a base local contra ele e reconhece somente estas
quatro diferenças, com hashes pós-migração fixados e justificativa explícita:

| Objeto | Alteração esperada |
|---|---|
| `private.get_reservation_occupancy_window_for_slot` | novo corpo e contrato de helper privado |
| `public.get_reservation_occupancy_window` | corpo passa a delegar; contrato RPC inalterado |
| `public.sync_reservation_table_assignments` | corpo usa valores `NEW` e locks por mesa |

O resultado final é: colunas, constraints, índices, políticas, triggers e grants
iguais ao catálogo base; um corpo histórico revisado do Plano 1; quatro diferenças
esperadas do Plano 2A; zero diferenças não revisadas. A trigger mantém mesmo nome,
evento e timing; somente sua função foi substituída. Como o helper está no schema
`private`, `npm run db:types:check` não exigiu mudança do contrato TypeScript
publico.

## Testes executados

### Reconstrução integral

`npm run db:start` aplicou o bootstrap, as 19 migrações prévias e a nova migração
sequencialmente em banco descartável. `npm run test:db` executou 20 testes: 19
passaram; OUT-02 permanece como um `TODO` falho intencional e não é contado como
aprovação.

Os oito casos aprovados específicos de reagendamento verificam no PostgreSQL:

1. 12h → 18h atualiza início/fim, libera 12h e ocupa 18h.
2. Mudança de data usa janela local em `America/Porto_Velho`.
3. Todas as mesas ativas são movidas juntas.
4. Alocação liberada preserva início/fim/histórico.
5. Reserva sem mesa pode ser reagendada.
6. Conflito em uma mesa retorna `23P01` e desfaz reserva, alocações ativas e
   histórico prévio.
7. Configuração específica de data aplica duração e buffer próprios.
8. Duas transações/conexões independentes disputando a mesma janela aguardam o
   advisory lock; somente uma ocupa a janela, sem sobreposição.

Um nono caso verifica mudança simultânea de horário e convidados: aumento acima da
capacidade alocada aborta tudo; aumento dentro da capacidade move a janela e mantém
a nova quantidade. Não introduz cobrança para 15 pessoas.

### Aplicação incremental local

```bash
npm run db:stop
npm run db:start:pre-plan-2a
npm run test:db:incremental
```

`start:pre-plan-2a` exclui somente a nova migração da cópia `.local-db/`; não é
um comando de produção. O teste cria dados sintéticos antes da correção, reproduz
o OUT-01, chama `db:apply:plan-2a` e este executa
`supabase migration up --local` para aplicar o arquivo canônico e registrá-lo no
histórico local. Uma reserva sintética existente então reage de 12h para 18h
com janela correta. O teste passou.

Após esse teste, a reconstrução integral foi repetida para validar a cadeia final.

### Verificações finais

| Comando | Resultado |
|---|---|
| `npm run db:start` | Bootstrap + 20 migrações aplicados em ordem |
| `npm run test:db` | 19 aprovados; OUT-02 permanece `TODO` conhecido |
| `npm run test:db:incremental` | 1 aprovado sobre base pré-2A |
| `npm run db:compare` | 4 diferenças esperadas, 0 inesperadas |
| `npm run db:types:check` | Tipos correspondem ao schema executado |
| `npm run typecheck` | Passou |
| `npm test` | 26 testes, 13 arquivos, todos passaram |
| `npm run lint` | Executado; sem erros, mantém avisos preexistentes |
| `git diff --check` | Passou |

## Dados antigos e reparação separada

A migração corrige apenas atualizações futuras. Ela não reescreve alocações reais
que possam ter sido movidas pela função defeituosa anteriormente. Isso é intencional
para preservar histórico e evitar atualização em massa sem aprovação.

Após implantação autorizada, a equipe pode executar **somente leitura** em ambiente
confirmado para contar alocações ativas inconsistentes. Não executar esta consulta
como rotina de produção neste plano:

```sql
select count(*) as inconsistent_active_assignments
from public.reservation_table_assignments assignment
join public.reservations reservation on reservation.id = assignment.reservation_id
cross join lateral public.get_reservation_occupancy_window(reservation.id) expected
where assignment.released_at is null
  and (assignment.starts_at, assignment.ends_at)
      is distinct from (expected.starts_at, expected.ends_at);
```

Se o resultado for maior que zero, abrir operação de reparação separada com:

1. confirmação do ambiente, backup e janela operacional;
2. listagem revisada pela equipe, sem dados pessoais no ticket/export;
3. critérios para ignorar reservas terminalmente liberadas e tratar agenda ausente;
4. transações com locks por mesa, reaplicação da mesma função de janela e validação
   da constraint de exclusão;
5. plano de reversão, amostragem posterior e comunicação operacional.

Não há SQL de reparação automática neste plano.

## Implantação e recuperação propostas

Não executar sem autorização explícita:

1. Confirmar ref/projeto/ambiente e que a versão de histórico imediatamente anterior
   é compatível com a matriz do Plano 1.
2. Fazer backup e rodar a consulta de detecção em modo leitura sob janela aprovada.
3. Aplicar **somente** `20261003090000_sync_rescheduled_table_assignments.sql` pelo
   mecanismo de migração autorizado ao ambiente correto; não usar bootstrap,
   `db push` de toda a pasta ou `migration repair`.
4. Verificar trigger/funções e executar smoke test sintético em homologação antes
   de produção. Não criar reservas reais nem cobranças Pagar.me.
5. Monitorar `23P01` e a resposta 409 durante a janela de observação.

A migração é transacional: erro ao criar/substituir funções a reverte. Se houver
incidente após aplicar, não apagar dados nem desabilitar a constraint. Criar uma
**nova** migração de reversão que restaure as funções anteriores somente após
avaliação de impacto; isso não altera automaticamente janelas já corrigidas.
Reparação de dados deve continuar separada.

## Pendências e limitações

- OUT-02 permanece aberto: aumento de 14 para 15 convidados não inicia cobrança.
  Destino: plano financeiro/regras de taxas. Não foi contado como teste aprovado.
- Realtime sem publicação, cron de expiração e demais achados do Plano 1 não foram
  modificados.
- A comparação de catálogo é estrutural e não substitui homologação/E2E de Auth,
  Storage, Realtime ou Pagar.me sandbox.
- A função de alocação/reagendamento mantém a interpretação atual de `ends_at`
  inclusivo na agenda, a duração e o buffer atuais; nenhuma regra comercial futura
  de turno, permanência, atraso ou pagamento foi antecipada.
