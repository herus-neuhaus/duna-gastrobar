# Reservas — aplicação das duas migrations em 03/11/2026

## Resultado e escopo

Projeto confirmado pela URL `https://gnakcuvfxltbgpssirpv.supabase.co`, tratado
como produção. Acesso exclusivamente pelo MCP `supabase_duna`, sem usar a conexão
antiga `supabase`. O usuário aprovou separadamente cada migration e as leituras
de catálogo antes/depois. Não houve commit, push ou deploy da aplicação.

| Arquivo local executado integralmente | Nome / versão remota confirmada |
|---|---|
| `supabase/migrations/20261029234421_cpf_apenas_reservas_com_pagamento.sql` | `cpf_apenas_reservas_com_pagamento` / `20261103194610` |
| `supabase/migrations/20261030013127_antecedencia_reservas_duas_horas.sql` | `antecedencia_reservas_duas_horas` / `20261103194630` |

Cada chamada `apply_migration` retornou `success: true`. A primeira condiciona
CPF ao pagamento/grupo/evento pago, preservando a exceção de walk-in. A segunda
troca 8 por 2 horas, mantendo `America/Porto_Velho`, agenda, override autorizado
e preservação de registros sem mudança de data/hora. A janela de hoje +60 dias
é implementada no calendário/APIs; não precisou de DDL adicional.

Não foram emitidos INSERT/UPDATE/DELETE em tabelas de negócio, criadas reservas
de teste, cobranças, mensagens ou fixtures em produção. Não houve alterações
de Auth, capacidade, RLS, cron, Storage ou Edge Functions.

## Precondições, reversão e histórico

- Tabelas/colunas necessárias inspecionadas por metadados; nenhuma leitura de
  contatos, CPF, tokens ou pagamentos de clientes.
- `require_reservation_cpf_for_bookings` ativo, BEFORE INSERT; originalmente
  exigia CPF em qualquer reserva não walk-in.
- `validate_reservation_schedule` ativo, BEFORE INSERT OR UPDATE OF data/hora;
  originalmente exigia oito horas. As definições conferiam com as precondições.
- Cópia recuperável dos objetos modificados e ACLs observadas em
  `supabase/inspection/2026-11-03-reservas-publicas-antes.sql`. Cobre somente essas
  funções; não é backup integral dos dados. Backup integral do projeto não foi
  verificado nesta tarefa.
- Reversão exige aprovação específica e restauração revisada das funções;
  não apagar clientes/reservas criadas após a mudança, não fazer reset/repair do
  histórico e não executar o snapshot automaticamente como migration pendente.
- O MCP gerou timestamps remotos distintos dos locais. A tabela acima reconcilia
  as duas operações pelo conteúdo e nome; não renomear histórico nem enviar toda
  a pasta por `db push`. Outras divergências históricas seguem fora deste escopo.

## Verificação realizada

- SELECT de catálogo aprovado, antes/depois: novas definições presentes,
  triggers e `tgenabled=O` preservados, mesmas ACLs e `SECURITY INVOKER` nas duas
  funções. Nenhuma abertura nova de privilégios.
- `list_migrations` confirmou as duas versões remotas acima.
- Advisor de segurança antes/depois sem novos achados: permanecem um informativo
  de RLS sem policy em nonces, dez avisos sobre funções SECURITY DEFINER executáveis
  por authenticated e proteção de senhas vazadas desabilitada. Não foram corrigidos
  incidentalmente; a classificação do advisor não é prova de exploração.
- `npm run typecheck`, `npm run lint` e `npm test` aprovados novamente;
  **174 testes em 29 arquivos**. As mensagens de erro nos testes são mocks de
  cenários negativos, não erros observados em produção.
- `git diff --check` executado na entrega para verificar formatação dos patches.

Não houve novas execuções de testes PostgreSQL isolados, concorrência real,
navegador/E2E, Pagar.me sandbox ou build de produção nesta etapa. Os nove testes
SQL de antecedência continuam pendentes; a leitura do catálogo não os substitui.
Revisão independente ainda necessária; esta entrega não é aprovação independente.

## O que ainda impede considerar o pacote financeiro concluído

**Alto — edição 14→15 ainda contorna a cobrança esperada.**
`app/page.tsx` (`handleChangeQuantity`) envia a quantidade diretamente ao PATCH;
`app/api/reservations/[id]/route.ts` chama `update_reservation_with_access_token`.
A definição instalada dessa RPC aceita a reserva `not_required` e altera
`num_guests` sem criar uma cobrança. Nenhuma destas migrations altera esse caminho.

A regra aprovada é cobrar R$ 100 ao cruzar o limite, manter a quantidade original
até o PIX confirmado e reter temporariamente a capacidade adicional durante a
validade da cobrança, liberando a retenção ao expirar ou cancelar. Para concluir:

1. Persistir o pedido de alteração/cobrança, snapshot e validade da retenção, com
   validação do token e serialização usando a proteção de capacidade existente.
2. Contabilizar a retenção na disponibilidade e nas gravações concorrentes;
   impedir que o caminho antigo/RPC aplique 15+ sem cumprir a regra de pagamento.
3. Integrar CPF válido, consentimento, geração/retomada do PIX e exibição do QR
   Code à edição. A rota atual de PIX exige pagamento já pendente na reserva;
   simplesmente chamá-la para uma reserva gratuita não inicia a alteração paga.
4. Vincular a ordem à alteração exata e aplicar a quantidade atomicamente no
   webhook confirmado. Tratar repetição e falha parcial sem duplicar cobrança,
   exceder capacidade ou reativar reservas canceladas. A confirmação atual só
   atualiza status/pagamento, não a quantidade pretendida.
5. Tratar expiração/cancelamento e pagamento tardio sem aplicar alterações a um
   pedido já inválido. Manter pagamento registrado e acompanhamento pela equipe;
   não inventar reembolso/reativação automáticos. Preservar a regra de não cobrar
   novamente grupo já pago e a precedência de evento sobre taxa de grupo.
6. Testar token incorreto, capacidade concorrente/retida, limites 14/15, retry,
   webhook duplicado, expiração, cancelamento e pagamento tardio em ambiente
   isolado/sandbox autorizado; revisar independentemente antes de publicar.

O banco está atualizado **somente para CPF/antecedência**. O deploy da aplicação
e a conclusão do fluxo financeiro 14→15 são pendências distintas; não apresentar
essas duas migrations como implementação ou liberação do pacote completo.

## Correção local posterior — PIX e reentrega (não implantada)

Após a auditoria, o responsável adiou explicitamente a edição 14→15 e autorizou
somente a correção da disputa PIX/webhook e da reentrega. Os handlers de pagamento
agora compartilham persistência com INSERT sem sobrescrever conflitos, validação
de vínculo/valor e UPDATEs condicionais. A geração não grava `pending` sobre pago;
reentrega da mesma ordem retorna 200 sem regravar `paid_at` ou status pago. Resposta
`paid` do próprio provedor também chama a conclusão existente.

Não exige migration, mudança em tipos gerados ou nova RPC. Não houve escrita remota,
reparação de pagamentos históricos, commit, push ou deploy desta correção. As duas
gravações continuam separadas; falha parcial retorna erro e exige retry. Mocks de
transporte HTTP em `tests/reservation-payment-race.test.ts` não substituem teste
de PostgreSQL concorrente, sandbox Pagar.me ou revisão independente.

Verificações locais desta correção: `npm run typecheck`, `npm run lint`,
`git diff --check` e `npm test` passaram; **198 testes em 30 arquivos**, incluindo
24 novos casos de pagamento. O transporte HTTP em memória testa a serialização
real do cliente Supabase, mas emula filtros e RPC; não comprova locks/RLS do banco.
Build Next.js desta correção também passou pelo wrapper isolado, com configuração
fictícia e bloqueio de rede de negócio. O `.next` resultante não pode ser usado para
deploy. Houve aviso não bloqueante de Browserslist desatualizado; nenhuma instalação
ou atualização incidental foi feita.

## Ajuste posterior de contato PIX — e-mail (somente local)

O responsável aprovou novamente o e-mail no formulário **apenas quando houver
pagamento**, após conferir a exigência na documentação PIX Pagar.me. O HAR de erro
indicava ausência de QR Code, mas não continha a justificativa do gateway; não é
prova da causa específica da ordem. Nenhum HAR, contato ou credencial real foi
copiado para código/fixtures.

Formulário público, API de criação e geração PIX agora validam e-mail. O campo
administrativo existente indica obrigatoriedade quando houver pagamento. Endereços
acima dos 64 caracteres do contrato são rejeitados em vez de truncados. A geração
aceita e-mail salvo ou informado com token válido e só grava contato enquanto o
pagamento da reserva continua pendente. Diagnóstico de ausência de QR Code usa
somente estados em allowlist/código HTTP e presença de erros, sem dump da ordem.

Verificações desta etapa: TypeScript, lint, `git diff --check`, **217 testes em
30 arquivos** e build isolado com integrações fictícias passaram. Inclui validação
do e-mail obrigatório no mock de criação de ordem; não comprova emissão real de
QR Code. Não houve navegador/E2E novo, sandbox Pagar.me, PostgreSQL concorrente
nem revisão independente. O artefato `.next` fictício não pode ser publicado.

Sem nova migration, backfill, nova chave de idempotência, recriação de reserva ou
reparação de ordem existente. Não houve deploy ou operação remota nesta correção.
Horizonte de 60 dias, antecedência de 2h e adiamento da edição 14→15 permanecem.
Antes de tentar recuperar uma cobrança anteriormente recusada, conferir o pedido
existente no provedor e aprovar a operação separadamente; não contornar a falha
gerando outra cobrança às cegas.
