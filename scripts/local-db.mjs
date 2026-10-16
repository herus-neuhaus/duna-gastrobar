import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const workdir = resolve(root, '.local-db');
const action = process.argv[2];
if (!['start', 'start:pre-plan-2a', 'apply:plan-2a', 'start:post-plan-2b', 'apply:plan-2b-complement', 'stop', 'types', 'types:check'].includes(action)) throw new Error('Unknown local database action');
// Never load .env, link a project, accept a database URL or use remote flags.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(SUPABASE_|PG|DATABASE_URL|NEXT_PUBLIC_|PAGAR_ME_)/.test(key)));
function cli(args, capture = false) {
  const result = spawnSync('npx', ['--yes', 'supabase@2.119.0', '--workdir', workdir, ...args], {
    cwd: root, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(capture ? result.stderr : 'Supabase CLI failed');
  return result.stdout;
}
if (action === 'start' || action === 'start:pre-plan-2a' || action === 'start:post-plan-2b') {
  // Only the generated staging directory, never canonical SQL or database data.
  rmSync(resolve(workdir, 'supabase/migrations'), { recursive: true, force: true });
  mkdirSync(resolve(workdir, 'supabase/migrations'), { recursive: true });
  writeFileSync(resolve(workdir, 'supabase/config.toml'), readFileSync(resolve(root, 'supabase/local.config.toml')));
  writeFileSync(resolve(workdir, 'supabase/migrations/20260901000000_local_prerequisites.sql'), readFileSync(resolve(root, 'supabase/bootstrap/prerequisites.sql')));
  for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    if (action === 'start:pre-plan-2a' && file === '20261003090000_sync_rescheduled_table_assignments.sql') continue;
    if (action === 'start:post-plan-2b' && file === '20261003110000_harden_capacity_permissions_and_turn_identity.sql') continue;
    writeFileSync(resolve(workdir, 'supabase/migrations', file), readFileSync(resolve(root, 'supabase/migrations', file)));
  }
  cli(['start', '--exclude', 'realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
} else if (action === 'apply:plan-2a') {
  writeFileSync(
    resolve(workdir, 'supabase/migrations/20261003090000_sync_rescheduled_table_assignments.sql'),
    readFileSync(resolve(root, 'supabase/migrations/20261003090000_sync_rescheduled_table_assignments.sql')),
  );
  cli(['migration', 'up', '--local']);
} else if (action === 'apply:plan-2b-complement') {
  writeFileSync(
    resolve(workdir, 'supabase/migrations/20261003110000_harden_capacity_permissions_and_turn_identity.sql'),
    readFileSync(resolve(root, 'supabase/migrations/20261003110000_harden_capacity_permissions_and_turn_identity.sql')),
  );
  cli(['migration', 'up', '--local']);
} else if (action === 'stop') {
  cli(['stop', '--no-backup']);
} else {
  const generated = cli(['gen', 'types', 'typescript', '--local', '--schema', 'public'], true).trimStart();
  if (!generated.startsWith('export type Json')) throw new Error('Unexpected type generator output');
  // Postgres does not describe nullable function arguments in its catalog. These
  // RPCs deliberately accept null for optional contact/CPF fields.
  const nullableArguments = generated
    .replace(/((?:"p_email"|p_email):\s*string)(?=\s*[,;}\n])/g, '$1 | null')
    .replace(/((?:"p_cpf"|p_cpf)\?:\s*string)(?=\s*[,;}\n])/g, '$1 | null');
  const types = ts.createPrinter().printFile(ts.createSourceFile('database.types.ts', nullableArguments, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  const target = resolve(root, 'lib/supabase/database.types.ts');
  if (action === 'types:check') {
    if (readFileSync(target, 'utf8') !== types) throw new Error('Database types differ; run npm run db:types');
    console.log('Database types match the isolated schema.');
  } else writeFileSync(target, types);
}
