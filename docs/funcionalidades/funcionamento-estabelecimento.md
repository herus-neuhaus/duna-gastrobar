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

## Integração e segurança

`get_reservation_available_times` e `reservation_time_is_available` consultam o
mesmo funcionamento efetivo. A reserva pública, criação interna e operação do
dia usam as RPCs existentes. O site busca o horário publicado pela API; o painel
oferece horários da agenda também para datas além do limite público de dez dias.

O salvamento é serializado com criação/reagendamento e faz rollback se invalidar
reservas futuras ou mudar a identidade de um período de decoração em uso. Não
cancela, reclassifica ou reagenda clientes automaticamente. Exceções de horário
autorizadas continuam seguindo seu fluxo próprio e auditado.

As reservas guardam permanência/preparação aplicadas e o vínculo com o período.
Editar a configuração não muda sua janela histórica de ocupação de mesas.
Períodos removidos são desativados, não apagados com cascata para reservas.

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
agenda considera todas as reservas futuras e não pode concorrer com as fixtures
da outra suíte. Testes novos são transacionais e não deixam configurações ativas.
