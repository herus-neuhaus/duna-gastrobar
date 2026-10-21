# Auditoria de agentes, skills e instruções — Duna

Data: **20/10/2026**. Escopo: configuração de desenvolvimento assistido por IA, repositório e fontes locais/globais do OpenCode.

**Resultado:** o ambiente possui uma base técnica útil, mas ainda não tem arquitetura de agentes específica do Duna. As prioridades são instruções versionadas, procedimentos coerentes e proteção contra operações remotas indevidas — não instalar uma grande coleção de agentes ou skills.

## Escopo, método e limites

- A investigação foi somente leitura: arquivos, diretórios, metadados de pacotes, versão do OpenCode e documentação oficial V2.
- Não foram instaladas dependências, iniciados servidores, executados testes, migrations ou chamadas ao banco remoto.
- Não foram lidos arquivos de credenciais, valores de `.env` ou o banco interno de sessões do OpenCode.
- Configuração encontrada, ferramenta anunciada e funcionamento testado são evidências diferentes. O funcionamento operacional do MCP não foi testado.
- O Git estava limpo ao fim da investigação. Posteriormente, o usuário autorizou criar este relatório em `docs/`; isso não autoriza implementar suas recomendações.
- Este documento registra um retrato da auditoria, não uma garantia permanente sobre o ambiente ou a produção.

### Classificação das recomendações

| Classificação | Significado |
|---|---|
| **ESSENCIAL** | Necessária para segurança, confiabilidade ou reprodução do ambiente. |
| **RECOMENDADA** | Melhora relevante de organização e qualidade. |
| **OPCIONAL** | Adotar quando houver demanda comprovada. |
| **DESNECESSÁRIA** | Não agrega valor suficiente ao cenário atual. |

## 1. Resumo do ambiente detectado

### Raiz e organização

Raiz confirmada pelo diretório de trabalho e pelo Git:

```text
/home/herusneuhaus/Documentos/duna-gastrobar
```

É um único projeto Git. Não foram encontradas configurações de workspaces, Turborepo ou Nx. **Não há evidência de monorepo.**

```text
app/                    Páginas, painel administrativo e Route Handlers
components/ui/          Componentes compartilhados
hooks/                  Hooks React
lib/                    Autorização, pagamentos, reservas e clientes Supabase
supabase/
  bootstrap/            Base para reconstrução local isolada
  inspection/           Evidências e comparação de catálogo
  migrations/           25 migrations encontradas
scripts/                Fluxos locais de banco e comparação
tests/                  20 arquivos Vitest e 5 arquivos de banco
docs/
  funcionalidades/      Arquitetura e documentação por domínio
  plano-*.md            Relatórios e procedimentos técnicos
.agents/skills/         Duas skills locais
```

### Stack confirmada

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js App Router, React e TypeScript |
| Backend HTTP | Route Handlers do Next.js em `app/api/` |
| Persistência e regras concorrentes | PostgreSQL/Supabase, RPCs, triggers e constraints |
| Autenticação | Supabase Auth e integração SSR |
| UI | Tailwind CSS, Tucano, componentes próprios, Lucide e Motion |
| Pagamentos | Pagar.me |
| Recuperação por e-mail | Resend, conforme implementação/documentação |
| Testes de aplicação | Vitest, ambiente Node |
| Testes de banco | `node:test` + `pg`, banco local isolado |
| Gerenciador de pacotes | npm, com `package-lock.json` |
| Node.js local | `22.23.1` |

**Laravel não está presente.** PHP e Composer disponíveis na máquina não caracterizam a stack do repositório.

Versões resolvidas em `package-lock.json`, distinguindo-as dos intervalos declarados em `package.json`:

| Dependência | Versão |
|---|---|
| Next.js | 15.5.15 |
| React / React DOM | 19.2.5 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.1.11 |
| Tucano | 0.37.0 |
| `@supabase/supabase-js` | 2.105.3 |
| `@supabase/ssr` | 0.10.2 |
| Vitest | 3.2.4 |
| ESLint | 9.39.1 |
| `eslint-config-next` | 16.0.8 |
| `pg` | 8.20.0 |
| Motion | 12.38.0 |

Há dependências declaradas como Firebase Tools e Google GenAI sem uso localizado no código-fonte pesquisado. Isso é indício para auditoria posterior, não prova suficiente para remoção.

### Convenções estabelecidas

- TypeScript estrito e alias `@/*`.
- Banco como barreira final de concorrência e integridade.
- Clientes Supabase separados para navegador, sessão de servidor e acesso privilegiado.
- Componentes compartilhados e tokens visuais; React mantém o estado de campos controlados.
- Fuso de negócio `America/Porto_Velho`.
- Tipos de banco gerados, não destinados a edição manual.
- Ambiente local descartável separado do banco remoto.
- Documentação distingue implementação, planejamento e evidência histórica.
- Reservas e pagamentos de taxas não devem ser confundidos com o futuro domínio de consumo, comandas e fechamento.

### OpenCode

| Item | Resultado |
|---|---|
| Executável | `/home/herusneuhaus/.opencode/bin/opencode` |
| Versão instalada | **v2.1.1** |
| Configuração global | `/home/herusneuhaus/.config/opencode/opencode.json` |
| Configuração funcional encontrada | Um servidor MCP Supabase |
| Configuração OpenCode no projeto | Não encontrada |
| Modelo definido nos arquivos auditados | Não encontrado |
| Variante High definida nos arquivos auditados | Não encontrada |

A sessão identifica o modelo **GPT-6.1 Sol**. A variante **High** foi informada pelo usuário, mas não ficou comprovada pelos arquivos examinados. Não foi consultado o armazenamento interno de sessões para verificar essa preferência.

## 2. Inventário de agentes

### Agentes personalizados

**Nenhum agente personalizado encontrado.**

Foram verificados os candidatos locais, globais, de sistema e ancestrais:

- `.opencode/agents/` e `.opencode/agent/`;
- `opencode.json`, `opencode.jsonc` e versões dentro de `.opencode/`;
- `/home/herusneuhaus/.config/opencode/`;
- `/etc/opencode/`, inexistente no ambiente auditado;
- diretórios equivalentes de comandos, plugins e ferramentas.

A configuração global contém somente `mcp`, sem definições de agentes, modelos, skills adicionais ou permissões personalizadas. Não há, portanto, prompts personalizados a avaliar individualmente quanto a qualidade ou conflito.

A documentação V2 recomenda `agents/`. O binário instalado também contém o padrão `{agent,agents}/**/*.md`, evidenciando compatibilidade com o diretório singular. Nenhuma definição foi encontrada em qualquer uma das formas.

### Agentes nativos — não são agentes personalizados do Duna

| Agente | Responsabilidade | Modelo | Ferramentas/permissões padrão relevantes | Skills | Recomendação |
|---|---|---|---|---|---|
| `build` | Implementação geral | Sem override encontrado | Acesso amplo | Conforme permissões efetivas | **RECOMENDADA:** manter como alternativa geral |
| `plan` | Exploração e planejamento | Sem override encontrado | Restringe edição comum, mas não representa bloqueio geral de shell/MCP | Conforme permissões efetivas | **RECOMENDADA:** manter sem tratá-lo como sandbox somente leitura |
| `general` | Trabalho delegado de várias etapas | Herda o modelo quando não configurado | Acesso amplo; sem perguntas ou nova delegação por padrão | Conforme permissões efetivas | **RECOMENDADA:** manter para tarefas genéricas |
| `explore` | Pesquisa e leitura | Herda o modelo quando não configurado | Permite leitura, busca, web e shell; demais ações negadas por padrão | `skill` não está na allowlist padrão descrita na documentação | **RECOMENDADA:** manter para exploração |

Esses padrões foram confrontados com a documentação V2. Nesta sessão, `general` e `explore` estão explicitamente expostos para delegação. Não foram iniciados subagentes durante a auditoria.

Agentes internos como `title`, `summary` e `compaction` atendem manutenção do OpenCode. **DESNECESSÁRIA:** criar equivalentes personalizados.

**Avaliação:** os agentes nativos têm responsabilidades úteis, mas genéricas. Não há conflitos entre agentes personalizados porque eles ainda não existem. A lacuna é especialização e controle de acesso. Arquivos `agents/openai.yaml` das skills Codex não são definições de agentes OpenCode.

## 3. Inventário de skills

### 3.1 Skills efetivamente anunciadas nesta sessão

Há **quatro skills disponíveis no catálogo da sessão**: duas nativas e duas locais.

Os caminhos relativos desta seção partem da raiz do projeto.

| Skill | Origem | Caminho | Objetivo | Qualidade | Recomendação |
|---|---|---|---|---|---|
| `opencode` | Nativa do OpenCode | Base virtual `/builtin`; incorporada em `/home/herusneuhaus/.opencode/bin/opencode` | Configuração e desenvolvimento do OpenCode | Boa; direciona à documentação V2 | **RECOMENDADA:** manter |
| `report` | Nativa do OpenCode | Base virtual `/builtin`; conteúdo confirmado no mesmo binário | Diagnosticar e publicar issues do OpenCode | Boa; exige confirmação antes de publicar | **OPCIONAL:** usar apenas para bugs do OpenCode |
| `supabase` | Local; origem registrada `supabase/agent-skills` | `.agents/skills/supabase/SKILL.md` | Supabase, Auth, CLI, MCP e segurança | Útil, com conflitos de procedimento | **ESSENCIAL:** manter e resolver incompatibilidades |
| `supabase-postgres-best-practices` | Local; origem registrada `supabase/agent-skills` | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | SQL, modelagem, RLS, índices e concorrência | Boa base; genérica, não especializada em restaurante | **ESSENCIAL:** manter com aplicação contextual |

`/builtin` é uma origem virtual, não uma afirmação de que existe um `SKILL.md` físico nesse caminho.

A origem das skills Supabase está registrada em `/home/herusneuhaus/Documentos/duna-gastrobar/skills-lock.json`, com repositório GitHub, caminho upstream e hash. Não foi validada equivalência criptográfica com o upstream atual.

#### `supabase`

- 155 linhas, versão declarada `0.1.2`, `name`, `description` e metadados presentes.
- Referência de feedback existente e checklist útil de Auth, RLS, Storage e exposição de chaves.
- Ferramentas citadas como `search_docs` e `get_advisors` existem no catálogo desta sessão.
- A CLI Supabase não está no `PATH`; o projeto usa `npx` com versão fixada nos scripts. `psql` também não está no `PATH`.
- Recomenda `.mcp.json` para configuração do MCP, enquanto o OpenCode V2 usa `mcp.servers` em sua configuração.
- Sugere iteração com `execute_sql` sem tornar suficientemente explícita a fronteira local/remota. Isso conflita com a orientação do MCP de usar `apply_migration` para DDL e com o processo controlado de mudanças remotas do Duna.
- Contém afirmações absolutas sobre `SECURITY DEFINER` que exigem interpretação considerando owner, grants e revogações efetivas.
- O gatilho “ANY task involving Supabase” é amplo e pode gerar consultas de documentação desnecessárias.

**ESSENCIAL:** estabelecer procedimento específico do Duna, sem usar a skill como autorização para alterar o projeto remoto. Preservar origem e rastreabilidade ao adaptar orientações.

#### `supabase-postgres-best-practices`

- 64 linhas, versão declarada `1.1.1`, entrada curta e 34 arquivos de referência.
- Referências de uso exemplificadas na entrada existem.
- Boa organização por desempenho, segurança, modelagem, conexões e locks.
- Exemplos de isolamento por usuário não representam automaticamente a matriz de papéis do Duna.
- Exemplos de extensões e chaves primárias precisam de confirmação de suporte e necessidade; não justificam migração automática de IDs existentes.
- Pooling não deve ser interpretado como se cada chamada `supabase-js` fosse uma conexão PostgreSQL direta.

**RECOMENDADA:** carregar somente as referências pertinentes. Ela complementa a skill da plataforma, não é uma duplicata a remover.

#### Skill nativa `report`

O fluxo depende de GitHub CLI para publicar issues. `gh` não foi encontrado no `PATH`; o procedimento permite entregar um rascunho quando publicação não está disponível. Isso não bloqueia o desenvolvimento do Duna. **DESNECESSÁRIA:** instalar `gh` apenas para esta auditoria.

### 3.2 Skills globais do OpenCode

Não foram encontradas skills nos caminhos globais automáticos:

```text
/home/herusneuhaus/.config/opencode/skills/
/home/herusneuhaus/.claude/skills/
/home/herusneuhaus/.agents/skills/
```

Não existem diretórios adicionais ou catálogos HTTP declarados em `skills`. `.opencode/skills/` e `.claude/skills/` locais também não foram encontrados. As duas skills locais são descobertas pela compatibilidade com `.agents/skills/`, confirmada pelo catálogo da sessão e pelo carregamento de `supabase`.

### 3.3 Skills de outras ferramentas presentes, mas não acessíveis ao OpenCode atual

Foram encontrados **45 arquivos `SKILL.md` adicionais**: 6 no sistema de skills Codex e 39 no cache de plugins Codex. Não estão anunciados nesta sessão ou configurados como fontes OpenCode. Existência em cache não comprova instalação ativa ou funcionamento no Codex.

Todos os arquivos abaixo têm `name` e `description`. A avaliação é estrutural e de compatibilidade das instruções; seus workflows não foram executados.

Prefixos de caminhos reais, usados apenas para legibilidade:

```text
S = /home/herusneuhaus/.codex/skills/.system
B = /home/herusneuhaus/.codex/plugins/cache/openai-bundled
C = /home/herusneuhaus/.codex/plugins/cache/openai-curated-remote
R = /home/herusneuhaus/.codex/plugins/cache/openai-primary-runtime
T = /home/herusneuhaus/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills
```

#### Skills de sistema Codex

| Skill | Origem | Caminho | Objetivo | Qualidade/compatibilidade | Recomendação |
|---|---|---|---|---|---|
| `imagegen` | Sistema Codex | `S/imagegen/SKILL.md` | Gerar imagens | Estruturada; ferramenta principal ausente nesta sessão | **DESNECESSÁRIA:** importar agora |
| `openai-docs` | Sistema Codex | `S/openai-docs/SKILL.md` | Documentação OpenAI/Codex | Clara; não substitui documentação OpenCode | **DESNECESSÁRIA:** importar agora |
| `plugin-creator` | Sistema Codex | `S/plugin-creator/SKILL.md` | Criar plugins Codex | Específica de outro formato de plugin | **DESNECESSÁRIA:** importar |
| `review-agent` | Sistema Codex | `S/review-agent/SKILL.md` | Revisão somente leitura | Focada; não é um agente OpenCode | **OPCIONAL:** referência conceitual |
| `skill-creator` | Sistema Codex | `S/skill-creator/SKILL.md` | Criar skills Codex | Bons princípios; caminhos e metadados próprios | **OPCIONAL:** referência conceitual |
| `skill-installer` | Sistema Codex | `S/skill-installer/SKILL.md` | Instalar skills Codex | Instala no destino de outra ferramenta | **DESNECESSÁRIA:** importar |

#### Skills de plugins/cache Codex

| Skill | Origem | Caminho | Objetivo | Qualidade/compatibilidade | Recomendação |
|---|---|---|---|---|---|
| `sites-building` | Sites/Codex | `B/sites/0.1.43/skills/sites-building/SKILL.md` | Construir Sites | Workflow específico com inicialização e preview | **DESNECESSÁRIA:** importar |
| `sites-hosting` | Sites/Codex | `B/sites/0.1.43/skills/sites-hosting/SKILL.md` | Publicar Sites | Depende de ferramentas Sites ausentes | **DESNECESSÁRIA:** importar |
| `visualize` | Visualize/Codex | `B/visualize/1.0.37/skills/visualize/SKILL.md` | Visualizações conversacionais | Detalhada; contrato de saída próprio | **DESNECESSÁRIA:** importar |
| `google-docs` | Google Drive/Codex | `C/google-drive/0.1.22/skills/google-docs/SKILL.md` | Editar documentos | Depende do conector Google ausente | **DESNECESSÁRIA:** importar |
| `google-drive` | Google Drive/Codex | `C/google-drive/0.1.22/skills/google-drive/SKILL.md` | Operar arquivos Drive | Bem delimitada; conector ausente | **DESNECESSÁRIA:** importar |
| `google-drive-comments` | Google Drive/Codex | `C/google-drive/0.1.22/skills/google-drive-comments/SKILL.md` | Comentários em arquivos | Específica; conector ausente | **DESNECESSÁRIA:** importar |
| `google-sheets` | Google Drive/Codex | `C/google-drive/0.1.22/skills/google-sheets/SKILL.md` | Planilhas Google | Requer ferramentas/runtime próprios | **DESNECESSÁRIA:** importar |
| `google-slides` | Google Drive/Codex | `C/google-drive/0.1.22/skills/google-slides/SKILL.md` | Apresentações Google | Requer ferramentas/runtime próprios | **DESNECESSÁRIA:** importar |
| `plugin-management` | Plugin Management/Codex | `C/plugin-management/0.1.0/skills/plugin-management/SKILL.md` | Gerenciar plugins | Específica do ecossistema Codex | **DESNECESSÁRIA:** importar |
| `sites` | Sites/Codex | `C/sites/1.0.2-remix-a.1/skills/sites/SKILL.md` | Criar/publicar Sites | Sobrepõe outras skills Sites e publica por padrão | **DESNECESSÁRIA:** importar |
| `create-pet` | Work Pets/Codex | `C/work-pets/0.1.6/skills/create-pet/SKILL.md` | Criar mascotes animados | Especializada; sem relação com a engenharia do Duna | **DESNECESSÁRIA:** importar |
| `pets` | Work Pets/Codex | `C/work-pets/0.1.6/skills/pets/SKILL.md` | Gerenciar mascotes | Especializada; ferramentas ausentes | **DESNECESSÁRIA:** importar |
| `update-pet` | Work Pets/Codex | `C/work-pets/0.1.6/skills/update-pet/SKILL.md` | Atualizar mascotes | Especializada; ferramentas ausentes | **DESNECESSÁRIA:** importar |
| `documents` | Runtime Codex | `R/documents/26.1015.12040/skills/documents/SKILL.md` | DOCX/documentos | Extensa; runtime/renderização específicos | **DESNECESSÁRIA:** importar agora |
| `pdf` | Runtime Codex | `R/pdf/26.1015.12040/skills/pdf/SKILL.md` | PDFs | Estruturada; pode exigir instalações | **DESNECESSÁRIA:** importar agora |
| `presentations` | Runtime Codex | `R/presentations/26.1015.12040/skills/presentations/SKILL.md` | Apresentações | Longa; regras editoriais inadequadas como instrução de código | **DESNECESSÁRIA:** importar |
| `excel-live-control` | Runtime Codex | `R/spreadsheets/26.1015.12040/skills/excel-live-control/SKILL.md` | Controlar Excel aberto | Depende de sessão/add-in não disponíveis aqui | **DESNECESSÁRIA:** importar |
| `spreadsheets` | Runtime Codex | `R/spreadsheets/26.1015.12040/skills/spreadsheets/SKILL.md` | Arquivos de planilha | Extensa; depende de runtime próprio | **DESNECESSÁRIA:** importar agora |
| `template-creator` | Runtime Codex | `R/template-creator/26.1015.12040/skills/template-creator/SKILL.md` | Templates pessoais Codex | Bem delimitada, mas específica do Codex | **DESNECESSÁRIA:** importar |

#### Templates Codex

Cada entrada tem 22 linhas, metadados e workflow curto dependente das capacidades de documentos, planilhas ou apresentações Codex. São templates de artefatos, não skills de engenharia ou regras de negócio do restaurante.

| Skill | Origem | Caminho | Objetivo | Qualidade | Recomendação |
|---|---|---|---|---|---|
| `artifact-template-analytics-dashboard` | Templates/Codex | `T/artifact-template-analytics-dashboard/SKILL.md` | Planilha de indicadores | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-business-review` | Templates/Codex | `T/artifact-template-business-review/SKILL.md` | Apresentação empresarial | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-design-report` | Templates/Codex | `T/artifact-template-design-report/SKILL.md` | Documento de design | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-experiment-analysis` | Templates/Codex | `T/artifact-template-experiment-analysis/SKILL.md` | Análise experimental | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-financial-budget` | Templates/Codex | `T/artifact-template-financial-budget/SKILL.md` | Orçamento em planilha | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-investment-committee-memo` | Templates/Codex | `T/artifact-template-investment-committee-memo/SKILL.md` | Memorando de investimento | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-legal-memorandum` | Templates/Codex | `T/artifact-template-legal-memorandum/SKILL.md` | Memorando jurídico | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-market-trends-report` | Templates/Codex | `T/artifact-template-market-trends-report/SKILL.md` | Tendências de mercado | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-minimal-letterhead` | Templates/Codex | `T/artifact-template-minimal-letterhead/SKILL.md` | Correspondência | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-operating-calendar` | Templates/Codex | `T/artifact-template-operating-calendar/SKILL.md` | Calendário operacional | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-operating-review` | Templates/Codex | `T/artifact-template-operating-review/SKILL.md` | Revisão operacional | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-project-kickoff` | Templates/Codex | `T/artifact-template-project-kickoff/SKILL.md` | Início de projeto | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-project-tracker` | Templates/Codex | `T/artifact-template-project-tracker/SKILL.md` | Acompanhamento de projeto | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-sales-pipeline` | Templates/Codex | `T/artifact-template-sales-pipeline/SKILL.md` | Pipeline comercial | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-simple-dark-mode` | Templates/Codex | `T/artifact-template-simple-dark-mode/SKILL.md` | Slides escuros | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-simple-light-mode` | Templates/Codex | `T/artifact-template-simple-light-mode/SKILL.md` | Slides claros | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-strategy-memorandum` | Templates/Codex | `T/artifact-template-strategy-memorandum/SKILL.md` | Estratégia | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-system-design` | Templates/Codex | `T/artifact-template-system-design/SKILL.md` | Documento de arquitetura | Não é uma skill de engenharia | **DESNECESSÁRIA:** importar |
| `artifact-template-team-alignment` | Templates/Codex | `T/artifact-template-team-alignment/SKILL.md` | Alinhamento de equipe | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |
| `artifact-template-three-statement-forecast` | Templates/Codex | `T/artifact-template-three-statement-forecast/SKILL.md` | Projeção financeira | Escopo claro; runtime ausente | **DESNECESSÁRIA:** importar |

**Não importar não significa apagar do Codex.** Essas skills não estão aumentando o contexto do OpenCode atual. Não é possível afirmar que nunca terão utilidade para qualquer tarefa futura; não são necessárias para a arquitetura de desenvolvimento solicitada.

### 3.4 Descoberta, duplicidade e compatibilidade

- OpenCode V2 reconhece skills globais e locais em `.opencode/skills`, `.agents/skills` e `.claude/skills`, conforme escopo documentado; fontes adicionais dependem de configuração explícita.
- Diretórios Codex não são fontes automáticas documentadas para esta configuração. Não há `skills` apontando para eles.
- Um diretório sozinho não comprova disponibilidade. Foram verificados arquivos de entrada e o catálogo efetivo desta sessão.
- IDs repetidos podem substituir definições de fontes anteriores. Não foi encontrada colisão entre as quatro skills anunciadas.
- Skills Sites têm sobreposição no cache Codex; isso não cria conflito atual no OpenCode, pois não estão carregadas.
- Instruções externas podem referenciar ferramentas indisponíveis e impor publicação, instalação ou formatos de saída específicos. Não devem ser importadas em bloco.

## 4. Instruções e regras existentes

### Carregamento efetivo

| Fonte | Encontrada? | Participação no OpenCode |
|---|---|---|
| `AGENTS.md` global | Não | Seria carregado automaticamente |
| `AGENTS.md` na raiz/ancestrais aplicáveis | Não | Seria carregado automaticamente |
| `AGENTS.md` em subdiretórios próprios do projeto | Não | Seria descoberto ao explorar a área |
| `CLAUDE.md` aplicável | Não | V2 não o usa como fallback automático |
| `instructions` na configuração | Não | Necessário para instruções adicionais explícitas |
| `docs/**/*.md` | Sim | Não são instruções automáticas apenas por existirem |
| `components/ui/README.md` | Sim | Convenções disponíveis para leitura, não carregamento inicial automático |
| Instruções do MCP Supabase | Sim | Injetadas pelo servidor na sessão |
| Instruções nativas do harness | Sim | Fornecidas pelo OpenCode |

A documentação V2 distingue descoberta de configuração JSON, descoberta de agentes/skills e descoberta de `AGENTS.md`; não se deve presumir que todos esses mecanismos percorrem os mesmos limites de diretórios.

### Material útil a preservar

- `docs/funcionalidades/README.md`: índice de documentação por domínio.
- `docs/funcionalidades/arquitetura.md`: mapa de implementação e integrações.
- `docs/funcionalidades/permissoes.md`: papéis e fronteiras de confiança.
- `docs/funcionalidades/cardapio-digital.md`: distingue claramente planejado de implementado.
- `docs/plano-1-banco.md`: cuidados com produção, bootstrap e histórico divergente.
- `docs/plano-2a-reagendamento.md` e `docs/plano-2b-capacidade-por-turno.md`: evidências e procedimentos históricos.
- `components/ui/README.md`: convenções concretas de componentes, tokens e campos controlados.

### Contradições e obsolescência

1. **CPF/e-mail:** `docs/funcionalidades/pagamentos-e-financeiro.md:44` descreve CPF obrigatório/e-mail opcional como não implementados. `app/api/reservations/route.ts` já valida CPF obrigatório e aceita e-mail vazio; `docs/funcionalidades/auditoria.md:31` também registra a implementação. A pendência do documento financeiro está desatualizada ao menos para esse handler.
2. **Reagendamento:** o Plano 1 registra OUT-01 como defeito; o Plano 2A registra sua correção. São registros históricos úteis, mas falta um índice inequívoco de situação atual.
3. **Capacidade:** o Plano 1 descreve 80 por dia; o Plano 2B descreve 80 por turno. É uma evolução histórica, não autorização para somar ou escolher regras sem consultar a implementação final.
4. **Produção:** relatórios registram observações de 03/10/2026 e execução local. Não comprovam o estado remoto na data desta auditoria.
5. **Lint:** existem `.eslintrc.json` e `eslint.config.mjs`. O fluxo padrão ESLint 9 utiliza configuração flat; manter a legada pode induzir ferramentas e leitores a interpretações diferentes.
6. **Permissões:** `admin`, `dono`, `gerente`, cargos operacionais e permissões excepcionais são conceitos distintos. Uma skill genérica de RBAC não deve tratá-los como hierarquia implícita.

### Distribuição recomendada das instruções

| Conteúdo | Destino | Classificação |
|---|---|---|
| Idioma, comunicação, preservação de trabalho existente e limites de autorização | Instruções globais curtas | **RECOMENDADA** |
| Stack, comandos, mapa do projeto e fronteiras de produção | `AGENTS.md` do Duna | **ESSENCIAL** |
| Convenções locais de componentes | Instruções próximas de `components/ui/` | **RECOMENDADA** |
| Procedimento de banco isolado e migrations | Skill específica + referências técnicas | **ESSENCIAL** |
| Regras extensas de reservas, financeiro e permissões | Documentação de domínio consultada por skills | **RECOMENDADA** |
| Relatórios completos de planos anteriores | Documentação histórica, não prompt permanente | **RECOMENDADA** |
| Carregamento integral de `docs/` em toda interação | Não adotar | **DESNECESSÁRIA** |

Não há um `AGENTS.md` excessivamente longo a reduzir; o problema atual é ausência de instruções persistentes do projeto e dispersão da documentação.

## 5. MCPs, plugins e ferramentas encontrados

### MCP Supabase

| Item | Evidência |
|---|---|
| Nome | `supabase` |
| Finalidade | Documentação, banco, diagnóstico, desenvolvimento, funções, branches e Storage |
| Origem | `/home/herusneuhaus/.config/opencode/opencode.json` |
| Tipo | Remoto |
| Endpoint | `https://mcp.supabase.com/mcp`, com projeto específico |
| Estado configurado | Habilitado por padrão; sem `disabled: true` |
| Catálogo nesta sessão | Anuncia 23 ferramentas |
| Funcionamento operacional | **Não testado nesta auditoria** |
| Segregação por agente | Nenhuma regra personalizada encontrada |

Grupos declarados na URL: `docs`, `account`, `database`, `debugging`, `development`, `functions`, `branching`, `storage`.

O catálogo inclui leitura e mutação: SQL, migrations, geração de tipos, funções, configuração de Storage e operações de branches. Estar anunciado não significa que cada operação foi autorizada pelo servidor ou testada.

O projeto apontado coincide com o identificado na documentação histórica como produção. Essa classificação não foi confirmada remotamente. Credenciais não foram consultadas e o identificador do projeto não é necessário para este relatório.

#### Riscos e recomendações

| Recomendação | Classificação |
|---|---|
| Evitar MCP mutável de um projeto específico disponível indiscriminadamente em outros projetos do usuário | **ESSENCIAL** |
| Separar leitura remota, desenvolvimento local e implantação | **ESSENCIAL** |
| Bloquear mutações remotas para produto, UI/UX e coordenação | **ESSENCIAL** |
| Tratar `execute_sql` como potencialmente mutável; o nome não garante somente leitura | **ESSENCIAL** |
| Não considerar `plan` uma proteção suficiente contra alteração remota | **ESSENCIAL** |
| Reduzir grupos de ferramentas ao efetivamente necessário | **RECOMENDADA** |
| Adicionar outros MCPs sem demanda concreta | **DESNECESSÁRIA** |

Em V2, permissões podem atingir ferramentas MCP pelo nome normalizado, como `supabase_apply_migration`. O Code Mode não elimina as verificações das ferramentas chamadas. Bloqueios de edição local não bloqueiam SQL remoto, shell ou ferramentas de deploy.

### Plugins OpenCode

**Nenhum plugin personalizado configurado ou encontrado nos diretórios de descoberta auditados.** Isso não significa ausência das funcionalidades internas fornecidas pelo próprio OpenCode.

Existe `/home/herusneuhaus/.opencode/package.json` com dependência `@opencode-ai/plugin: 1.18.10`. É uma dependência do SDK de plugins, não prova de plugin carregado e não é a versão do CLI instalado.

### Plugins de outra ferramenta

Foram encontrados diretórios de cache Codex para:

- `openai-bundled`: `codex-app-tools`, `browser`, `visualize`, `sites`, `unified-computer-use`;
- `openai-curated-remote`: `openai-templates`, `plugin-management`, `gmail`, `google-calendar`, `google-contacts`, `google-drive`, `work-pets`, `sites`, `github`;
- `openai-primary-runtime`: `documents`, `pdf`, `spreadsheets`, `presentations`, `template-creator`.

Origem: `/home/herusneuhaus/.codex/plugins/cache/`. **Não são plugins OpenCode configurados.** Não foi investigada autenticação ou conexão dessas integrações no Codex. Seu cache não autoriza importação, execução ou exclusão.

### Ferramentas locais e sobreposições

- `node`, `npm`, `docker`, `python3`, `php`, `composer`, `pnpm` e `yarn` foram encontrados no `PATH`; disponibilidade não comprova funcionamento dos serviços.
- `supabase`, `psql`, `gh`, `bun` e `uv` não foram encontrados no `PATH`.
- O runner de banco usa `npx --yes supabase@2.119.0`; não foi executado nesta auditoria.
- Ferramentas de leitura, busca, patch, shell e web estão disponíveis no harness. Nenhuma ferramenta de automação de navegador foi anunciada nesta sessão.
- Shell, CLI Supabase e MCP podem sobrepor capacidade de mutação de banco. Restringir apenas um canal não protege os demais.
- `report` precisa de `gh` para publicar; geração de imagens, Sites, Google Workspace e artefatos Codex têm dependências ausentes neste catálogo.

## 6. Problemas, redundâncias e cobertura desejada

### Achados prioritários

| Achado | Evidência | Impacto | Classificação |
|---|---|---|---|
| Instruções persistentes do projeto ausentes | Nenhum `AGENTS.md` ou `instructions` encontrado | Agentes dependem de redescoberta e memória de sessão | **ESSENCIAL** |
| Skills e lockfile não versionados | `.gitignore:42` ignora `.agents/`; linha 51 ignora `skills-lock.json`; `git ls-files` não os lista | Outro clone não reproduz a configuração de IA | **ESSENCIAL** |
| MCP global com operações mutáveis | Configuração global, ferramentas de escrita anunciadas e nenhuma segregação personalizada | Possível acesso remoto fora do escopo da tarefa/projeto | **ESSENCIAL** |
| Procedimentos Supabase conflitantes | Skill local, instrução MCP e fluxo Duna divergem sobre configuração e DDL | Risco de editar o ambiente errado ou perder rastreabilidade | **ESSENCIAL** |
| Referências antigas a migrations | `scripts/local-db.mjs` usa nomes que não existem na pasta canônica | Fluxos incrementais podem falhar ou preparar uma base incorreta | **ESSENCIAL** |
| Documentação financeira desatualizada | Descrição de CPF/e-mail diverge do handler atual | Planejamento pode solicitar trabalho já implementado ou regredir validação | **ESSENCIAL** |
| Resultados históricos confundidos com estado atual | Planos registram snapshots e execuções anteriores | Falsa confiança em testes ou produção | **RECOMENDADA** |
| Configurações ESLint duplicadas | `.eslintrc.json` e `eslint.config.mjs` | Ambiguidade para ferramentas e agentes | **RECOMENDADA** |
| Versões Next/ESLint config de majors diferentes | Next 15.5.15 e `eslint-config-next` 16.0.8 | Compatibilidade deve ser revisada; defeito não comprovado nesta auditoria | **RECOMENDADA** |
| Ausência de QA visual automatizado confirmado | Vitest usa Node; navegador não anunciado | Fluxos visuais não estão cobertos por essas evidências | **RECOMENDADA** |

#### Referências antigas de migrations

`scripts/local-db.mjs` referencia:

```text
20261003090000_sync_rescheduled_table_assignments.sql
20261003110000_harden_capacity_permissions_and_turn_identity.sql
```

Esses nomes não existem atualmente em `supabase/migrations/`. Há arquivos com os mesmos temas e identificadores históricos no sufixo:

```text
20261010000937_sync_rescheduled_table_assignments_20261003090000.sql
20261010001025_harden_capacity_permissions_and_turn_identity_20261003110000.sql
```

As exclusões de preparação pré-migração não encontram os nomes esperados, e as ações incrementais tentam ler arquivos ausentes. Os testes incrementais também consultam versões históricas `20261003090000`, `20261003100000` e `20261003110000`. A inconsistência é verificável por leitura; os fluxos não foram executados para quantificar todos os efeitos.

**ESSENCIAL:** reconciliar runner, testes, documentação e histórico antes de prometer validação incremental. Não renomear migrations novamente ou reparar histórico remoto automaticamente.

### Comparação com as responsabilidades desejadas

“Parcial” abaixo significa que existe documentação, implementação ou orientação genérica útil, mas não uma especialização reutilizável completa e governada. Nenhuma das especializações de domínio já está formalizada como agente/skill Duna.

| Responsabilidade desejada | Situação | Evidência/lacuna | Destino recomendado |
|---|---|---|---|
| `product-owner-restaurante` | Parcial | Documentação funcional existe; faltam triagem, critérios de aceite e registro uniforme de decisões | Skill de produto + agente produto — **RECOMENDADA** |
| `restaurant-reservations-specialist` | Parcial | Reservas, capacidade e mesas documentadas/testadas; falta workflow especializado | Referência de domínio na skill produto — **RECOMENDADA** |
| `restaurant-operations-designer` | Parcial | Operação atual e futuro salão documentados; decisões pendentes explícitas | Referência de operação na skill produto — **RECOMENDADA** |
| `restaurant-admin-settings-architect` | Parcial | Configurações dispersas entre telas, API e cliente direto | Referência de configurações na skill produto — **RECOMENDADA** |
| `restaurant-finance-rules` | Parcial | Regras e lacunas registradas, com documentação desatualizada | Referência financeira e critérios de teste — **ESSENCIAL** |
| `roles-and-permissions-designer` | Parcial | Matriz documentada, helpers e RLS; falta contrato por ação atualizado | Referência de autorização em produto e QA — **ESSENCIAL** |
| `saas-ui-ux-auditor` | Ausente como workflow | Não há procedimento de auditoria UX | Skill UI/UX — **RECOMENDADA** |
| `design-system-builder` | Parcial | Tucano, tokens e primitives existentes | Skill UI/UX deve evoluir o sistema atual, não criar outro — **RECOMENDADA** |
| `information-architecture-designer` | Parcial | Shell administrativo e grupos de navegação existem | Referência na skill UI/UX — **RECOMENDADA** |
| `dashboard-density-optimizer` | Ausente como workflow | Há dashboards, mas sem critérios de densidade/legibilidade formalizados | Referência na skill UI/UX — **RECOMENDADA** |
| `ux-writing-microcopy` | Ausente como workflow | Textos existentes não constituem guia de escrita | Referência na skill UI/UX — **RECOMENDADA** |
| `data-modeling-restaurants` | Parcial | Skill PostgreSQL e modelo conceitual de salão; faltam invariantes do Duna | Skill de dados com referências de domínio — **ESSENCIAL** |
| `backend-rules-laravel` | Não aplicável | Backend atual é Next.js + Supabase | Substituir pela responsabilidade backend real — **DESNECESSÁRIA** na forma Laravel |
| `frontend-admin-ux-implementation` | Parcial | Componentes e convenções existentes; falta workflow de implementação/validação | Skill frontend — **RECOMENDADA** |
| `qa-testing` | Parcial | Suítes existem; incremental inconsistente e lacunas visuais documentadas | Skill QA/segurança + revisão independente — **ESSENCIAL** |
| `security-review` | Parcial | Skills Supabase e documentação de permissões; falta revisão ponta a ponta | Skill QA/segurança — **ESSENCIAL** |

Os nomes desejados representam responsabilidades, não publicações verificadas. Não se recomenda instalar pacotes com esses nomes sem avaliar origem e conteúdo.

## 7. O que manter, melhorar, adicionar ou remover

### Manter

| Ação | Justificativa | Classificação |
|---|---|---|
| Manter skills Supabase existentes | Complementares e adequadas à stack, com ressalvas registradas | **ESSENCIAL** |
| Manter documentação por domínio e relatórios históricos | Evita perder decisões, evidências e limites de implantação | **ESSENCIAL** |
| Manter componentes UI e tokens existentes | Há uma base visual real; não é necessário reconstruir do zero | **RECOMENDADA** |
| Manter agentes nativos | Úteis para exploração, planejamento e tarefas gerais | **RECOMENDADA** |
| Manter caches/skills Codex fora da configuração OpenCode | Não causam aumento de contexto aqui e podem servir a outra ferramenta | **RECOMENDADA** |

### Melhorar e adicionar

| Ação | Resultado esperado | Classificação |
|---|---|---|
| Criar `AGENTS.md` curto, versionado e específico do Duna | Stack, fontes, comandos e limites conhecidos em toda sessão | **ESSENCIAL** |
| Versionar definições de IA e registrar origem das skills externas | Ambiente reproduzível entre clones | **ESSENCIAL** |
| Definir política de permissões para shell, edição, delegação e MCP | Limites verificáveis além de instruções em texto | **ESSENCIAL** |
| Estabelecer workflow de dados Duna com separação local/remoto | Evitar bootstrap ou DDL exploratório em produção | **ESSENCIAL** |
| Corrigir referências incrementais e documentação contraditória | Verificações confiáveis e menos retrabalho | **ESSENCIAL** |
| Registrar situação atual separada de relatórios históricos | Diferenciar implementado, pendente e implantado | **RECOMENDADA** |
| Criar poucas skills locais com referências sob demanda | Especialização sem carregar todo o domínio a cada interação | **RECOMENDADA** |
| Declarar política de modelo/variante quando a equipe quiser padronizá-la | Não depender apenas da seleção de uma sessão | **RECOMENDADA** |
| Adicionar automação de navegador posteriormente | QA visual reproduzível em ambiente autorizado | **OPCIONAL** |
| Instalar coleções genéricas ou novos MCPs preventivamente | Aumentaria superfície e manutenção sem necessidade comprovada | **DESNECESSÁRIA** |

### Remoções propostas: motivo e impacto

Não é recomendada a exclusão de agentes ou skills existentes nesta etapa.

| Proposta futura | Motivo | Impacto e condição | Classificação |
|---|---|---|---|
| Remover a configuração ESLint legada, se confirmada sem consumidores | Evitar duas fontes aparentes de regras | Perde-se compatibilidade com ferramentas que ainda dependam dela; validar configuração flat e integrações antes | **RECOMENDADA** |
| Retirar trechos obsoletos da documentação corrente, preservando histórico | Evitar instruções factualmente desatualizadas | Melhora precisão sem apagar evidências; substituir por situação atual e links históricos | **ESSENCIAL** |
| Retirar o vínculo mutável do Duna da configuração global, se migrado para escopo correto | Evitar acesso incidental em outros projetos | MCP deixa de aparecer globalmente; depende de substituição controlada e política de acesso aprovada | **ESSENCIAL** |
| Excluir caches Codex ou SDK de plugin apenas por existirem | Não há benefício demonstrado para este projeto | Poderia quebrar outra ferramenta; não propor limpeza indiscriminada | **DESNECESSÁRIA** |
| Remover dependências sem uso aparente | Pesquisa não substitui auditoria completa de dependências | Pode afetar scripts/fluxos não localizados; avaliar em tarefa separada | **OPCIONAL** |

### Arquitetura futura enxuta

**RECOMENDADA:** começar com **cinco agentes**, em vez de um agente para cada responsabilidade desejada.

| Agente proposto | Responsabilidade | Skills complementares | Fronteira de acesso |
|---|---|---|---|
| `duna-orchestrator` | Planejar, dividir escopo, selecionar especialistas e consolidar evidências | Carregar apenas o necessário ao plano | Leitura e delegação explícita; sem escrita remota |
| `duna-product` | Regras de reservas, operação, configurações, financeiro e permissões | `duna-product-rules` | Leitura; propostas de documentação sob autorização; sem mutações operacionais |
| `duna-ui-ux` | Auditoria UX, arquitetura de informação, design system, densidade e microcopy | `duna-ui-ux` | Leitura de UI e documentação; sem alteração de regras/dados |
| `duna-engineering` | Implementar frontend, backend Next.js e mudanças locais de dados | `duna-frontend`, `duna-backend`, `duna-data-workflow`, skills Supabase pertinentes | Edição e validação locais por escopo; implantação não implícita |
| `duna-quality-security` | Revisão independente, testes, autorização, privacidade e integração | `duna-quality-security`, referências Supabase pertinentes | Revisão e testes locais autorizados; sem deploy ou correção automática indiscriminada |

Nomes `duna-*` acima são **propostas locais a escrever**, não skills externas existentes ou verificadas.

**OPCIONAL:** quando houver volume e necessidade de isolamento, substituir `duna-engineering` por três agentes: `duna-frontend`, `duna-backend` e `duna-data`. Assim a arquitetura chega a sete agentes, cobrindo separadamente todos os papéis considerados, sem manter um agente de engenharia redundante.

#### Por que separar dessa forma

- Agentes representam responsabilidade, modo de trabalho e permissões distintas.
- Skills representam procedimentos reutilizáveis e conhecimento carregado sob demanda.
- Referências representam regras detalhadas, exemplos, matrizes e documentação de domínio.
- Instruções globais representam convenções estáveis entre projetos, não regras comerciais do Duna.
- Revisão independente merece agente próprio para não confundir implementar com aprovar a própria implementação.
- Frontend, backend e dados inicialmente podem compartilhar um executor; separá-los só é vantajoso quando melhorar contexto, segurança ou paralelismo real.

#### Contratos mínimos de trabalho

**RECOMENDADA:** cada agente deve produzir entradas/saídas claras:

1. Produto: regra atual, mudança desejada, decisões pendentes e critérios de aceite.
2. UI/UX: problemas priorizados, estados, navegação e comportamento, sem inventar regras comerciais.
3. Engenharia: arquivos afetados, implementação dentro do escopo e verificações realizadas/não realizadas.
4. QA/segurança: achados por severidade, evidência, testes negativos e riscos residuais.
5. Orquestração: consolidar decisões sem transformar sugestões em autorização de deploy.

#### Modelo, ferramentas e contexto

- **RECOMENDADA:** começar com o modelo já adotado, GPT-6.1 Sol, sem inventar uma estratégia multimodelo. Confirmar a variante disponível antes de padronizar `High` na futura configuração.
- **ESSENCIAL:** usar sintaxe V2 (`agents`, `permissions`, `shell`, `subagent`, `mcp.servers`) em novas configurações.
- **ESSENCIAL:** agentes somente leitura precisam de restrições de shell e ferramentas remotas, não apenas `edit: deny`.
- **ESSENCIAL:** cada subagente deve ter suas próprias permissões explícitas; não presumir que recebe automaticamente a restrição do pai.
- **RECOMENDADA:** permitir delegação somente aos agentes necessários, sem paralelismo automático para qualquer tarefa.
- **RECOMENDADA:** agentes e skills curtos, com descrições discriminativas e referências sob demanda. Permissão de carregar uma skill não significa carregar seu conteúdo em toda interação.
- **DESNECESSÁRIA:** plugins personalizados para obter essa arquitetura inicial; arquivos de agentes, skills e permissões já atendem a necessidade.

## 8. Estrutura de diretórios recomendada

Estrutura **proposta**, ainda não implementada:

```text
duna-gastrobar/
├── AGENTS.md
├── opencode.jsonc
├── .opencode/
│   ├── agents/
│   │   ├── duna-orchestrator.md
│   │   ├── duna-product.md
│   │   ├── duna-ui-ux.md
│   │   ├── duna-engineering.md
│   │   └── duna-quality-security.md
│   └── skills/
│       ├── duna-product-rules/
│       │   ├── SKILL.md
│       │   └── references/       # Só referências próprias necessárias
│       ├── duna-ui-ux/SKILL.md
│       ├── duna-frontend/SKILL.md
│       ├── duna-backend/SKILL.md
│       ├── duna-data-workflow/SKILL.md
│       └── duna-quality-security/SKILL.md
├── .agents/
│   └── skills/
│       ├── supabase/            # Preservar origem upstream
│       └── supabase-postgres-best-practices/
├── skills-lock.json
└── docs/
    ├── auditoria-agentes-skills-opencode.md
    ├── funcionalidades/        # Fonte detalhada das regras e arquitetura
    └── plano-*.md              # Histórico e evidências, com situação explícita
```

- **ESSENCIAL:** versionar somente arquivos deliberadamente aprovados, sem incluir caches, credenciais ou toda configuração pessoal.
- **RECOMENDADA:** skills autorais em `.opencode/skills/`; manter as upstream onde já funcionam evita movimentação desnecessária.
- **RECOMENDADA:** um único `opencode.jsonc` de projeto, evitando duas configurações locais concorrentes.
- **RECOMENDADA:** reutilizar `docs/funcionalidades/` em vez de copiar regras comerciais para todos os prompts. Caminhos nas skills precisam ser explícitos e resolvidos conforme sua base.
- **OPCIONAL:** instruções locais como `components/ui/AGENTS.md` e `supabase/AGENTS.md`, se a orientação específica justificar arquivos adicionais.
- **DESNECESSÁRIA:** duplicar as mesmas skills em `.agents`, `.claude` e `.opencode` ou mover skills apenas por estética.

Globalmente, `/home/herusneuhaus/.config/opencode/AGENTS.md` deve conter apenas convenções pessoais estáveis. Configuração de produção do Duna e regras de restaurante não devem se tornar instruções globais para todos os projetos.

## 9. Plano de implementação em fases

Todas as fases abaixo dependem de autorização posterior. Criar este relatório não iniciou nenhuma delas.

| Fase | Ações | Critério de conclusão | Classificação |
|---|---|---|---|
| 1 — Segurança e fontes | Aprovar escopo do MCP, política de mutações, fonte atual de regras e separação local/remoto | Matriz de acesso e limites de produção aprovados, sem consultar credenciais | **ESSENCIAL** |
| 2 — Reprodutibilidade | Criar `AGENTS.md` e configuração V2 mínima; aprovar versionamento das definições/lockfile | Novo clone consegue identificar instruções e origem das skills sem configuração pessoal oculta | **ESSENCIAL** |
| 3 — Coerência técnica | Reconciliar nomes de migrations no runner/testes e atualizar documentação CPF/e-mail e situação dos planos | Referências existentes e procedimentos incrementais revisados; testes locais só quando autorizados | **ESSENCIAL** |
| 4 — Especialização mínima | Escrever cinco agentes e as skills locais necessárias, sem instalações externas | Responsabilidades, entradas/saídas e permissões sem sobreposição injustificada | **RECOMENDADA** |
| 5 — Validação da arquitetura | Verificar descoberta, modelos, skills por agente, negações de acesso e tarefas representativas em ambiente isolado | Catálogo e permissões efetivas conferidos; nenhuma mutação remota como teste | **ESSENCIAL** |
| 6 — QA e manutenção | Exercitar produto → UI → implementação → revisão; registrar lacunas e revisar regras periodicamente | Fluxo verificável, relatórios distinguem teste executado de análise estática | **RECOMENDADA** |
| 7 — Expansão baseada em evidência | Separar frontend/backend/dados e avaliar navegador/MCP adicional somente se necessário | Benefício demonstrado de contexto, isolamento ou cobertura | **OPCIONAL** |

### Critérios de aceite da arquitetura futura

- **ESSENCIAL:** nenhum agente de produto/UI/planejamento consegue executar mutações remotas por permissões inadvertidas.
- **ESSENCIAL:** migrations e bootstrap local não são interpretados como autorização de implantação.
- **ESSENCIAL:** definições de IA são reproduzíveis e rastreáveis no repositório.
- **ESSENCIAL:** revisão considera Auth, RLS, cliente privilegiado, regras concorrentes e autorização por ação, não apenas visibilidade de botões.
- **RECOMENDADA:** tarefa pequena não inicia todos os agentes e não carrega todas as skills.
- **RECOMENDADA:** cada regra tem fonte de verdade clara, sem duplicação entre prompts, documentação e exemplos.
- **RECOMENDADA:** relatórios apresentam limitações, testes não executados e estado de implantação desconhecido de forma explícita.

### Fontes da auditoria

Evidências principais: `package.json`, `package-lock.json`, `.gitignore`, `skills-lock.json`, skills locais, configuração global OpenCode, binário instalado, `scripts/local-db.mjs`, testes incrementais, configuração TypeScript/ESLint/Vitest, handlers e helpers selecionados, `components/ui/README.md` e documentação em `docs/`.

Documentação oficial consultada:

- [OpenCode V2 — configuração](https://opencode.ai/v2/docs/config/)
- [OpenCode V2 — agentes](https://opencode.ai/v2/docs/agents/)
- [OpenCode V2 — skills](https://opencode.ai/v2/docs/skills/)
- [OpenCode V2 — instruções](https://opencode.ai/v2/docs/instructions/)
- [OpenCode V2 — permissões](https://opencode.ai/v2/docs/permissions/)
- [OpenCode V2 — MCP](https://opencode.ai/v2/docs/mcp-servers/)
- [OpenCode V2 — plugins](https://opencode.ai/v2/docs/build/plugins/)

**Status final: diagnóstico documentado; arquitetura não implementada. Aguardar autorização específica antes de alterar instruções, agentes, skills, ferramentas ou configurações.**
