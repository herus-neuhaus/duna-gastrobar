# Funcionamento do estabelecimento

## Acesso e escopo

Administradores acessam **Configurações → Estabelecimento** (`/admin?view=estabelecimento`).
As novas tabelas são `configuracoes_estabelecimento`, `dias_funcionamento`,
`periodos_funcionamento` e `alteracoes_funcionamento`. As tabelas existentes
mantêm os nomes originais. Somente administradores podem salvar, com sessão autenticada,
RPC transacional, controle de versão e auditoria imutável.

## Funcionamento não é janela de reserva

- Um dia semanal ou excepcional contém vários períodos de abertura/fechamento.
- Uma exceção substitui o funcionamento da semana, inclusive para fechar o dia.
- A madrugada é suportada no funcionamento; uma exceção fechada por data também
  impede o atendimento que atravessaria a meia-noite anterior naquela data.
- `reservation_schedule_slots` mantém primeira/última **entrada**, intervalo,
  permanência e preparação. Seus registros apontam para `periodos_funcionamento`.
- A permanência deve caber em um período aberto. Preparação da mesa pode terminar
  após o fechamento público. Janelas de reserva não atravessam a data civil.
- `reservation_schedule_date_slots` continua substituindo a agenda de reservas
  da semana. Exceções de funcionamento restringem essas janelas, sem ampliá-las.
- `blocked_dates` continua bloqueando reservas, não significa casa fechada.
- `special_dates` continua definindo eventos e preços, não funcionamento.
- Almoço/jantar e suas cotas atuais são preservados. Cadastro livre de outros
  serviços exigirá migração própria das regras de capacidade e classificação.
- Dias e turnos são independentes: é válido configurar segunda-feira apenas
  no almoço e domingo apenas no jantar, sem cadastrar o outro turno.
- O intervalo padrão de 30 minutos espaça entradas, não mede permanência real
  e não limita o número de grupos por horário. Não foi fixada permanência de
  40 minutos nem modificados os valores já configurados.

## Integração e segurança

`get_reservation_available_times` e `reservation_time_is_available` consultam o
mesmo funcionamento efetivo. A reserva pública, criação interna e operação do
dia usam as RPCs existentes. O site busca o horário publicado pela API; o painel
oferece horários da agenda também para datas além do limite público de dez dias.

O salvamento é serializado com criação/reagendamento. Alterar ou remover horários,
inclusive em dias que continuam abertos, bloqueia novas reservas nesses horários,
mas preserva as já cadastradas com seu contexto original,
inclusive mesas e decorações. Elas continuam podendo ser confirmadas, atendidas
e canceladas; alterações no mesmo horário não dependem da reabertura da agenda.
Reagendar pelos fluxos normais exige um horário da nova agenda. Exceções
administrativas explícitas continuam no fluxo autorizado e auditado já existente.

Essa preservação foi adicionada em
`supabase/migrations/20261016043427_preservar_reservas_em_dias_fechados.sql`.
O calendário público consulta a disponibilidade do banco para desabilitar dias
sem horários, em vez de fixar dias da semana diretamente no frontend.

A migration local `20261021000447_reservas_ativas_e_preservacao_agenda.sql`
amplia a preservação para alterações em dias abertos. Reservas sem contexto
original suficiente continuam exigindo revisão, em vez de inferência silenciosa.
Não cancela, reclassifica ou reagenda clientes automaticamente. Uma decoração
preservada não fica disponível apenas porque a primeira entrada mudou: continua
comprometida no turno original e nas janelas de mesa sobrepostas. Períodos
distintos que não foram alterados mantêm a regra existente de decoração.

As reservas guardam permanência/preparação aplicadas e o vínculo com o período.
Editar a configuração não muda sua janela histórica de ocupação de mesas.
Períodos removidos são desativados, não apagados com cascata para reservas.

## Capacidade e saída registrada

Decisão confirmada nesta alteração: como não se conhece a permanência real, a
disponibilidade futura continua conservadora, por data e turno. Soma pessoas de
reservas `pending`, `confirmed` e `seated`, incluindo os aliases legados
`pendente`/`confirmado`. Concluir o atendimento libera a cota; cancelamento e
registro de não comparecimento também deixam de consumir lugares. Walk-ins
continuam fora dessa cota, conforme decisão explícita; portanto o indicador não
é uma medição de todas as pessoas fisicamente presentes no restaurante.

Exemplo: 10 pessoas às 19h não bloqueiam outras 10 às 19h30 ou 20h. A soma de
reservas ativas pode chegar a 80; uma nova reserva que ultrapasse o limite é
recusada, salvo a exceção de capacidade autorizada já existente. A passagem de
30, 40 ou 120 minutos **não libera lugares**. A equipe precisa registrar a saída
concluindo o atendimento. Sem saída registrada, reservas futuras no mesmo turno
continuam comprometendo capacidade, mesmo em horários diferentes.

Permanência e preparação continuam parâmetros previstos para planejamento de
mesas e validação da última entrada, não limites impostos à estadia do cliente.
A preparação não entra na capacidade de pessoas. O fluxo de mesas permanece
baseado em suas janelas e liberação já existentes; não foi criado um novo estado
operacional de mesa em limpeza nem uma rotina de liberação automática.

## Instalação e validação

A migração é `supabase/migrations/20261016034718_configuracoes_estabelecimento.sql`,
com versão alinhada ao histórico registrado pelo MCP no Supabase remoto.
Em uma instalação nova, a sugestão inicial reproduz o texto antigo do site
(terça a domingo, 11h30–23h), mas **só restringe reservas depois da primeira
confirmação do dono**. Até lá, a agenda anterior continua funcionando.

Esta migração foi aplicada no Supabase remoto com autorização explícita. A
validação confirmou preservação dos dados comerciais das reservas e da agenda
semanal, disponibilidade inalterada antes da ativação e restrições de acesso às
novas tabelas. O deploy da aplicação e a confirmação dos horários pelo dono são
etapas separadas; a aplicação da migração não publica o frontend.

O advisor sinaliza a RPC `salvar_funcionamento_estabelecimento` por usar
`SECURITY DEFINER` com execução por `authenticated`. É intencional: a função
verifica o nível Administrador antes de qualquer escrita; `anon` não tem execução e usuários
autenticados não têm escrita direta nas tabelas. Os testes cobrem essa fronteira.

Em outros ambientes, revisar backup/ambiente e aplicar pelo processo autorizado.
Sem a migração, a API informa indisponibilidade; o site orienta consultar o WhatsApp.

No banco Docker isolado existente:

```sh
npm run db:apply:estabelecimento
npm run db:types
npm run test:db:estabelecimento
npm run test:db
```

Executar as duas suítes de banco **sequencialmente**, pois o salvamento de uma
agenda considera o contexto das reservas futuras e não pode concorrer com as fixtures
da outra suíte. Testes novos são transacionais e não deixam configurações ativas.

### Situação da alteração de capacidade e preservação

A migration foi aplicada em produção pelo MCP com o nome
`reservas_ativas_e_preservacao_agenda`, versão remota **20261021005132**.
O arquivo local continua sendo
`20261021000447_reservas_ativas_e_preservacao_agenda.sql`; a diferença de timestamp
foi gerada no registro pelo MCP e não deve motivar reaplicação ou repair.
O script `db:apply:estabelecimento` acima aplica somente as migrations históricas
listadas nele, não esta nova migration. Não usar esse comando como implantação
da mudança. Não foram alterados os runners incrementais antigos.

Para a atualização controlada, o executor autorizado deve verificar as funções
atuais e os contextos legados, selecionar somente a nova migration e comparar
as definições antes/depois. As substituições SQL falham e fazem rollback quando
não encontram as precondições esperadas; não reenviar toda a pasta histórica.
Não há alteração de contrato público RPC nem necessidade de editar tipos gerados.

Validar em ambiente isolado: reconstrução e atualização incremental,
capacidade concorrente após saída, permissões/nonce de exceção, preservação de
reservas/mesas/decorações e recusa de novas entradas em horários removidos.
Na preparação local, Docker não foi utilizado e o MCP estava indisponível;
os testes PostgreSQL isolados continuam pendentes. Testes Vitest não substituem
essa evidência. Solicitar revisão
independente antes de implantar. Reversão exige restaurar as definições anteriores
revisadas; reativar a contagem de reservas concluídas pode fazer turnos já atendidos
parecerem completos, e restaurar a proteção de agenda pode voltar a impedir edições.

Verificação local desta alteração: `npm run typecheck`, `npm run lint` e
`npm test` concluíram sem falhas (26 arquivos, 112 testes Vitest). Os testes de
banco foram atualizados, mas não executados; tampouco houve QA visual ou teste
real de RLS/locks/concorrência nesta etapa.

### Preflight MCP em produção — 2026-10-21

- Projeto confirmado pela URL do MCP: `gnakcuvfxltbgpssirpv`, tratado como produção.
- Histórico remoto no preflight: 41 migrations aplicadas, até
  `20261016043427_preservar_reservas_em_dias_fechados`. A única mudança nova pendente
  naquele momento era `20261021000447_reservas_ativas_e_preservacao_agenda.sql`.
  Diferenças históricas de timestamps não são migrations a reaplicar.
- Foram inspecionados catálogo, corpos das funções afetadas, triggers, view,
  constraints/índices, RLS e grants; somente metadados, sem leitura de PII.
- A guarda textual da soma de capacidade dependia de seis espaços, enquanto a
  função efetiva contém cinco. O arquivo **ainda não aplicado** foi ajustado para
  aceitar whitespace nessa cláusula delimitada por `source`, preservando o teste
  de duplicidade de telefone. Nenhuma migration histórica foi alterada.
- SELECT de preflight confirmou exatamente uma correspondência para cada uma
  das oito substituições esperadas, ausência do helper novo e da migration no
  histórico, e ausência de CREATE no schema public para anon/authenticated.
  Isso comprova precondições de catálogo, não execução ou teste da migration.
- Advisors consultados como baseline: segurança com 10 avisos de funções
  SECURITY DEFINER executáveis por authenticated, proteção de senhas vazadas
  desativada e uma tabela com RLS sem policy; performance com 11 FKs sem índice,
  cinco avisos de initplan RLS, 17 índices não utilizados e 16 policies permissivas
  múltiplas. Não foram corrigidos incidentalmente nem comparados após implantação,
  pois nenhuma implantação ocorreu.
- O usuário inicialmente informou que precisava verificar o backup recuperável.
  A aplicação ficou suspensa nessa etapa; ainda não havia `apply_migration`, DML,
  fixtures, testes de permissão ou disputas simuladas em produção.
- Em seguida foi informado que o projeto não possui plano Pro. Isso não impede
  backup lógico manual, recomendado pela documentação oficial para o plano Free,
  mas não confirma uma cópia recuperável existente. O MCP disponível não oferece
  backup completo; não se exportaram registros de clientes por SQL para improvisá-lo.
  A aplicação permaneceu suspensa até o usuário informar que havia acabado de
  fazer o backup e autorizar novamente a execução. Não houve uso de Docker.

### Aplicação MCP e pós-verificação — 2026-10-21

- Após confirmação do backup pelo usuário e nova autorização, foram revalidados
  a URL do projeto e o histórico. Foi enviada somente a migration revisada,
  integralmente, para `apply_migration`; a ferramenta retornou `success: true`.
- A versão registrada é **20261021005132**, nome
  `reservas_ativas_e_preservacao_agenda`. O histórico passou de 41 para 42 entradas.
  Não houve reaplicação de bootstrap, pasta histórica, repair/reset ou renomeação
  do arquivo local já aplicado.
- A migration atualiza oito funções existentes, cria um helper privado, altera
  uma view e recria um trigger, com as revogações específicas revisadas. Não
  executa DML sobre reservas, pagamentos, clientes ou configuração operacional;
  não configura automaticamente horários novos nem cancela/reagenda reservas.
- Consultas pós-aplicação confirmaram os nove corpos de função esperados, a
  preservação do contexto na função de salvar agenda, a permanência dos locks e
  do consumo de nonce no corpo da função de capacidade, `security_invoker=true`
  na view e o trigger habilitado também para alterações de status.
- ACLs verificadas: anon/authenticated sem EXECUTE no helper/trigger; RPC de
  capacidade executável por service_role, não por anon/authenticated; INSERT
  direto de reservas segue negado a anon/authenticated. RLS continua habilitado
  nas tabelas afetadas. Essa inspeção não foi uma tentativa real de burlar acesso.
- Leituras agregadas das RPCs executaram sem erro: 109 entradas de disponibilidade,
  nenhuma linha com turno nulo ou ocupação nula/negativa, cinco opções de decoração
  e nenhum resultado nulo de disponibilidade. O leitor de decorações delega ao
  novo helper de preservação. Nenhuma fixture foi criada e nenhum registro foi
  modificado para teste.
- Os advisors foram comparados antes/depois: mesmas categorias e contagens
  de avisos de segurança e performance descritas no preflight. Os avisos existentes
  não foram resolvidos incidentalmente. Referências: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  [funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Backup: realização informada pelo usuário; este agente não exportou dados nem
  executou sua restauração. Permanecem não executados testes PostgreSQL isolados
  de criação, salvamento, concorrência e RLS, QA visual e revisão independente.
  Leituras reais de produção não substituem esses testes.
- Não houve deploy do frontend. Não se editaram tipos gerados: os contratos
  públicos não foram alterados. A confirmação da migration não comprova o fluxo
  completo renderizado ou a implantação do código local da aplicação.

Reversão, se necessária, exige restaurar as definições anteriores de funções,
view e trigger, remover o helper somente depois de resolver as dependências e
revisar os efeitos nas reservas que passarem a usar as novas regras. Isso requer
operação específica e aprovada, registrada por nova migration, sem apagar ou
reparar o histórico. A disponibilidade do backup completo é uma proteção adicional,
não autorização para restaurar produção ou perder alterações posteriores sem revisão.
