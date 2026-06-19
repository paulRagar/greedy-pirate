#!/usr/bin/env node
// Runs on Vercel build (vercel-build hook).
// 1. URL-encodes SUPABASE_DB_PASSWORD and constructs the session-pooler URL.
// 2. Runs drizzle-kit migrate against it.
// 3. Runs `supabase db push --db-url ...` for RLS / triggers / functions.
//
// Required env vars (set per scope in Vercel — Preview + Production):
//   SUPABASE_DB_PASSWORD  raw password, no URL encoding
//   SUPABASE_DB_HOST      e.g. aws-0-us-west-1.pooler.supabase.com
//   SUPABASE_PROJECT_REF  e.g. fyuasgpjrphxrituofsm
//
// Local builds (no VERCEL env) skip migrations entirely.
// Set SKIP_MIGRATIONS=1 on Vercel to bypass (e.g. infra-only deploys).
//
// Shared preview DB: all branch previews deploy against ONE preview database,
// so a branch's preview can push migrations that aren't on main yet. A later
// branch that lacks those migrations then fails `supabase db push` with
// "Remote migration versions not found in local migrations directory" — the
// remote is ahead of the branch. On PREVIEW that drift is expected and harmless
// (the missing migrations belong to other in-flight branches), so we log it and
// continue. PRODUCTION stays strict — any push failure there fails the build.
// Genuine migration errors (bad SQL) still fail preview too; only the
// remote-ahead drift is tolerated.

import { spawnSync } from 'node:child_process';

const isVercel = process.env.VERCEL === '1';
const skip = process.env.SKIP_MIGRATIONS === '1';

if (!isVercel) {
   console.log('[ci-migrate] not a Vercel build (VERCEL!=1) — skipping migrations.');
   process.exit(0);
}

if (skip) {
   console.log('[ci-migrate] SKIP_MIGRATIONS=1 — skipping migrations.');
   process.exit(0);
}

const env = process.env.VERCEL_ENV ?? 'unknown';
console.log(`[ci-migrate] Vercel build (env=${env}). Running migrations.`);

const required = ['SUPABASE_DB_PASSWORD', 'SUPABASE_DB_HOST', 'SUPABASE_PROJECT_REF'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
   console.error(`[ci-migrate] missing env vars: ${missing.join(', ')}`);
   process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
const host = process.env.SUPABASE_DB_HOST;
const ref = process.env.SUPABASE_PROJECT_REF;

const encodedPassword = encodeURIComponent(password);
const migrationUrl = `postgresql://postgres.${ref}:${encodedPassword}@${host}:5432/postgres`;

const safeUrl = migrationUrl.replace(encodedPassword, '***');
console.log(`[ci-migrate] migration target: ${safeUrl}`);

function run(label, cmd, args, extraEnv = {}) {
   const printable = args.map((a) => (a === migrationUrl ? '<redacted-url>' : a));
   console.log(`\n[ci-migrate] ▶ ${label}: ${cmd} ${printable.join(' ')}`);
   const result = spawnSync(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
   });
   if (result.status !== 0) {
      console.error(`[ci-migrate] ✗ ${label} failed (exit ${result.status}).`);
      process.exit(result.status ?? 1);
   }
   console.log(`[ci-migrate] ✓ ${label} done.`);
}

// Drizzle (schema) — always fatal. Its forward-only journal apply doesn't trip
// on a remote that's ahead, so drift never surfaces here.
run('drizzle-kit migrate', 'npx', ['drizzle-kit', 'migrate'], { DATABASE_URL: migrationUrl });

// supabase db push (RLS / triggers / functions) — strict remote-vs-local check.
// Tolerate only the remote-ahead drift on preview; fail on anything else.
const isProd = env === 'production';
const pushArgs = ['supabase', 'db', 'push', '--db-url', migrationUrl, '--include-all'];
console.log('\n[ci-migrate] ▶ supabase db push: npx supabase db push --db-url <redacted-url> --include-all');
const push = spawnSync('npx', pushArgs, { encoding: 'utf8', env: process.env });
if (push.stdout) process.stdout.write(push.stdout);
if (push.stderr) process.stderr.write(push.stderr);

if (push.status === 0) {
   console.log('[ci-migrate] ✓ supabase db push done.');
} else {
   const output = `${push.stdout ?? ''}${push.stderr ?? ''}`;
   const remoteAheadDrift = /Remote migration versions not found in local migrations directory/i.test(
      output,
   );
   if (!isProd && remoteAheadDrift) {
      console.warn(
         '[ci-migrate] ⚠ preview DB is ahead of this branch (another in-flight branch pushed newer migrations to the shared preview DB). Skipping supabase db push for this preview — production stays strict.',
      );
   } else {
      console.error(`[ci-migrate] ✗ supabase db push failed (exit ${push.status}).`);
      process.exit(push.status ?? 1);
   }
}

console.log('\n[ci-migrate] all migrations applied.');
