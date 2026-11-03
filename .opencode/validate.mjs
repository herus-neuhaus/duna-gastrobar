// Validação da arquitetura de IA; não executa ferramentas MCP ou código do Duna.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { parse } = require('yaml'); // Dependência já resolvida em package-lock.json.
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const config = JSON.parse(read('opencode.jsonc')); // JSON estrito também é JSONC.
const names = ['build', 'plan'];
const metadataTools = ['supabase_duna_get_project_url', 'supabase_duna_list_migrations',
  'supabase_duna_list_tables', 'supabase_duna_list_extensions', 'supabase_duna_get_advisors', 'supabase_duna_search_docs'];
// Nomes Storage/Functions e query_logs: seção Available tools da documentação oficial.
// https://supabase.com/docs/guides/getting-started/mcp
// Evidência nominal, não descoberta de catálogo nem confirmação operacional.
const approvedTools = ['supabase_duna_get_logs', 'supabase_duna_query_logs', 'supabase_duna_generate_typescript_types',
  'supabase_duna_execute_sql', 'supabase_duna_apply_migration', 'supabase_duna_list_edge_functions',
  'supabase_duna_get_edge_function', 'supabase_duna_deploy_edge_function', 'supabase_duna_list_storage_buckets',
  'supabase_duna_get_storage_config', 'supabase_duna_update_storage_config'];
const deniedTools = ['supabase_duna_delete_branch', 'supabase_duna_reset_branch', 'supabase_duna_merge_branch',
  'supabase_duna_rebase_branch', 'supabase_duna_create_branch', 'supabase_duna_get_publishable_keys',
  'supabase_duna_get_api_keys', 'supabase_duna_create_edge_function_secret', 'supabase_duna_create_project',
  'supabase_duna_delete_project', 'supabase_duna_pause_project', 'supabase_duna_restore_project',
  'supabase_duna_list_projects', 'supabase_duna_list_organizations', 'supabase_duna_get_cost',
  'supabase_duna_list_branches', 'supabase_duna_new_tool', 'supabase_duna_future_mutation'];
const legacyTools = [...metadataTools, ...approvedTools, ...deniedTools]
  .map((action) => action.replace('supabase_duna_', 'supabase_'));
const skills = ['duna-product-rules', 'duna-ui-ux', 'duna-frontend',
  'duna-backend', 'duna-data-workflow', 'duna-quality-security'];
const upstream = ['supabase', 'supabase-postgres-best-practices'];
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
}
function frontmatter(path) {
  const text = read(path);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(text);
  assert.ok(match, `Frontmatter/corpo ausente: ${path}`);
  return { ...parse(match[1]), body: match[2] };
}
function ruleset(rules) {
  check(Array.isArray(rules), 'Permissions precisa ser array V2');
  for (const rule of rules) {
    check(Object.keys(rule).sort().join() === 'action,effect,resource', 'Formato de regra V2');
    check(typeof rule.action === 'string' && typeof rule.resource === 'string'
      && ['allow', 'deny', 'ask'].includes(rule.effect), 'Valores da regra V2');
  }
}
function matches(pattern, value) {
  const regex = (p) => new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 's');
  return regex(pattern).test(value)
    || (pattern.endsWith(' *') && regex(pattern.slice(0, -2)).test(value));
}
function effect(rules, action, resource) {
  let result = 'ask';
  for (const rule of rules) {
    if (matches(rule.action, action) && matches(rule.resource, resource)) result = rule.effect;
  }
  let policy;
  for (const rule of config.policies) {
    if (rule.action === 'tool.use' && matches(rule.resource, `${action}:${resource}`)) {
      policy = rule.effect;
    }
  }
  return policy === 'deny' ? 'deny' : result;
}
function permissions(rules, label, mcpAllowed = false) {
  ruleset(rules);
  const test = (action, resource, wanted) => check(effect(rules, action, resource) === wanted,
    `${label}: ${action}:${resource} => ${wanted}`);
  test('read', 'app/page.tsx', 'allow');
  test('read', '.env', 'deny');
  test('read', '.env.local', 'deny');
  test('read', '.env.example', 'allow');
  test('read', '/home/example/.ssh/id_rsa', 'deny');
  test('read', 'private.pem', 'deny');
  test('read', 'supabase/.env.local', 'deny');
  test('external_directory', '/outside/*', 'ask');
  test('execute', '*', mcpAllowed ? 'allow' : 'deny');
  for (const action of metadataTools) test(action, '*', mcpAllowed ? 'allow' : 'deny');
  for (const action of approvedTools) test(action, '*', mcpAllowed ? 'ask' : 'deny');
  for (const action of [...deniedTools, ...legacyTools]) test(action, '*', 'deny');
  for (const action of [...metadataTools, ...approvedTools]) test(`${action}_unlisted`, '*', 'deny');
  test('supabase_outro_get_project_url', '*', 'deny');
  if (mcpAllowed) {
    test('opencode_list_mcp_resources', 'supabase_duna', 'deny');
    test('opencode_list_mcp_resources', 'supabase', 'deny');
    test('opencode_read_mcp_resource', 'supabase:example', 'deny');
    test('opencode_read_mcp_resource', 'supabase_duna:example', 'deny');
  }
  for (const command of ['git push', 'git push origin main', 'git reset --hard',
    'git clean -fd', 'git checkout -- app/page.tsx']) test('shell', command, 'deny');
  for (const command of ['git status --short', 'git diff --check', 'git diff --stat',
    'git diff --name-only', 'git diff', 'npm test', 'npm run typecheck',
    'npm run lint', 'node .opencode/validate.mjs --runtime']) test('shell', command, 'ask');
  for (const path of ['.git/config', 'nested/.git/config', '.env.local',
    '.agents/skills/supabase/SKILL.md', 'nested/.agents/skills/supabase/SKILL.md']) test('edit', path, 'deny');
  // Plan pode ter uma negação nativa mais restrita que o ask da raiz.
  check(['ask', 'deny'].includes(effect(rules, 'edit', 'app/page.tsx')), `${label}: edição sem auto-allow`);
  for (const child of [...names, 'general', 'explore', 'future-agent']) test('subagent', child, 'deny');
}

check(config.$schema === 'https://opencode.ai/config.json', 'Schema configurado');
check(config.model === 'openai/gpt-6.1-sol', 'Modelo confirmado');
check(config.providers.openai.models['gpt-6.1-sol'].settings.reasoningEffort === 'high', 'High padrão');
check(config.default_agent === 'build', 'Build nativo como agente padrão');
check(!('mcp' in config) && !('skills' in config) && !('instructions' in config)
  && !('plugins' in config), 'Sem duplicação de fontes/MCP/prompts');
check(Object.keys(config).every((key) => ['$schema', 'model', 'default_agent',
  'providers', 'permissions', 'policies', 'agents'].includes(key)), 'Campos V2 esperados');
assert.deepEqual(Object.keys(config.agents), ['build'], 'Somente permissões do Build nativo');
assert.deepEqual(Object.keys(config.agents.build), ['permissions'], 'Sem substituir prompt/modelo do Build');
ruleset(config.agents.build.permissions);
assert.deepEqual(config.agents.build.permissions, [
  { action: 'execute', resource: '*', effect: 'allow' },
  { action: 'opencode_list_mcp_resources', resource: '*', effect: 'deny' },
  { action: 'opencode_read_mcp_resource', resource: '*', effect: 'deny' },
  ...metadataTools.map((action) => ({ action, resource: '*', effect: 'allow' })),
  ...approvedTools.map((action) => ({ action, resource: '*', effect: 'ask' })),
], 'Allowlist exata do supabase_duna, sem novas liberações amplas');
ruleset(config.permissions);
assert.deepEqual(config.policies.filter((rule) => rule.resource.startsWith('supabase_')
  && rule.effect === 'allow').map((rule) => rule.resource).sort(),
  [...metadataTools, ...approvedTools].map((action) => `${action}:*`).sort(),
  'Policies Supabase estritamente nominais; sem novas exceções amplas');
for (const action of ['execute', ...metadataTools, ...approvedTools]) {
  check(effect([{ action: '*', resource: '*', effect: 'allow' }, ...config.permissions], action, '*') === 'deny',
    `MCP/Code Mode negados por padrão fora do executor: ${action}`);
}
for (const rule of config.policies) {
  check(rule.action === 'tool.use' && typeof rule.resource === 'string'
    && ['allow', 'deny'].includes(rule.effect), 'Policy V2');
}

const agentDirectory = resolve(root, '.opencode/agents');
const agentFiles = existsSync(agentDirectory) ? readdirSync(agentDirectory, { recursive: true }) : [];
check(!agentFiles.some((name) => /\.(md|jsonc?)$/i.test(String(name))), 'Sem agentes personalizados locais');
check(!existsSync(resolve(root, '.opencode/agent')), 'Sem diretório singular duplicado');
assert.deepEqual(readdirSync(resolve(root, '.opencode/skills')).sort(), [...skills].sort());
const paths = ['AGENTS.md', '.opencode/README.md', 'opencode.jsonc', '.opencode/validate.mjs'];
for (const skill of skills) {
  const path = `.opencode/skills/${skill}/SKILL.md`;
  const entry = frontmatter(path);
  check(entry.name === skill && entry.description?.length > 20, `Metadados ${skill}`);
  check(entry['disable-model-invocation'] !== true
    && entry.metadata?.['opencode/autoinvoke'] !== false, `Descoberta ${skill}`);
  paths.push(path);
}
const lock = JSON.parse(read('skills-lock.json'));
for (const skill of upstream) {
  const path = `.agents/skills/${skill}/SKILL.md`;
  check(frontmatter(path).name === skill, `Skill preservada ${skill}`);
  check(lock.skills[skill]?.source === 'supabase/agent-skills', `Origem ${skill}`);
  check(/^[a-f0-9]{64}$/.test(lock.skills[skill]?.computedHash ?? ''), `Hash upstream ${skill}`);
  paths.push(path);
}
for (const dir of ['.opencode/skills/duna-product-rules/references', '.opencode/skills/duna-ui-ux/references']) {
  for (const name of readdirSync(resolve(root, dir))) paths.push(`${dir}/${name}`);
}
for (const path of paths.filter((path) => path.endsWith('.md') && !path.startsWith('.agents/'))) {
  for (const match of read(path).matchAll(/\]\(([^\s)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^https?:/.test(target)) continue;
    const resolved = resolve(root, dirname(path), target);
    check(!relative(root, resolved).startsWith('..') && existsSync(resolved), `Referência ${path} -> ${target}`);
  }
}
for (const path of [...paths, 'skills-lock.json']) {
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--stdin'],
    { cwd: root, input: `${path}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  check(!ignored.error && ignored.status === 1 && !ignored.stdout.trim(), `Versionável ${path}`);
}
permissions([{ action: '*', resource: '*', effect: 'allow' }, ...config.permissions], 'Raiz preservada');
permissions([{ action: '*', resource: '*', effect: 'allow' }, ...config.permissions,
  ...config.agents.build.permissions], 'Build local', true);
console.log(`OK: Plan/Build nativos, sem agentes personalizados, 8 skills e proteções locais (${checks} verificações).`);
console.log('Disponibilidade operacional de ferramentas MCP não é comprovada pela matriz de permissões.');
console.log('Storage/Edge Functions e query_logs: nomes oficiais configurados; disponibilidade/operação não verificadas.');

if (process.argv.includes('--runtime')) {
  // A CLI pode usar HOME como localização padrão mesmo quando cwd é o projeto.
  const get = (path) => JSON.parse(execFileSync('opencode', ['api', 'get',
    path === '/api/info' ? path : `${path}?location%5Bdirectory%5D=${encodeURIComponent(root)}`], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const info = get('/api/info');
  check(typeof info.version === 'string' && /^2\./.test(info.version), 'OpenCode V2; validar o contrato retornado');
  const registeredAgents = get('/api/agent');
  const registeredSkills = get('/api/skill');
  check(registeredAgents.location?.directory === root
    && registeredSkills.location?.directory === root, 'Localização nativa correta');
  check(Array.isArray(registeredAgents.data) && Array.isArray(registeredSkills.data), 'Contrato das listagens locais');
  const actual = Object.fromEntries(registeredAgents.data.map((agent) => [agent.id, agent]));
  check(!registeredAgents.data.some((agent) => ['Front', 'Back'].includes(agent.id) || agent.id.startsWith('duna-')),
    'Sem perfis personalizados removidos no runtime');
  for (const name of ['build', 'plan', 'general', 'explore']) {
    check(actual[name], `Agente nativo encontrado: ${name}`);
    ruleset(actual[name].permissions);
    for (const action of ['execute', ...metadataTools, ...approvedTools, ...deniedTools, ...legacyTools]) {
      const wanted = name === 'build' && action === 'execute' ? 'allow'
        : name === 'build' && metadataTools.includes(action) ? 'allow'
        : name === 'build' && approvedTools.includes(action) ? 'ask' : 'deny';
      check(effect(actual[name].permissions, action, '*') === wanted,
        `Nativo ${name}: ${action} => ${wanted}`);
    }
  }
  check(registeredSkills.data.filter((entry) => entry.path.startsWith(`${root}/.opencode/skills/`)
    || entry.path.startsWith(`${root}/.agents/skills/`)).length === 8, 'Oito skills de projeto');
  for (const name of names) {
    check(actual[name]?.mode === 'primary', `Agente primário nativo ${name}`);
    permissions(actual[name].permissions, `Registrado ${name}`, name === 'build');
  }
  for (const skill of [...skills, ...upstream]) {
    const found = registeredSkills.data.filter((entry) => entry.id === skill);
    check(found.length === 1 && found[0].description, `Skill registrada ${skill}`);
    check(found[0].autoinvoke !== false, `Skill anunciável sob demanda ${skill}`);
    const base = skills.includes(skill) ? '.opencode' : '.agents';
    check(found[0].path === resolve(root, base, 'skills', skill, 'SKILL.md'), `Origem registrada ${skill}`);
  }
  const models = get('/api/model');
  check(Array.isArray(models.data), 'Contrato do catálogo local de modelos');
  check(models.data.some((model) => model.providerID === 'openai'
    && model.id === 'gpt-6.1-sol' && model.variants?.some((variant) => variant.id === 'high')),
  'Modelo/variante no catálogo local');
  const mcp = get('/api/mcp');
  check(mcp.location?.directory === root, 'Localização do estado MCP');
  check(Array.isArray(mcp.data), 'Contrato da listagem local MCP');
  const duna = mcp.data.find((entry) => entry.name === 'supabase_duna');
  check(duna, 'Conexão supabase_duna registrada para o projeto');
  for (const server of mcp.data.filter((entry) => /^supabase(?:[_-]|$)/.test(entry.name))) {
    console.log(`MCP ${server.name} (estado local): ${server.status?.status ?? 'desconhecido'}.`);
  }
  console.log('A API GET /api/mcp informa conexão, não autorização ou catálogo nominal de tools.');
  console.log('Storage/Edge Functions e query_logs: permissões configuradas não comprovam disponibilidade/operação.');
  // Não busca /api/config: pode conter configuração global e material sensível.
  // Não executa MCP nem tenta atualizar conexão, OAuth ou catálogo remoto.
  console.log(`OK: OpenCode ${info.version} confirmou agentes nativos, skills e regras registradas (${checks} verificações totais).`);
  console.log('Limites: policies são avaliadas localmente; sem prova E2E, disponibilidade de tools ou operação remota.');
}
