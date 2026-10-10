import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../supabase/inspection/', import.meta.url);
const sql = readFileSync(new URL('catalog.sql', root), 'utf8');
const expected = JSON.parse(readFileSync(new URL('observed-2026-10-03.json', root), 'utf8'));
const reviewed = JSON.parse(readFileSync(new URL('reviewed-body-differences.json', root), 'utf8'));
const expectedPlan2a = JSON.parse(readFileSync(new URL('expected-catalog-differences-plan-2a.json', root), 'utf8'));
const expectedPlan2b = JSON.parse(readFileSync(new URL('expected-catalog-differences-plan-2b.json', root), 'utf8'));
const actual = JSON.parse(execFileSync('docker', ['exec', '-i', 'supabase_db_duna-plan1-isolated', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }));
let differences = 0;
let reviewedCount = 0;
let expectedPlan2aCount = 0;
let expectedPlan2bCount = 0;
for (const key of Object.keys(expected).filter(key => key !== 'functions')) {
  const matches = actual[key] === expected[key];
  const planned = expectedPlan2b.catalog[key];
  if (!matches && planned?.after === actual[key]) {
    console.log(`${key}: EXPECTED PLAN 2B (${planned.reason})`);
    expectedPlan2bCount++;
    continue;
  }
  console.log(`${key}: ${matches ? 'MATCH' : `DIFF (${actual[key]})`}`);
  if (!matches) differences++;
}
for (const name of new Set([...Object.keys(expected.functions), ...Object.keys(actual.functions)])) {
  for (const field of ['body', 'contract']) {
    if (expected.functions[name]?.[field] !== actual.functions[name]?.[field]) {
      const planned = expectedPlan2b.functions[name];
      if (planned?.[field]?.after === actual.functions[name]?.[field]) {
        console.log(`${name}.${field}: EXPECTED PLAN 2B (${planned.reason})`);
        expectedPlan2bCount++;
        continue;
      }
      const plannedPlan2a = expectedPlan2a.functions[name];
      if (plannedPlan2a?.[field]?.after === actual.functions[name]?.[field]) {
        console.log(`${name}.${field}: EXPECTED PLAN 2A (${plannedPlan2a.reason})`);
        expectedPlan2aCount++;
        continue;
      }
      if (field === 'body' && reviewed[name]?.observed === expected.functions[name]?.body && reviewed[name]?.local === actual.functions[name]?.body) {
        console.log(`${name}.body: REVIEWED (${reviewed[name].reason})`);
        reviewedCount++;
        continue;
      }
      console.log(`${name}.${field}: DIFF (${actual.functions[name]?.[field] || 'missing'})`);
      differences++;
    }
  }
}
console.log(`${Object.keys(actual.functions).length} functions inspected; ${reviewedCount} reviewed body differences; ${expectedPlan2aCount} expected Plan 2A differences; ${expectedPlan2bCount} expected Plan 2B differences; ${differences} unreviewed differences.`);
process.exitCode = differences ? 1 : 0;
