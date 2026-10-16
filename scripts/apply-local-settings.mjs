import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

// No .env, arbitrary URLs, remote flags or migration-history rewriting. Older
// local snapshots use legacy migration filenames, so apply only this feature's
// prerequisite and migration, verifying the isolated cluster before any write.
const identity = execFileSync('docker', ['exec', 'supabase_db_duna-plan1-isolated', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select system_identifier from pg_control_system()'], { encoding: 'utf8' }).trim();
const db = new pg.Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 'postgres', password: 'postgres' });
await db.connect();
try {
  assert.equal((await db.query('select system_identifier from pg_control_system()')).rows[0].system_identifier, identity);
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url));
  const nomes = ['require_cpf_optional_email', 'configuracoes_estabelecimento'];
  if (process.argv.includes('--acessos')) nomes.push('alinhar_acessos_administrador_operacao');
  nomes.push('preservar_reservas_em_dias_fechados');
  for (const nome of nomes) {
    const arquivos = migrations.filter((arquivo) => arquivo.endsWith(`_${nome}.sql`));
    assert.equal(arquivos.length, 1, `Migração única esperada para ${nome}`);
    const arquivo = arquivos[0], versao = arquivo.split('_')[0];
    // O rascunho local pode preceder a versão registrada pelo MCP em produção.
    // Reconhece-o pelo nome, sem reexecutar DDL nem reescrever seu histórico.
    if ((await db.query('select 1 from supabase_migrations.schema_migrations where version=$1 or name=$2', [versao, nome])).rowCount) continue;
    const sql = readFileSync(new URL(`../supabase/migrations/${arquivo}`, import.meta.url), 'utf8').replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, '');
    await db.query('begin');
    try {
      await db.query(sql);
      await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [versao, nome]);
      await db.query('commit');
      console.log(`Migração aplicada apenas no banco isolado: ${nome}`);
    } catch (error) { await db.query('rollback'); throw error; }
  }
} finally { await db.end(); }
