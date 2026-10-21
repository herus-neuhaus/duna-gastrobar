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
const names = ['duna-orchestrator', 'duna-product', 'duna-ui-ux',
  'duna-engineering', 'duna-quality-security', 'duna-database'];
const databaseAgent = 'duna-database';
const delegated = names.filter((name) => !['duna-orchestrator', databaseAgent].includes(name));
const metadataTools = ['supabase_get_project_url', 'supabase_list_migrations',
  'supabase_list_tables', 'supabase_list_extensions', 'supabase_get_advisors', 'supabase_search_docs'];
const approvedTools = ['supabase_get_logs', 'supabase_generate_typescript_types',
  'supabase_execute_sql', 'supabase_apply_migration'];
const skills = ['duna-product-rules', 'duna-ui-ux', 'duna-frontend',
  'duna-backend', 'duna-data-workflow', 'duna-quality-security'];
const upstream = ['supabase', 'supabase-postgres-best-practices'];
const expected = {
  'duna-orchestrator': ['opencode', 'duna-product-rules'],
  'duna-product': ['duna-product-rules'],
  'duna-ui-ux': ['duna-ui-ux', 'duna-product-rules'],
  'duna-engineering': ['duna-frontend', 'duna-backend', 'duna-data-workflow', ...upstream],
  'duna-quality-security': ['duna-quality-security', 'duna-product-rules',
    'duna-ui-ux', 'duna-data-workflow', ...upstream],
  'duna-database': ['duna-data-workflow', 'duna-product-rules', ...upstream],
};
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
function permissions(agents, native = false) {
  for (const name of names) {
    const rules = native ? agents[name].permissions
      : [{ action: '*', resource: '*', effect: 'allow' },
        ...config.permissions, ...agents[name].permissions];
    ruleset(rules);
    const test = (action, resource, wanted) => check(effect(rules, action, resource) === wanted,
      `${native ? 'Registrado' : 'Local'} ${name}: ${action}:${resource} => ${wanted}`);
    test('read', 'app/page.tsx', 'allow');
    test('read', '.env', 'deny');
    test('read', '.env.local', 'deny');
    test('read', '.env.example', 'allow');
    test('read', '/home/example/.ssh/id_rsa', 'deny');
    test('external_directory', '/outside/*', 'deny');
    test('execute', '*', name === databaseAgent ? 'allow' : 'deny');
    for (const action of metadataTools) test(action, '*', name === databaseAgent ? 'allow' : 'deny');
    for (const action of approvedTools) test(action, '*', name === databaseAgent ? 'ask' : 'deny');
    test('supabase_delete_branch', '*', 'deny');
    test('supabase_reset_branch', '*', 'deny');
    test('supabase_merge_branch', '*', 'deny');
    test('supabase_rebase_branch', '*', 'deny');
    test('supabase_create_branch', '*', 'deny');
    test('supabase_deploy_edge_function', '*', 'deny');
    test('supabase_update_storage_config', '*', 'deny');
    test('supabase_get_publishable_keys', '*', 'deny');
    test('supabase_future_mutation', '*', 'deny');
    test('opencode_session_move', '*', 'deny');
    test('shell', 'git push', 'deny');
    test('shell', 'git status --short', ['duna-engineering', 'duna-quality-security', databaseAgent].includes(name) ? 'allow' : 'deny');
    test('shell', 'git reset --hard', 'deny');
    test('shell', 'git clean -fd', 'deny');
    test('edit', '.git/config', 'deny');
    test('edit', '.env.local', 'deny');
    test('edit', '.agents/skills/supabase/SKILL.md', 'deny');
    test('shell', 'npm run typecheck',
      ['duna-engineering', 'duna-quality-security'].includes(name) ? 'ask' : 'deny');
    test('shell', 'python3 -c "print(1)"', name === 'duna-engineering' ? 'ask' : 'deny');
    test('shell', 'node .opencode/validate.mjs --runtime',
      name === 'duna-engineering' ? 'ask' : 'deny');
    test('edit', 'app/page.tsx', name === 'duna-engineering' ? 'allow' : 'deny');
    for (const path of ['supabase/migrations/20990101000000_reviewed.sql',
      'tests/database/reviewed.test.mjs', 'docs/funcionalidades/reservas-e-mesas.md']) {
      test('edit', path, name === databaseAgent ? 'ask' : name === 'duna-engineering' ? 'allow' : 'deny');
    }
    test('edit', '.opencode/agents/duna-product.md', name === 'duna-engineering' ? 'ask' : 'deny');
    for (const skill of [...skills, ...upstream, 'opencode', 'report']) {
      test('skill', skill, expected[name].includes(skill) ? 'allow' : 'deny');
    }
    for (const child of [...names, 'general', 'explore']) {
      test('subagent', child,
        name === 'duna-orchestrator' && delegated.includes(child) ? 'allow' : 'deny');
    }
  }
}

check(config.$schema === 'https://opencode.ai/config.json', 'Schema configurado');
check(config.model === 'openai/gpt-6.1-sol', 'Modelo confirmado');
check(config.providers.openai.models['gpt-6.1-sol'].settings.reasoningEffort === 'high', 'High padrão');
check(config.default_agent === names[0], 'Agente padrão');
check(!('mcp' in config) && !('skills' in config) && !('instructions' in config)
  && !('plugins' in config) && !('agents' in config), 'Sem duplicação de fontes/MCP/prompts');
check(Object.keys(config).every((key) => ['$schema', 'model', 'default_agent',
  'providers', 'permissions', 'policies'].includes(key)), 'Campos V2 esperados');
ruleset(config.permissions);
for (const action of ['execute', ...metadataTools, ...approvedTools]) {
  check(effect([{ action: '*', resource: '*', effect: 'allow' }, ...config.permissions], action, '*') === 'deny',
    `MCP/Code Mode negados por padrão fora do executor: ${action}`);
}
for (const rule of config.policies) {
  check(rule.action === 'tool.use' && typeof rule.resource === 'string'
    && ['allow', 'deny'].includes(rule.effect), 'Policy V2');
}

const agents = {};
const agentFiles = readdirSync(resolve(root, '.opencode/agents')).filter((name) => name.endsWith('.md'));
assert.deepEqual(agentFiles.sort(), names.map((name) => `${name}.md`).sort());
for (const name of names) {
  agents[name] = frontmatter(`.opencode/agents/${name}.md`);
  const agent = agents[name];
  check(Object.keys(agent).every((key) => ['description', 'mode', 'model', 'permissions', 'body'].includes(key)), 'Campos de agente V2');
  check(agent.description?.length > 20 && agent.body.length > 200, `Instruções ${name}`);
  check(agent.mode === ([names[0], databaseAgent].includes(name) ? 'primary' : 'all'), `Modo ${name}`);
  check(agent.model === 'openai/gpt-6.1-sol#high', `Modelo/variante ${name}`);
  check(agent.permissions[0].action === '*' && agent.permissions[0].effect === 'deny', 'Default deny');
}
check(!existsSync(resolve(root, '.opencode/agent')), 'Sem diretório singular duplicado');
assert.deepEqual(readdirSync(resolve(root, '.opencode/skills')).sort(), [...skills].sort());
const paths = ['AGENTS.md', '.opencode/README.md', 'opencode.jsonc', '.opencode/validate.mjs'];
paths.push(...names.map((name) => `.opencode/agents/${name}.md`));
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
permissions(agents);
console.log(`OK: estrutura, 6 agentes, 8 skills de projeto, referências e regras locais (${checks} verificações).`);

if (process.argv.includes('--runtime')) {
  // A CLI pode usar HOME como localização padrão mesmo quando cwd é o projeto.
  const get = (path) => JSON.parse(execFileSync('opencode', ['api', 'get',
    path === '/api/info' ? path : `${path}?location%5Bdirectory%5D=${encodeURIComponent(root)}`], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const info = get('/api/info');
  check(info.version === '2.1.1', 'Versão nativa auditada');
  const registeredAgents = get('/api/agent');
  const registeredSkills = get('/api/skill');
  check(registeredAgents.location?.directory === root
    && registeredSkills.location?.directory === root, 'Localização nativa correta');
  const actual = Object.fromEntries(registeredAgents.data.map((agent) => [agent.id, agent]));
  check(registeredAgents.data.filter((agent) => agent.id.startsWith('duna-')).length === 6,
    'Seis agentes Duna, sem duplicidade');
  for (const name of ['build', 'plan', 'general', 'explore']) {
    check(actual[name], `Agente nativo encontrado: ${name}`);
    for (const action of ['execute', ...metadataTools, ...approvedTools]) {
      check(effect(actual[name].permissions, action, '*') === 'deny',
        `Nativo ${name} não recebe acesso do executor: ${action}`);
    }
  }
  check(registeredSkills.data.filter((entry) => entry.path.startsWith(`${root}/.opencode/skills/`)
    || entry.path.startsWith(`${root}/.agents/skills/`)).length === 8, 'Oito skills de projeto');
  for (const name of names) {
    check(actual[name]?.system?.trim() === agents[name].body.trim(), `Prompt registrado ${name}`);
    check(actual[name]?.mode === agents[name].mode, `Modo registrado ${name}`);
    check(actual[name]?.model?.providerID === 'openai'
      && actual[name]?.model?.id === 'gpt-6.1-sol'
      && actual[name]?.model?.variant === 'high', `Modelo registrado ${name}`);
  }
  for (const skill of [...skills, ...upstream]) {
    const found = registeredSkills.data.filter((entry) => entry.id === skill);
    check(found.length === 1 && found[0].description, `Skill registrada ${skill}`);
    check(found[0].autoinvoke !== false, `Skill anunciável sob demanda ${skill}`);
    const base = skills.includes(skill) ? '.opencode' : '.agents';
    check(found[0].path === resolve(root, base, 'skills', skill, 'SKILL.md'), `Origem registrada ${skill}`);
  }
  const sources = get('/api/config');
  const project = sources.find((entry) => entry.path === resolve(root, 'opencode.jsonc'));
  check(project?.info?.default_agent === names[0], 'Configuração aceita pelo parser nativo');
  check(project?.info?.policies?.length === config.policies.length, 'Policies não descartadas pelo parser');
  permissions(actual, true);
  console.log(`OK: OpenCode ${info.version} confirmou parsing, descoberta e regras registradas (${checks} verificações totais).`);
}
