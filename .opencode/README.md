# Desenvolvimento assistido por IA — Duna

`AGENTS.md` fornece o contexto permanente. O projeto usa os agentes nativos do
OpenCode: **Plan** (`plan`) e **Build** (`build`). Não há perfis personalizados
nem substituições dos prompts nativos. Apenas as permissões do Build são
ajustadas em `opencode.jsonc` para acessar o MCP do Duna.

## Uso e skills

Novas sessões usam **Build**. **Plan** serve para investigar e planejar, e
**Build** implementa o escopo aprovado. Sessões existentes preservam sua seleção:
se ainda mostrarem um perfil removido, selecione Build ou Plan manualmente.
OpenCode recarrega a configuração ao salvar; `/reload` força a atualização.

As seis skills autorais em `skills/` e duas upstream em `.agents/skills/`
permanecem intactas, carregadas somente quando pertinentes. Skills não são
agentes e não precisam ser removidas para usar os perfis nativos.

Para mudanças relevantes, esclareça critérios, planeje a experiência se houver
UI, implemente o aprovado e peça revisão independente em outra sessão ou por
outra pessoa. Autoinspeção não a substitui. Não há fluxo obrigatório entre seis
especialistas nem delegação automática.

O modelo padrão continua `openai/gpt-6.1-sol` com `reasoningEffort: high`.
Não foram alterados provedores, configuração global ou autenticação.

## Permissões configuradas

As permissões da raiz mantêm MCP/Code Mode bloqueados por padrão. Somente
`agents.build.permissions` libera Code Mode e a allowlist nominal de
`supabase_duna`; Plan, General e Explore continuam sem esse acesso:

| Operação | Regra local preservada |
|---|---|
| Edição e shell, inclusive inspeções Git | ask (Plan mantém suas restrições nativas) |
| Diretório externo | ask |
| Delegação | deny |
| Code Mode (`execute`) | allow somente no Build; deny nos demais |
| Metadados `supabase_duna` enumerados abaixo | allow somente no Build |
| SQL, migrations, logs, tipos e Storage/Functions enumerados abaixo | ask somente no Build |
| Conexão antiga `supabase`, outros nomes `supabase_*` e novas ferramentas | deny |
| Chaves/secrets, projetos, organizações e branches | deny |
| Credenciais, `.env`, PEM/SSH, escrita direta em `.git` e skills upstream | bloqueios existentes preservados |
| Git push/reset/clean/checkout destrutivo | deny |

A exceção de inspeções Git sem aprovação existia nos perfis removidos, não na
raiz. Edição e shell continuam sob aprovação.

### Conexão e allowlist do Build

A conexão usa a entrada global já existente **`supabase_duna`**, limitada ao
projeto **`gnakcuvfxltbgpssirpv`**. Não foi criado outro servidor ou alterado OAuth.
Todas as ferramentas enumeradas abaixo usam o prefixo `supabase_duna_`:

- **allow:** `get_project_url`, `list_migrations`, `list_tables`,
  `list_extensions`, `get_advisors`, `search_docs`.
- **ask:** `execute_sql` (inclusive SELECT), `apply_migration`, `get_logs`,
  `query_logs`, `generate_typescript_types`.
- **Storage/Functions — ask, inclusive leituras:** `list_edge_functions`,
  `get_edge_function`, `deploy_edge_function`, `list_storage_buckets`,
  `get_storage_config`, `update_storage_config`.

`get_logs` é uma exceção nominal de compatibilidade, não prova de disponibilidade.
Recursos MCP genéricos continuam negados no Build; não são uma rota alternativa.

Para usar, selecione **Build** dentro deste projeto. Se a sessão ainda não
mostrar as ferramentas, use `/reload` e confira `supabase_duna` em `/mcps`.
Confirme o alvo antes de consultar dados ou alterar o projeto:

```js
await tools.supabase_duna.get_project_url()
// Esperado: https://gnakcuvfxltbgpssirpv.supabase.co
```

**Configurado não significa disponível ou operacional.** A chamada
`supabase_duna.get_project_url` foi verificada e retornou o projeto esperado.
A execução das demais ferramentas não foi verificada. Storage é
desabilitado por padrão; Edge Functions geralmente vem habilitado. Estado de
conexão `connected` não comprova catálogo ou capacidade operacional. Se uma tool
estiver ausente, relate a limitação: não habilite grupos, altere MCP global/OAuth,
instale componentes ou use shell/HTTP/SDK para contornar o bloqueio.

## Segurança e operação

A policy ampla `supabase_*` continua negando acesso, com exceções **nominais**
somente para a allowlist `supabase_duna`. Uma exceção de policy não concede
acesso: as permissions do Build ainda determinam `allow` ou `ask` por ferramenta.
A conexão antiga `supabase` fica bloqueada neste projeto, sem afetar os demais.
Policies globais/gerenciadas, proteções de `.env`, credenciais/PEM/SSH, `.git`,
upstream e Git destrutivo não
são relaxadas. `.env.example` segue legível, não editável.

Leia comandos/scripts antes de aprovar. Shell e testes podem escrever artefatos
e acessar rede com a autoridade do usuário; permissões não são sandbox.
Não contorne edição negada nem leia credenciais. Prefira aprovação única,
nunca “permitir sempre” para interpretadores ou operações remotas.

A configuração não autoriza operação remota. Uma tarefa específica deve definir
alvo/ambiente e conteúdo exato, impactos, precondições, backup recuperável,
verificação e reversão antes da aprovação por operação. Storage exige revisão
de acesso/RLS; Functions exige revisar código, dependências e autorização/JWT.
Não use produção como sandbox. Esta manutenção não aplica migrations nem faz deploy.

## Validação

Execute sob aprovação:

```bash
node .opencode/validate.mjs
node .opencode/validate.mjs --runtime
git diff --check
```

O validador verifica Build como padrão, ausência de perfis personalizados e
substituições de prompt/modelo, oito skills, referências e bloqueios da raiz.
Verifica também a allowlist exata do Build: metadados permitidos, operações
sensíveis sob aprovação, conexão antiga e ferramentas novas negadas. Usa `yaml`
já disponível no lockfile, sem instalação.

`--runtime` consulta somente GETs da API **local OpenCode** para perfis, skills,
modelo, versão e estado da conexão MCP. Não consulta configuração global/sensível,
não executa ferramentas MCP nem altera OAuth/servidor. A CLI pode iniciar o serviço
OpenCode, não a stack Duna. Se a versão mudar, revise contrato e validador.

Parsing e matriz configurada não comprovam disponibilidade de tools, execução
remota, integração E2E ou sandbox. Policies são avaliadas localmente; runtime
confere presença de Plan/Build, ausência dos perfis removidos, regras registradas
e registro da conexão `supabase_duna`, sem tentar operações bloqueadas.
O contrato retornado é validado explicitamente
em OpenCode V2; não há mais a comparação fixa com a antiga versão 2.1.4.

O validador não executa ferramentas Supabase. A confirmação operacional mínima
é feita separadamente pela chamada `supabase_duna.get_project_url`, sem SQL,
consulta a dados de clientes ou alterações remotas. Uma resposta correta não
comprova que todas as outras ferramentas estejam disponíveis ou operacionais.
