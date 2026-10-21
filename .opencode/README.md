# Desenvolvimento assistido por IA — Duna

`AGENTS.md` fornece o contexto permanente. Agentes ficam em `agents/` e as seis
skills autorais em `skills/`. As duas skills Supabase permanecem intactas em
`.agents/skills/`, com origem no `skills-lock.json` existente. São **oito skills
de projeto**; skills nativas como `opencode` e `report` não entram nessa contagem.

## Uso e fluxo

Novas sessões usam `duna-orchestrator`; sessões existentes preservam a seleção.
Selecione o agente na interface do OpenCode ou peça ao orquestrador uma tarefa:

- “Analise o fluxo de lista de espera; proponha critérios antes de implementar.”
- “Use duna-ui-ux para auditar a densidade do financeiro, sem alterar regras.”
- “Implemente a correção aprovada e peça revisão independente.”

Mudanças relevantes: **Produto → UI/UX → Engenharia → Qualidade**. UI/UX é
dispensável para mudanças sem interface; correções pequenas podem ir diretamente
a engenharia e revisão proporcional. O orquestrador não aciona todos por padrão.
Só ele pode delegar, exclusivamente aos quatro especialistas Duna. Especialistas
têm modo `all` para uso direto ou delegado, sem delegação recursiva.
O sexto perfil, `duna-database`, é um agente `primary` selecionado diretamente
pelo usuário. Não faz parte da lista de delegação: acesso remoto não é herdado
nem acionado automaticamente pelo orquestrador.

| Agente | Skills de projeto permitidas | Edição/shell |
|---|---|---|
| Orchestrator | Produto | Sem edição/shell; também pode carregar a skill nativa `opencode` |
| Product | Produto | Somente leitura |
| UI/UX | UI/UX; produto se houver ambiguidade | Somente leitura |
| Engineering | Frontend, backend, dados e duas Supabase | Edição local; shell sob aprovação, salvo inspeções Git exatas |
| Quality/security | QA, produto, UI/UX, dados e duas Supabase | Sem ferramenta de edição; inspeções Git e verificações enumeradas, testes sob aprovação |
| Database | Dados, produto e duas Supabase | Metadados via MCP; SQL/migrations/logs sob aprovação; edição restrita de SQL/testes/documentação sob aprovação; sem shell arbitrário |

As descrições são anunciadas conforme permissões; os corpos são carregados pelo
tool `skill` somente quando a tarefa exigir. Não há `instructions` incluindo
todas as skills nem importação de caches Codex.

## Modelo e segurança

Modelo/variante confirmados no catálogo durante a implementação:
`openai/gpt-6.1-sol#high`. Os agentes usam essa referência; o padrão do projeto
é o mesmo modelo, com `reasoningEffort: high`, pois o default raiz V2 não retém
`#variant`. Seleção já gravada em uma sessão tem precedência sobre o default.

A configuração de servidor Supabase global não é reescrita nem duplicada aqui.
As permissões **locais** negam Code Mode (`execute`) e Supabase por padrão,
inclusive para agentes genéricos. Os cinco perfis anteriores continuam sem
execução Supabase; apenas `duna-database` permite o wrapper `execute` e as
ferramentas enumeradas. Permissões aninhadas continuam sendo verificadas.

A policy ampla `supabase_*` permanece negada, com exceções nominais para as
ferramentas usadas pelo executor. Essas exceções de policy **não concedem acesso**:
apenas deixam a permissão do agente decidir. A allowlist do novo perfil permite:

- Metadados: URL/identidade do projeto, migrations, tabelas, extensões, advisors e
  documentação, sem confirmação por chamada.
- `execute_sql`, `apply_migration`, logs e geração de tipos: **ask**, exigindo
  aprovação. SQL de leitura também pede aprovação, pois `execute_sql` não separa
  SELECT de escrita. Não há liberação automática permanente.
- Ferramentas de criação/exclusão/reset/merge/rebase de branches, publicação de
  funções, alteração de Storage e obtenção de chaves: negadas. Ferramentas novas
  não enumeradas também permanecem negadas.

O escopo da conexão continua definido pelo MCP existente. O agente deve confirmar
o projeto antes de escrever; a permissão de tool não restringe seu argumento SQL
nem constitui isolamento entre ambientes. SQL e migrations podem ser destrutivos,
por isso exigem revisão do conteúdo e aprovação por operação. Políticas globais
ou gerenciadas de negação não podem ser superadas pelo perfil do projeto.

Produto/UI/orquestração não têm shell nem edição. Engenharia não tem aprovação
automática de comandos arbitrários; QA só pode pedir os comandos enumerados.
Credenciais, `.env`, material SSH e mutações diretas de `.git`/skills upstream
têm bloqueios adicionais. As permissões não são um sandbox de SO: shell aprovado
e testes executam código com privilégios do usuário e podem escrever artefatos ou
acessar rede. Revise comandos/scripts antes de aprovar; não use “permitir sempre”
para interpretadores genéricos. Não contorne negativas com shell ou outra ferramenta.

Implantação, cobranças e alterações remotas exigem tarefa/autorização separadas,
não apenas uma frase do agente. Aprovações não superam políticas de negação.

## Como usar o analista de dados/banco

1. Selecione **duna-database** no seletor de agentes do OpenCode. Se ainda não
   aparecer, recarregue o projeto/sessão para atualizar a descoberta. A seleção
   de uma sessão existente não muda automaticamente ao criar o arquivo.
2. Para análise, peça, por exemplo: “Confira o projeto conectado, o catálogo e as
   precondições da migration, sem alterar dados”. Consultas SQL e logs ainda
   exigirão aprovação das chamadas correspondentes.
3. Para implantação, autorize explicitamente ambiente e arquivo/SQL após revisão
   de impacto, testes disponíveis, backup recuperável e reversão. Aprove apenas
   a chamada revisada, não “permitir sempre” para SQL ou todas as ferramentas.
4. Ao terminar, retorne ao agente adequado à tarefa. Os outros perfis não recebem
   acesso ao Supabase por ele ter sido usado nesta sessão.

Criar esse perfil **não aplica a migration pendente** e não promove a própria
sessão atual. Não foram alterados OAuth, a configuração global do servidor,
credenciais ou as skills upstream; não é necessária reinstalação do MCP.

## Validação e manutenção

Com as dependências existentes do repositório disponíveis, execute:

```bash
node .opencode/validate.mjs
node .opencode/validate.mjs --runtime
```

O primeiro verifica arquivos, frontmatter, referências, versionabilidade e matriz
de regras dos seis agentes localmente, incluindo a exclusividade do executor,
aprovação obrigatória de SQL/migrations e negação de operações não enumeradas.
Usa `yaml`, já presente no lockfile, sem instalar dependências.
O segundo consulta somente GETs da API **local do OpenCode** para conferir parsing,
descoberta e permissões registradas. A CLI pode iniciar o serviço OpenCode se ele
não estiver rodando; não inicia a aplicação Duna nem chama ferramentas Supabase.
Não imprime configuração global, credenciais ou conteúdo de sessões.

Os cenários de permissão são avaliações das regras registradas, não tentativas
reais de editar, executar SQL ou invadir produção. Não comprovam sandbox de SO,
comportamento do modelo ou integração E2E. Testes de aplicação/banco e QA visual
dependem de tarefas próprias; as pendências históricas da auditoria não foram
corrigidas nesta implementação. Para atualizar regras/skills, mantenha entradas
curtas, referências válidas e revise a matriz; não altere o lockfile upstream para
simular origem de skills autorais, nem copie regras comerciais para vários prompts.

Validação da inclusão de `duna-database`: 849 verificações locais e 1.691 no
total com `--runtime`, confirmadas pelo OpenCode 2.1.1. O servidor reconheceu os
seis perfis, o modo primary e a matriz de permissões, inclusive a negação de
MCP/Code Mode nos agentes nativos build/plan/general/explore. Nenhuma ferramenta Supabase,
migration ou escrita remota foi executada nessa validação.
