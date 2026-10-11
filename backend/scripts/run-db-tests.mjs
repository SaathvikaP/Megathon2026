/**
 * Runs the SQL test suite against a THROWAWAY PostgreSQL server (15+).
 *
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:54329/postgres npm run test:db
 *
 * - Refuses Supabase-hosted URLs: never point this at the shared project.
 * - Creates a uniquely named database, applies the Supabase shim, every migration
 *   (twice, to prove they are re-runnable), the test helpers, then each
 *   supabase/tests/*.test.sql file in its own transaction (rolled back).
 * - Drops only the database it created.
 * Requires `psql` on PATH or PSQL=<path to psql>.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const psql = process.env.PSQL || 'psql';
const baseUrl = process.env.TEST_DATABASE_URL;

if (!baseUrl) {
  console.error('Set TEST_DATABASE_URL to a throwaway local PostgreSQL server, e.g. postgresql://postgres@localhost:54329/postgres');
  process.exit(1);
}
const parsed = new URL(baseUrl);
if (/supabase\.(co|com)$/i.test(parsed.hostname) || /pooler/i.test(parsed.hostname)) {
  console.error('Refusing to run tests against a hosted Supabase database. Use a local throwaway server.');
  process.exit(1);
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
  console.error(`Refusing non-local host ${parsed.hostname}. Set ALLOW_REMOTE_TEST_DB=true only for a disposable CI database.`);
  process.exit(1);
}

const dbName = `paisa_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;

function run(url, args, input) {
  const res = spawnSync(psql, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', url, ...args], { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  return res;
}

function runFile(label, sql, { wrapInRollback = false } = {}) {
  const body = wrapInRollback ? `begin;\n${sql}\nrollback;\n` : sql;
  const res = run(testUrl.toString(), ['-f', '-'], body);
  const notices = (res.stderr || '').split(/\r?\n/).filter((l) => /NOTICE:\s+(not )?ok - /.test(l)).map((l) => l.replace(/^.*NOTICE:\s+/, ''));
  const errors = (res.stderr || '').split(/\r?\n/).filter((l) => /ERROR:/.test(l));
  return { ok: res.status === 0, notices, errors, label };
}

const migrationsDir = join(root, 'supabase', 'migrations');
const testsDir = join(root, 'supabase', 'tests');
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const testFiles = readdirSync(testsDir).filter((f) => f.endsWith('.test.sql')).sort();

let failed = 0;
let passed = 0;

const create = run(baseUrl, ['-c', `create database "${dbName}"`]);
if (create.status !== 0) {
  console.error('Could not create the test database:', create.stderr.trim());
  process.exit(1);
}
console.log(`Created throwaway database ${dbName}`);

try {
  const setup = [runFile('supabase shim', readFileSync(join(testsDir, '_supabase_shim.sql'), 'utf8'))];
  for (const pass of [1, 2]) {
    for (const m of migrations) setup.push(runFile(`migration ${m} (pass ${pass})`, readFileSync(join(migrationsDir, m), 'utf8')));
  }
  setup.push(runFile('test helpers', readFileSync(join(testsDir, '_helpers.sql'), 'utf8')));

  for (const s of setup) {
    if (s.ok) {
      console.log(`  ✓ ${s.label}`);
    } else {
      failed++;
      console.error(`  ✗ ${s.label}\n    ${s.errors.join('\n    ')}`);
    }
  }

  if (failed === 0) {
    for (const f of testFiles) {
      const r = runFile(f, readFileSync(join(testsDir, f), 'utf8'), { wrapInRollback: true });
      console.log(`\n${f}`);
      for (const n of r.notices) {
        if (n.startsWith('ok')) { passed++; console.log(`  ✓ ${n.slice(5)}`); }
      }
      if (!r.ok) {
        failed++;
        console.error(`  ✗ ${r.errors.join('\n    ') || 'psql exited with an error'}`);
      }
    }
  }
} finally {
  const drop = run(baseUrl, ['-c', `drop database if exists "${dbName}" with (force)`]);
  console.log(drop.status === 0 ? `\nDropped ${dbName}` : `\nCould not drop ${dbName}: ${drop.stderr.trim()}`);
}

console.log(`\n${passed} assertions passed, ${failed} failure(s).`);
process.exit(failed ? 1 : 0);
