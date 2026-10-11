/**
 * Non-destructive check against the shared Supabase project.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the
 * environment, or from the app's frontend/.env.local or frontend/.env (Next.js only
 * loads env files from its own folder, so that is the single place for them).
 * Never prints key values and never writes data.
 *
 *   1. Auth health endpoint reachable with the anon key  -> project + key are valid
 *   2. Calls an RPC as the anonymous role:
 *        permission denied (42501) -> migrations applied (anon is correctly locked out)
 *        function not found        -> migrations not applied yet
 *   3. Optional: VERIFY_EMAIL / VERIFY_PASSWORD of an existing test account to sign
 *      in and read the Money Quest overview as that user.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_REF = 'umewelsxflzklynuibbh';
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend');

function loadEnvFile(filename) {
  const path = resolve(frontendDir, filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

function fail(msg, code = 1) {
  console.error(`VERIFY_FAILED: ${msg}`);
  process.exitCode = code;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || anonKey.startsWith('your-')) {
    return fail('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or placeholders. Copy frontend/.env.example to frontend/.env.local.');
  }
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return fail('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  if (host !== `${EXPECTED_REF}.supabase.co` && process.env.ALLOW_NON_PROJECT_SUPABASE_URL !== 'true') {
    return fail(`URL host is ${host}, expected ${EXPECTED_REF}.supabase.co (the shared project).`);
  }
  console.log(`Project host: ${host}`);
  console.log('Anon key: configured (value not printed)');

  const health = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: anonKey } }).catch((e) => ({ ok: false, status: 0, error: e }));
  if (!health.ok) {
    return fail(`Auth health check failed (HTTP ${health.status}). Check the URL, the anon key and your network.`);
  }
  console.log('STEP 1 OK: Supabase Auth reachable and the anon key was accepted.');

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: rpcError } = await anon.rpc('get_money_quest_overview');
  if (!rpcError) {
    return fail('get_money_quest_overview ran for the anonymous role. Function privileges are too broad — re-apply the migrations.');
  }
  if (rpcError.code === 'PGRST202' || /could not find the function/i.test(rpcError.message)) {
    console.error('VERIFY_PARTIAL: connected, but the platform migrations are not applied (get_money_quest_overview not found).');
    console.error('Apply backend/supabase/migrations/*.sql in order — see docs/DATABASE_SETUP.md.');
    process.exitCode = 2;
    return;
  }
  if (rpcError.code === '42501' || /permission denied/i.test(rpcError.message)) {
    console.log('STEP 2 OK: migrations present; anonymous access is denied as intended.');
  } else {
    return fail(`Unexpected RPC response (code ${rpcError.code ?? 'n/a'}).`);
  }

  const email = process.env.VERIFY_EMAIL;
  const password = process.env.VERIFY_PASSWORD;
  if (!email || !password) {
    console.log('STEP 3 skipped: set VERIFY_EMAIL and VERIFY_PASSWORD (an existing test account) to check signed-in access.');
    console.log(`VERIFY_OK: connected to project ${EXPECTED_REF}.`);
    return;
  }
  const { error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) return fail('Test account sign-in failed (credentials not printed).');
  const { data, error } = await anon.rpc('get_money_quest_overview');
  await anon.auth.signOut();
  if (error) return fail(`Signed-in RPC failed (code ${error.code ?? 'n/a'}).`);
  console.log(`STEP 3 OK: signed in as the test account; ${Array.isArray(data) ? data.length : 0} published quiz level(s) visible.`);
  console.log(`VERIFY_OK: connected to project ${EXPECTED_REF}.`);
}

main().catch((error) => fail(`unexpected error: ${error.message}`));
