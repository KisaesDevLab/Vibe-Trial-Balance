#!/usr/bin/env node
// Reversing entries and entry tickmarks, end to end. Boots the real server
// against a scratch Postgres database and walks:
// tickmarked, reversing book and tax AJEs → a mark from another client is
// refused → PATCH clears and sets → the AJE listing PDF → roll forward posts
// the reversals (and only with the option on) → a mark removed from the
// library leaves its entry → backup, restore as new and in place → the
// migration rolls back and forward.
//
//   npm run test:aje-e2e            (from the repo root)
//
// Prerequisites: a Postgres the dev credentials can CREATE DATABASE on
// (docker compose up -d gives one), server/node_modules installed.
//   E2E_PG_ADMIN_URL   admin connection (default: the compose dev instance)
//   E2E_KEEP_DB=1      leave the scratch database behind for inspection
//   E2E_VERBOSE=1      stream the server's output instead of buffering it
//
// Same harness shape as test/fs-e2e.mjs.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { Client } = require('pg');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVER = path.join(ROOT, 'server');
const KNEX_CLI = path.join(SERVER, 'node_modules', 'knex', 'bin', 'cli.js');
const TSX_IMPORT = ['--import', 'tsx'];

const ADMIN_URL = process.env.E2E_PG_ADMIN_URL
  ?? `postgres://vibetb:localdev123@127.0.0.1:${process.env.POSTGRES_PUBLISH_PORT ?? '5432'}/postgres`;
const VERBOSE = process.env.E2E_VERBOSE === '1';
const KEEP_DB = process.env.E2E_KEEP_DB === '1';
const ADMIN_PASSWORD = 'E2eAdmin!2026';

// ─────────────────────────────────────────────────────────────── plumbing

const t0 = Date.now();
const log = (line) => console.log(`[${String(Date.now() - t0).padStart(6)}ms] ${line}`);
const lines = [];
function capture(prefix, chunk) {
  for (const l of String(chunk).split(/\r?\n/)) {
    if (!l) continue;
    if (VERBOSE) console.log(`${prefix} ${l}`);
    lines.push(`${prefix} ${l}`);
    if (lines.length > 400) lines.shift();
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function childEnv(extra) {
  const keep = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'ComSpec', 'PATHEXT', 'NODE_OPTIONS',
    'ProgramFiles', 'ProgramFiles(x86)'];
  const env = {};
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k];
  for (const k of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'APP_BASE_URL', 'ALLOWED_ORIGIN', 'VIBE_AI_MODE', 'MAIL_TRANSPORT']) env[k] = '';
  return { ...env, ...extra };
}

function run(cmd, args, { cwd, env, prefix }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stdout.on('data', (c) => capture(prefix, c));
    child.stderr.on('data', (c) => { stderr += c; capture(prefix, c); });
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

function killTree(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else {
      child.kill('SIGTERM');
      setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3000).unref();
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────── database

let admin;
let dbc;
let dbName;
let dbUrl;

async function createScratchDb() {
  admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const stale = await admin.query(`SELECT datname FROM pg_database WHERE datname LIKE 'vibe_tb_aje_e2e_%'`);
  for (const r of stale.rows) await admin.query(`DROP DATABASE "${r.datname}" WITH (FORCE)`);
  dbName = `vibe_tb_aje_e2e_${Date.now().toString(36)}`;
  await admin.query(`CREATE DATABASE "${dbName}"`);
  const u = new URL(ADMIN_URL);
  u.pathname = `/${dbName}`;
  dbUrl = u.toString();
  log(`created ${dbName}`);
}

async function dropScratchDb() {
  if (dbc) { await dbc.end().catch(() => {}); dbc = null; }
  if (admin && dbName && !KEEP_DB) {
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch((e) => console.error('drop failed:', e.message));
    log(`dropped ${dbName}`);
  } else if (KEEP_DB) log(`kept ${dbName} (E2E_KEEP_DB=1)`);
  if (admin) { await admin.end().catch(() => {}); admin = null; }
}

const sql = async (text, params = []) => (await dbc.query(text, params)).rows;

// ─────────────────────────────────────────────────────────────── server

const secrets = { JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex') };
let server = null;

async function startServer() {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [...TSX_IMPORT, 'src/app.ts'], {
    cwd: SERVER,
    env: childEnv({ ...secrets, NODE_ENV: 'development', PORT: String(port), DATABASE_URL: dbUrl, MIGRATIONS_AUTO: 'false', VIBE_AUTH_MODE: 'local' }),
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stdout.on('data', (c) => capture('[server]', c));
  child.stderr.on('data', (c) => capture('[server]', c));
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  const deadline = Date.now() + 30_000;
  for (;;) {
    const code = await Promise.race([exited, sleep(150).then(() => null)]);
    if (code !== null) throw new Error(`server exited with code ${code} before becoming healthy`);
    if (await fetch(`${base}/api/v1/health`).then((r) => r.status === 200).catch(() => false)) break;
    if (Date.now() > deadline) throw new Error('server did not become healthy in 30 s');
  }
  server = { child, base };
  log(`server up on ${base}`);
}

async function api(p, { method = 'GET', token, json } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(server.base + p, { method, headers, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data = null;
  if ((res.headers.get('content-type') ?? '').includes('json')) { try { data = JSON.parse(buf.toString('utf8')); } catch { /* not json */ } }
  return { status: res.status, headers: res.headers, buf, json: data, text: data ? JSON.stringify(data) : `<${buf.length} bytes>` };
}

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; log(`ok   ${name}`); } catch (err) { log(`FAIL ${name}`); throw err; }
}

// ─────────────────────────────────────────────────────────────── fixtures

// [number, name, category, normal_balance, FY2025 unadjusted (signed cents, + = debit)]
const ACCOUNTS = [
  ['1000', 'Checking', 'assets', 'debit', 1000000],
  ['1100', 'Accounts Receivable', 'assets', 'debit', 400000],
  ['2100', 'Accrued Liabilities', 'liabilities', 'credit', 0],
  ['3000', 'Common Stock', 'equity', 'credit', -100000],
  ['3100', 'Retained Earnings', 'equity', 'credit', -300000],
  ['4000', 'Sales', 'revenue', 'credit', -2000000],
  ['6400', 'Utilities', 'expenses', 'debit', 600000],
  ['6500', 'Insurance', 'expenses', 'debit', 400000],
];

const fx = {};

async function seedFixtures() {
  const [client] = await sql(`INSERT INTO clients (name, entity_type, tax_year_end, is_active) VALUES ('Acme Widgets, Inc.', '1120S', '1231', true) RETURNING id`);
  const [other] = await sql(`INSERT INTO clients (name, entity_type, tax_year_end, is_active) VALUES ('Other Co.', '1065', '1231', true) RETURNING id`);
  fx.clientId = client.id;
  fx.otherClientId = other.id;
  const [p25] = await sql(`INSERT INTO periods (client_id, period_name, start_date, end_date, is_current) VALUES ($1, 'FY2025', '2025-01-01', '2025-12-31', true) RETURNING id`, [fx.clientId]);
  fx.p25 = p25.id;
  fx.accountId = {};
  for (const [number, name, category, normal, cy] of ACCOUNTS) {
    const [a] = await sql(
      `INSERT INTO chart_of_accounts (client_id, account_number, account_name, category, normal_balance, is_active) VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      [fx.clientId, number, name, category, normal],
    );
    fx.accountId[number] = a.id;
    const [dr, cr] = cy >= 0 ? [cy, 0] : [0, -cy];
    await sql(`INSERT INTO trial_balance (period_id, account_id, unadjusted_debit, unadjusted_credit) VALUES ($1,$2,$3,$4)`, [fx.p25, a.id, dr, cr]);
  }
}

const acct = (n) => fx.accountId[n];
const entry = (over) => ({ periodId: fx.p25, entryDate: '2025-12-31', ...over });

/** Signed book-adjusted balance (+ = debit) of one account in one period. */
async function adjusted(periodId, number) {
  const [r] = await sql('SELECT book_adjusted_debit::bigint AS dr, book_adjusted_credit::bigint AS cr FROM v_adjusted_trial_balance WHERE period_id = $1 AND account_id = $2', [periodId, acct(number)]);
  return r ? Number(r.dr) - Number(r.cr) : 0;
}

async function inBalance(periodId) {
  const [r] = await sql('SELECT COALESCE(SUM(book_adjusted_debit),0)::bigint AS dr, COALESCE(SUM(book_adjusted_credit),0)::bigint AS cr FROM v_adjusted_trial_balance WHERE period_id = $1', [periodId]);
  return Number(r.dr) === Number(r.cr);
}

// ─────────────────────────────────────────────────────────────── scenarios

async function main() {
  await createScratchDb();
  const env = childEnv({ ...secrets, NODE_ENV: 'development', DATABASE_URL: dbUrl });
  const mig = await run(process.execPath, [...TSX_IMPORT, 'src/migrate.ts'], { cwd: SERVER, env, prefix: '[migrate]' });
  assert.equal(mig.code, 0, `migrations failed: ${mig.stderr}`);
  const seed = await run(process.execPath, [KNEX_CLI, 'seed:run', '--knexfile', 'knexfile.js', '--specific', '001_default_admin.js'], { cwd: SERVER, env, prefix: '[seed]' });
  assert.equal(seed.code, 0, `admin seed failed: ${seed.stderr}`);
  dbc = new Client({ connectionString: dbUrl });
  await dbc.connect();
  await seedFixtures();
  await startServer();

  let token;

  await step('sign in and rotate the bootstrap password', async () => {
    let login = await api('/api/v1/auth/login', { method: 'POST', json: { username: 'admin', password: 'admin1234' } });
    assert.equal(login.status, 200, login.text);
    const rot = await api('/api/v1/auth/change-password', { method: 'POST', token: login.json.data.token, json: { currentPassword: 'admin1234', newPassword: ADMIN_PASSWORD } });
    assert.equal(rot.status, 200, rot.text);
    login = await api('/api/v1/auth/login', { method: 'POST', json: { username: 'admin', password: ADMIN_PASSWORD } });
    token = login.json.data.token;
  });

  await step('each client gets a tickmark', async () => {
    const a = await api(`/api/v1/clients/${fx.clientId}/tickmarks`, { method: 'POST', token, json: { symbol: '✓', description: 'Agreed to invoice' } });
    assert.equal(a.status, 201, a.text);
    fx.tick = a.json.data.id;
    const b = await api(`/api/v1/clients/${fx.otherClientId}/tickmarks`, { method: 'POST', token, json: { symbol: 'Δ', description: 'Recomputed' } });
    assert.equal(b.status, 201, b.text);
    fx.otherTick = b.json.data.id;
  });

  await step('a reversing book accrual with a tickmark saves both', async () => {
    const r = await api('/api/v1/journal-entries', {
      method: 'POST', token,
      json: entry({ entryType: 'book', description: 'Accrue December utilities', workpaperRef: 'N-1', isReversing: true, tickmarkId: fx.tick,
        lines: [{ accountId: acct('6400'), debit: 118050, credit: 0 }, { accountId: acct('2100'), debit: 0, credit: 118050 }] }),
    });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.data.is_reversing, true);
    assert.equal(r.json.data.tickmark_id, fx.tick);
    fx.accrual = r.json.data.id;
  });

  await step('a mark from another client\'s library is refused and nothing is saved', async () => {
    const before = (await sql('SELECT count(*)::int AS n FROM journal_entries'))[0].n;
    const r = await api('/api/v1/journal-entries', {
      method: 'POST', token,
      json: entry({ entryType: 'book', tickmarkId: fx.otherTick,
        lines: [{ accountId: acct('6400'), debit: 100, credit: 0 }, { accountId: acct('2100'), debit: 0, credit: 100 }] }),
    });
    assert.equal(r.status, 400, r.text);
    assert.equal(r.json.error.code, 'INVALID_TICKMARK');
    assert.equal((await sql('SELECT count(*)::int AS n FROM journal_entries'))[0].n, before);
    const p = await api(`/api/v1/journal-entries/${fx.accrual}`, { method: 'PATCH', token, json: { tickmarkId: fx.otherTick } });
    assert.equal(p.status, 400, p.text);
    assert.equal((await sql('SELECT tickmark_id FROM journal_entries WHERE id = $1', [fx.accrual]))[0].tickmark_id, fx.tick);
  });

  await step('a reversing tax entry, a recurring reversing accrual and a plain entry', async () => {
    const tax = await api('/api/v1/journal-entries', {
      method: 'POST', token,
      json: entry({ entryType: 'tax', description: 'Accrual to cash: receivables', isReversing: true,
        lines: [{ accountId: acct('4000'), debit: 400000, credit: 0 }, { accountId: acct('1100'), debit: 0, credit: 400000 }] }),
    });
    assert.equal(tax.status, 201, tax.text);
    fx.taxRev = tax.json.data.id;
    const rec = await api('/api/v1/journal-entries', {
      method: 'POST', token,
      json: entry({ entryType: 'book', description: 'Accrue insurance', isRecurring: true, isReversing: true,
        lines: [{ accountId: acct('6500'), debit: 50000, credit: 0 }, { accountId: acct('2100'), debit: 0, credit: 50000 }] }),
    });
    assert.equal(rec.status, 201, rec.text);
    const plain = await api('/api/v1/journal-entries', {
      method: 'POST', token,
      json: entry({ entryType: 'book', description: 'Reclass',
        lines: [{ accountId: acct('6500'), debit: 1000, credit: 0 }, { accountId: acct('6400'), debit: 0, credit: 1000 }] }),
    });
    assert.equal(plain.status, 201, plain.text);
    assert.equal(plain.json.data.is_reversing, false);
    assert.equal(plain.json.data.tickmark_id, null);
    fx.plain = plain.json.data.id;
  });

  await step('PATCH sets and clears both fields; the list returns them', async () => {
    let p = await api(`/api/v1/journal-entries/${fx.plain}`, { method: 'PATCH', token, json: { isReversing: true, tickmarkId: fx.tick } });
    assert.equal(p.status, 200, p.text);
    assert.equal(p.json.data.is_reversing, true);
    assert.equal(p.json.data.tickmark_id, fx.tick);
    // Leaving a field out changes nothing.
    p = await api(`/api/v1/journal-entries/${fx.plain}`, { method: 'PATCH', token, json: { description: 'Reclass utilities to insurance' } });
    assert.equal(p.json.data.is_reversing, true);
    assert.equal(p.json.data.tickmark_id, fx.tick);
    p = await api(`/api/v1/journal-entries/${fx.plain}`, { method: 'PATCH', token, json: { isReversing: false, tickmarkId: null } });
    assert.equal(p.status, 200, p.text);
    assert.equal(p.json.data.is_reversing, false);
    assert.equal(p.json.data.tickmark_id, null);
    const list = await api(`/api/v1/periods/${fx.p25}/journal-entries`, { token });
    const accrual = list.json.data.find((e) => e.id === fx.accrual);
    assert.equal(accrual.is_reversing, true);
    assert.equal(accrual.tickmark_id, fx.tick);
  });

  await step('the AJE listing PDF renders with a mark and a reversing entry', async () => {
    const r = await api(`/api/v1/reports/periods/${fx.p25}/aje-listing`, { token });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.equal(r.buf.subarray(0, 4).toString(), '%PDF');
  });

  await step('roll forward with the option off posts no reversals', async () => {
    const r = await api(`/api/v1/periods/${fx.p25}/roll-forward`, {
      method: 'POST', token, json: { periodName: 'FY2026 (no reversals)', startDate: '2026-01-01', endDate: '2026-12-31', reverseEntries: false, copyRecurringJEs: false },
    });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.data.reversalsPosted, 0);
    const n = await sql('SELECT count(*)::int AS n FROM journal_entries WHERE period_id = $1', [r.json.data.period.id]);
    assert.equal(n[0].n, 0);
  });

  await step('roll forward posts each reversing entry\'s reversal on the first day; the year nets to zero', async () => {
    const r = await api(`/api/v1/periods/${fx.p25}/roll-forward`, {
      method: 'POST', token, json: { periodName: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31' },
    });
    assert.equal(r.status, 201, r.text);
    fx.p26 = r.json.data.period.id;
    assert.equal(r.json.data.reversalsPosted, 3);
    assert.equal(r.json.data.jeCopied, 1);

    const revs = await sql(
      `SELECT id, entry_type, entry_number, to_char(entry_date, 'YYYY-MM-DD') AS d, description, workpaper_ref, is_reversing, is_recurring, tickmark_id
         FROM journal_entries WHERE period_id = $1 AND source_tag = 'reversal' ORDER BY entry_type, entry_number`, [fx.p26]);
    assert.deepEqual(revs.map((e) => [e.entry_type, e.entry_number, e.d, e.description]), [
      ['book', 1, '2026-01-01', 'Reversal of book AJE #1: Accrue December utilities'],
      ['book', 2, '2026-01-01', 'Reversal of book AJE #2: Accrue insurance'],
      ['tax', 1, '2026-01-01', 'Reversal of tax AJE #1: Accrual to cash: receivables'],
    ]);
    for (const e of revs) {
      assert.equal(e.is_reversing, false);
      assert.equal(e.is_recurring, false);
      assert.equal(e.tickmark_id, null);
    }
    assert.equal(revs[0].workpaper_ref, 'N-1');
    // Lines are swapped.
    const l = await sql('SELECT account_id, debit::bigint AS dr, credit::bigint AS cr FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id', [revs[0].id]);
    assert.deepEqual(l.map((x) => [x.account_id, Number(x.dr), Number(x.cr)]), [[acct('6400'), 0, 118050], [acct('2100'), 118050, 0]]);

    // The recurring accrual is copied and still reverses next year.
    const [copy] = await sql(`SELECT is_reversing, is_recurring, source_tag FROM journal_entries WHERE period_id = $1 AND description = 'Accrue insurance'`, [fx.p26]);
    assert.deepEqual(copy, { is_reversing: true, is_recurring: true, source_tag: null });

    // Utilities: 6,000 + 1,180.50 accrual - 10 reclass carried in, less the 1,180.50 reversal.
    assert.equal(await adjusted(fx.p26, '6400'), 600000 + 118050 - 1000 - 118050);
    // Accrued liabilities: both accruals carried in and reversed; the recurring copy re-accrues.
    assert.equal(await adjusted(fx.p26, '2100'), -50000);
    assert.ok(await inBalance(fx.p26), 'new period in balance');
  });

  await step('removing a mark from the library leaves the entry, unmarked', async () => {
    const d = await api(`/api/v1/tickmarks/${fx.tick}`, { method: 'DELETE', token });
    assert.equal(d.status, 200, d.text);
    const [e] = await sql('SELECT id, tickmark_id FROM journal_entries WHERE id = $1', [fx.accrual]);
    assert.deepEqual(e, { id: fx.accrual, tickmark_id: null });
    const a = await api(`/api/v1/clients/${fx.clientId}/tickmarks`, { method: 'POST', token, json: { symbol: '√', description: 'Traced' } });
    assert.equal(a.status, 201, a.text);
    fx.tick = a.json.data.id;
    const p = await api(`/api/v1/journal-entries/${fx.accrual}`, { method: 'PATCH', token, json: { tickmarkId: fx.tick } });
    assert.equal(p.status, 200, p.text);
  });

  await step('a client backup restores as new and in place: reversing kept, marks dropped (the library is not restored)', async () => {
    const b = await api(`/api/v1/backup/client/${fx.clientId}`, { method: 'POST', token });
    assert.equal(b.status, 200, b.text);
    const asNew = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: b.json.data.id, mode: 'as_new' } });
    assert.equal(asNew.status, 200, asNew.text);
    const newClientId = asNew.json.data.newClientId;
    assert.ok(newClientId && newClientId !== fx.clientId, asNew.text);
    const restored = await sql(
      `SELECT je.description, je.is_reversing, je.tickmark_id, je.source_tag FROM journal_entries je JOIN periods p ON p.id = je.period_id
        WHERE p.client_id = $1 AND p.period_name = 'FY2025' ORDER BY je.entry_type, je.entry_number`, [newClientId]);
    assert.equal(restored.length, 4);
    assert.deepEqual(restored.map((e) => e.is_reversing), [true, true, false, true]);
    assert.ok(restored.every((e) => e.tickmark_id === null));
    const revTags = await sql(`SELECT count(*)::int AS n FROM journal_entries je JOIN periods p ON p.id = je.period_id WHERE p.client_id = $1 AND je.source_tag = 'reversal'`, [newClientId]);
    assert.equal(revTags[0].n, 3);

    const replace = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: b.json.data.id, mode: 'replace', targetClientId: fx.clientId } });
    assert.equal(replace.status, 200, replace.text);
    const inPlace = await sql(
      `SELECT je.is_reversing, je.tickmark_id FROM journal_entries je JOIN periods p ON p.id = je.period_id WHERE p.client_id = $1 AND p.period_name = 'FY2025'`, [fx.clientId]);
    assert.equal(inPlace.filter((e) => e.is_reversing).length, 3);
    assert.ok(inPlace.every((e) => e.tickmark_id === null));
  });

  await killTree(server.child);
  server = null;

  await step('the migration rolls back and forward', async () => {
    const down = await run(process.execPath, [KNEX_CLI, 'migrate:down', '--knexfile', 'knexfile.js'], { cwd: SERVER, env, prefix: '[migrate]' });
    assert.equal(down.code, 0, `migrate:down failed: ${down.stderr}`);
    const cols = async () => (await sql(`SELECT column_name FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name IN ('is_reversing','tickmark_id') ORDER BY 1`)).map((r) => r.column_name);
    assert.deepEqual(await cols(), []);
    const up = await run(process.execPath, [KNEX_CLI, 'migrate:up', '--knexfile', 'knexfile.js'], { cwd: SERVER, env, prefix: '[migrate]' });
    assert.equal(up.code, 0, `migrate:up failed: ${up.stderr}`);
    assert.deepEqual(await cols(), ['is_reversing', 'tickmark_id']);
  });

  log(`${passed} steps passed`);
}

main()
  .then(async () => { await dropScratchDb(); process.exit(0); })
  .catch(async (err) => {
    console.error(err);
    console.error('--- last output ---');
    for (const l of lines.slice(-60)) console.error(l);
    if (server) await killTree(server.child);
    await dropScratchDb();
    process.exit(1);
  });
