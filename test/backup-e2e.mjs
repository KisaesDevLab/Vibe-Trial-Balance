#!/usr/bin/env node
// Backup round-trip check (desktop sync S0). Boots the real server against a
// scratch Postgres database, seeds the Summit Ridge demo client, adds every
// kind of client data the app keeps, then:
//
//   1. client backup → restore as a new client
//   2. client backup → restore in place (replace) into the same client
//   3. period backup → restore as a new client
//
// and compares every client-scoped table, row by row, apart from ids. The
// table list is not written down here: it is walked from the database's own
// foreign keys, so a table added later is compared automatically, or the test
// fails until it is either carried by the backup or listed in NOT_COMPARED
// with a reason.
//
//   npm run test:backup-e2e        (from server/)
//
// Prerequisites: a Postgres the dev credentials can CREATE DATABASE on
// (docker compose up -d gives one), server/node_modules installed.
//   E2E_PG_ADMIN_URL   admin connection (default: the compose dev instance)
//   E2E_KEEP_DB=1      leave the scratch database behind for inspection
//   E2E_VERBOSE=1      stream the server's output instead of buffering it

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
const DB_PREFIX = 'vibe_tb_backup_e2e_';

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
    child.on('exit', (code) => resolve({ code, stderr }));
  });
}

function killTree(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) { resolve(); return; }
    child.once('exit', () => resolve());
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
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
  const stale = await admin.query(`SELECT datname FROM pg_database WHERE datname LIKE '${DB_PREFIX}%'`);
  for (const r of stale.rows) await admin.query(`DROP DATABASE "${r.datname}" WITH (FORCE)`);
  dbName = `${DB_PREFIX}${Date.now().toString(36)}`;
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
const one = async (text, params = []) => (await sql(text, params))[0];

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

async function api(p, { method = 'GET', token, json, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form !== undefined) body = form;
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

const fx = {};

/**
 * Summit Ridge (seed 004) has FY 2024 with a TB, bank transactions and book
 * AJEs. Add a rolled-forward FY 2025 and one or more rows in every other
 * client table, so each restore path has something to lose.
 */
async function enrichFixture() {
  const c = await one(`SELECT id FROM clients WHERE name = 'Summit Ridge Consulting LLC'`);
  fx.clientId = c.id;
  fx.adminId = (await one(`SELECT id FROM app_users WHERE username = 'admin'`)).id;
  fx.p24 = (await one(`SELECT id FROM periods WHERE client_id = $1 AND period_name = 'FY 2024'`, [fx.clientId])).id;
  const acct = async (n) => (await one(`SELECT id FROM chart_of_accounts WHERE client_id = $1 AND account_number = $2`, [fx.clientId, n])).id;

  // FY 2025, rolled forward: last year's unadjusted balances become prior year.
  fx.p25 = (await one(
    `INSERT INTO periods (client_id, period_name, start_date, end_date, is_current, rolled_forward_from) VALUES ($1, 'FY 2025', '2025-01-01', '2025-12-31', false, $2) RETURNING id`,
    [fx.clientId, fx.p24],
  )).id;
  await sql(
    `INSERT INTO trial_balance (period_id, account_id, unadjusted_debit, unadjusted_credit, prior_year_debit, prior_year_credit, updated_by)
     SELECT $1, account_id, unadjusted_debit + 1000, unadjusted_credit + 1000, unadjusted_debit, unadjusted_credit, $3 FROM trial_balance WHERE period_id = $2`,
    [fx.p25, fx.p24, fx.adminId],
  );

  // Lead sheets, assigned to a few accounts.
  const sheets = {};
  for (const [i, [code, name]] of [['A', 'Cash'], ['B', 'Receivables'], ['J', 'Equity'], ['K', 'Revenue']].entries()) {
    sheets[code] = (await one(`INSERT INTO lead_sheets (client_id, code, name, sort_order, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [fx.clientId, code, name, i * 10, fx.adminId])).id;
  }
  for (const [n, code] of [['1000', 'A'], ['1010', 'A'], ['1100', 'B'], ['4000', 'K']]) {
    await sql(`UPDATE chart_of_accounts SET lead_sheet_id = $1, lead_sheet_source = 'manual' WHERE id = $2`, [sheets[code], await acct(n)]);
  }
  fx.sheets = sheets;

  // Tickmark library and marks in both periods (issue #18).
  const tm = {};
  for (const [i, [symbol, description, color]] of [['✓', 'Agreed to bank statement', 'green'], ['A', 'Agreed to prior year', 'blue'], ['†', 'Recalculated', 'purple']].entries()) {
    tm[symbol] = (await one(`INSERT INTO tickmark_library (client_id, symbol, description, color, sort_order, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [fx.clientId, symbol, description, color, i, fx.adminId])).id;
  }
  for (const [period, n, symbol] of [[fx.p24, '1000', '✓'], [fx.p24, '1100', 'A'], [fx.p25, '1000', '✓'], [fx.p25, '1000', '†'], [fx.p25, '4000', 'A']]) {
    await sql(`INSERT INTO tb_tickmarks (period_id, account_id, tickmark_id, created_by) VALUES ($1,$2,$3,$4)`, [period, await acct(n), tm[symbol], fx.adminId]);
  }

  // A book and a tax AJE in FY 2025.
  for (const [num, type, desc, dr, cr, amt] of [[1, 'book', 'Accrue December rent', '6100', '2100', 450000], [2, 'tax', 'Meals 50% limitation', '6800', '6800', 0]]) {
    const je = await one(
      `INSERT INTO journal_entries (period_id, entry_number, entry_type, entry_date, description, created_by, workpaper_ref) VALUES ($1,$2,$3,'2025-12-31',$4,$5,$6) RETURNING id`,
      [fx.p25, num, type, desc, fx.adminId, `W-${num}`],
    );
    const d = await acct(dr).catch(() => null);
    const k = await acct(cr).catch(() => null);
    if (d && k && amt) {
      await sql(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,0), ($1,$4,0,$3)`, [je.id, d, amt, k]);
    } else {
      const a1 = await acct('1000');
      const a2 = await acct('4000');
      await sql(`INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES ($1,$2,12500,0), ($1,$3,0,12500)`, [je.id, a1, a2]);
    }
  }

  // Variance notes on FY 2025 against FY 2024.
  for (const [n, note] of [['4000', 'Two new retainer clients'], ['1000', 'Timing of the December deposit']]) {
    await sql(`INSERT INTO variance_notes (account_id, period_id, compare_period_id, note, created_by) VALUES ($1,$2,$3,$4,$5)`, [await acct(n), fx.p25, fx.p24, note, fx.adminId]);
  }

  // Engagement, M-1 and PY tie-out data.
  for (const [period, title, status] of [[fx.p25, 'Confirm bank balances', 'completed'], [fx.p25, 'Review fixed asset additions', 'open'], [fx.p24, 'Prior year letter', 'completed']]) {
    await sql(`INSERT INTO engagement_tasks (period_id, title, status, assignee_id, created_by, completed_by) VALUES ($1,$2,$3,$4,$4,$5)`, [period, title, status, fx.adminId, status === 'completed' ? fx.adminId : null]);
  }
  for (const [i, [desc, book, tax]] of [['Meals limitation', 120000, 60000], ['Depreciation difference', 500000, 725000]].entries()) {
    await sql(`INSERT INTO m1_adjustments (period_id, description, category, book_amount, tax_amount, sort_order, created_by) VALUES ($1,$2,'other',$3,$4,$5,$6)`, [fx.p25, desc, book, tax, i, fx.adminId]);
  }
  for (const n of ['1000', '1100', '4000']) {
    await sql(`INSERT INTO py_comparison_data (period_id, account_id, py_debit, py_credit, source, source_filename, uploaded_by) VALUES ($1,$2,100,0,'manual',NULL,$3)`, [fx.p25, await acct(n), fx.adminId]);
  }

  // FY 2025 bank activity, a finished reconciliation clearing two of its
  // transactions plus an outstanding FY 2024 check, and an undated reconciliation.
  const bank = await acct('1000');
  const tx = [];
  for (const [date, desc, amt] of [['2025-01-05', 'Deposit - Retainer', 1500000], ['2025-01-09', 'Check 1201 - Rent', -450000], ['2025-01-20', 'Card - Software', -9900]]) {
    tx.push((await one(
      `INSERT INTO bank_transactions (client_id, period_id, transaction_date, description, amount, account_id, source_account_id, classification_status, classified_by, entry_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,'manual') RETURNING id`,
      [fx.clientId, fx.p25, date, desc, amt, await acct('4000'), bank, fx.adminId],
    )).id);
  }
  const old24 = (await one(`SELECT id FROM bank_transactions WHERE client_id = $1 AND period_id = $2 ORDER BY id LIMIT 1`, [fx.clientId, fx.p24])).id;
  const recon = await one(
    `INSERT INTO bank_reconciliations (client_id, source_account_id, period_id, statement_date, statement_ending_balance, beginning_book_balance, status, created_by, completed_by, completed_at)
     VALUES ($1,$2,$3,'2025-01-31',1040100,0,'completed',$4,$4,'2025-02-03T10:00:00Z') RETURNING id`,
    [fx.clientId, bank, fx.p25, fx.adminId],
  );
  for (const t of [tx[0], tx[1], old24]) await sql(`INSERT INTO reconciliation_items (reconciliation_id, transaction_id, cleared_at) VALUES ($1,$2,'2025-02-03T10:00:00Z')`, [recon.id, t]);
  const undated = await one(
    `INSERT INTO bank_reconciliations (client_id, source_account_id, period_id, statement_date, statement_ending_balance, status, created_by) VALUES ($1,$2,NULL,'2024-06-30',0,'open',$3) RETURNING id`,
    [fx.clientId, bank, fx.adminId],
  );
  await sql(`INSERT INTO reconciliation_items (reconciliation_id, transaction_id, cleared_at) VALUES ($1,$2,'2024-07-01T10:00:00Z')`, [undated.id, old24]);

  // Client-level settings rows.
  await sql(`INSERT INTO classification_rules (client_id, payee_pattern, account_id, times_confirmed) VALUES ($1,'ADOBE%',$2,3)`, [fx.clientId, await acct('4000')]);
  const savedConfig = { sections: [{ title: 'Cash', accountIds: [await acct('1000'), await acct('1010')], showSubtotal: true }], columns: ['book', 'prior-year'] };
  await sql(`INSERT INTO saved_reports (client_id, name, config, created_by) VALUES ($1,'Partner review',$2,$3)`, [fx.clientId, JSON.stringify(savedConfig), fx.adminId]);
  const taxCode = await one(`SELECT id FROM tax_codes ORDER BY id LIMIT 1`);
  await sql(`INSERT INTO export_consolidation_settings (client_id, tax_code_id, tax_software, override_account_number, override_description) VALUES ($1,$2,'ultratax','9999','Other deductions')`, [fx.clientId, taxCode.id]);

  // Lead sheet workpapers in FY 2025: a note, a sign-off and an attachment.
  await sql(`INSERT INTO lead_sheet_notes (client_id, period_id, lead_sheet_id, account_id, body, author_id, author_name) VALUES ($1,$2,$3,$4,'Tie to bank confirmation',$5,'Administrator')`, [fx.clientId, fx.p25, sheets.A, await acct('1000'), fx.adminId]);
  await sql(`INSERT INTO lead_sheet_signoffs (period_id, lead_sheet_id, role, user_id, user_name, balance_stamp) VALUES ($1,$2,'preparer',$3,'Administrator','stamp-a')`, [fx.p25, sheets.A, fx.adminId]);
  const doc = await one(
    `INSERT INTO client_documents (client_id, filename, file_size, file_type, uploaded_by, storage_backend, object_key, bucket, sha256, period_id, section)
     VALUES ($1,'bank-confirmation.pdf',1234,'application/pdf',$2,'local','summit/2025/bank-confirmation.pdf','local','abc123',$3,'workpapers') RETURNING id`,
    [fx.clientId, fx.adminId, fx.p25],
  );
  await sql(
    `INSERT INTO lead_sheet_attachments (client_id, period_id, lead_sheet_id, lead_sheet_code, account_id, ref_code, document_id, source_file_name, created_by)
     VALUES ($1,$2,$3,'A',$4,'A-1',$5,'bank-confirmation.pdf',$6)`,
    [fx.clientId, fx.p25, sheets.A, await acct('1000'), doc.id, fx.adminId],
  );
}

// ─────────────────────────────────────────────────────────────── comparison

/**
 * Client-scoped tables that are not compared, and why. Anything else that
 * reaches `clients` through foreign keys is compared.
 */
const NOT_COMPARED = {
  audit_log: 'append-only history of this instance; never in an archive',
  ai_usage_log: 'billing history of this instance',
  backup_history: 'this instance\'s own backup records',
  restore_history: 'this instance\'s own restore records',
  qbo_oauth_states: 'short-lived sign-in state',
  qbo_connections: 'restored only into the same client, and the live binding wins',
  client_folder_links: 'a copy arrives unlinked by design; storage paths are unique',
  coa_templates: 'firm library; only remembers which client it was made from',
  coa_template_accounts: 'firm library',
  coa_template_tax_codes: 'firm library',
  fs_report_version_files: 'issued PDF bytes: backups carry rows, not bytes',
};

/** Columns that legitimately differ after a restore. */
const IGNORED_COLUMNS = {
  // A finalized version's stamp hashes ids; lib/fs/fsBackup.ts keeps it as-is on purpose.
  fs_report_versions: ['source_stamp'],
};
/** Extra columns that differ only when the restore makes a NEW client. */
const IGNORED_AS_NEW = {
  clients: ['name'], // " (Restored)" on a name clash
  client_documents: ['object_key', 'bucket', 'file_path', 'etag'], // a copy must not share the original's file
};

/** Id columns with no foreign key in the schema. */
const IMPLICIT_FKS = { 'fs_reports.current_version_id': 'fs_report_versions' };

let schema; // { scoped: string[], fks: Map<table, Array<{col, parent}>> }

async function loadSchema() {
  const fkRows = await sql(`
    SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent, a.attname AS col
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`);
  const fks = new Map();
  for (const r of fkRows) {
    if (!fks.has(r.child)) fks.set(r.child, []);
    fks.get(r.child).push({ col: r.col, parent: r.parent });
  }
  for (const [key, parent] of Object.entries(IMPLICIT_FKS)) {
    const [child, col] = key.split('.');
    if (!fks.has(child)) fks.set(child, []);
    fks.get(child).push({ col, parent });
  }
  const scoped = new Set(['clients']);
  for (let grew = true; grew;) {
    grew = false;
    for (const [child, list] of fks) {
      if (!scoped.has(child) && list.some((f) => scoped.has(f.parent))) { scoped.add(child); grew = true; }
    }
  }
  const unknown = [...scoped].filter((t) => !(t in NOT_COMPARED) && !t.startsWith('v_'));
  schema = { scoped: unknown.sort(), fks };
}

/** Every row of every compared table, keyed by table then id. */
async function loadAll() {
  const all = {};
  for (const t of schema.scoped) {
    const rows = await sql(`SELECT * FROM "${t}"`);
    all[t] = new Map(rows.map((r, i) => [r.id ?? `row${i}`, r]));
  }
  return all;
}

const fkCols = (t) => (schema.fks.get(t) ?? []).filter((f) => schema.scoped.includes(f.parent));

/**
 * Rows of `all` belonging to the scope that starts at `seeds` ({table: Set<id>}).
 * A row joins when one of its foreign keys points at a member and every other
 * non-null key into a compared table points at a member too (so a variance
 * note on another period that merely COMPARES to this one does not join).
 */
function scopeOf(all, seeds, base = {}) {
  const member = Object.fromEntries(schema.scoped.map((t) => [t, new Set(seeds[t] ?? [])]));
  // `base` rows satisfy the "every key" rule but do not pull a row in.
  const inBase = (t, id) => base[t]?.has(id) ?? false;
  for (let grew = true; grew;) {
    grew = false;
    for (const t of schema.scoped) {
      const cols = fkCols(t);
      if (!cols.length) continue;
      for (const [id, row] of all[t]) {
        if (member[t].has(id)) continue;
        const refs = cols.filter((f) => row[f.col] !== null && row[f.col] !== undefined);
        if (!refs.length || !refs.some((f) => member[f.parent].has(row[f.col]))) continue;
        if (!refs.every((f) => member[f.parent].has(row[f.col]) || inBase(f.parent, row[f.col]))) continue;
        member[t].add(id);
        grew = true;
      }
    }
  }
  return member;
}

function normalizeScalar(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  return v;
}

/**
 * Natural form of a row: ids dropped, each foreign key replaced by the
 * natural form of the row it points at (its own scalar columns only), and ids
 * inside Statement Writer JSON replaced the same way.
 */
function makeCanon(all, { asNew, ignore = {}, member }) {
  const keyCache = new Map();
  const ignored = (t) => new Set([...(IGNORED_COLUMNS[t] ?? []), ...(asNew ? IGNORED_AS_NEW[t] ?? [] : []), ...(ignore[t] ?? [])]);
  const targetKey = (parent, id) => {
    if (id === null || id === undefined) return null;
    if (parent === 'clients') return '<client>';
    // A copy's natural key equals the original's, so a reference left pointing
    // at the SOURCE client's row would compare equal. Only rows inside this
    // snapshot count.
    if (member[parent] && !member[parent].has(id)) return `<outside ${parent}>`;
    const ck = `${parent}:${id}`;
    if (keyCache.has(ck)) return keyCache.get(ck);
    const row = all[parent]?.get(id);
    let key;
    if (!row) key = `<missing ${parent}>`;
    else {
      const fkSet = new Set((schema.fks.get(parent) ?? []).map((f) => f.col));
      const ign = ignored(parent);
      const out = {};
      for (const k of Object.keys(row).sort()) {
        if (k === 'id' || fkSet.has(k) || ign.has(k)) continue;
        out[k] = normalizeJson(row[k]);
      }
      key = `${parent}${JSON.stringify(out)}`;
    }
    keyCache.set(ck, key);
    return key;
  };
  function normalizeJson(v) {
    v = normalizeScalar(v);
    if (Array.isArray(v)) return v.map(normalizeJson);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) {
        if (k === 'groupingId' && v[k] != null) out[k] = targetKey('lead_sheets', Number(v[k]));
        else if (k === 'accountId' && v[k] != null) out[k] = targetKey('chart_of_accounts', Number(v[k]));
        else if (k === 'accountIds' && Array.isArray(v[k])) out[k] = v[k].map((id) => targetKey('chart_of_accounts', Number(id)));
        else out[k] = normalizeJson(v[k]);
      }
      return out;
    }
    return v;
  }
  return (t, row) => {
    const fkMap = new Map(fkCols(t).map((f) => [f.col, f.parent]));
    const userFks = new Set((schema.fks.get(t) ?? []).filter((f) => !schema.scoped.includes(f.parent)).map((f) => f.col));
    const ign = ignored(t);
    const out = {};
    for (const k of Object.keys(row).sort()) {
      if (k === 'id' || ign.has(k)) continue;
      if (fkMap.has(k)) out[k] = targetKey(fkMap.get(k), row[k]);
      else if (userFks.has(k)) out[k] = row[k]; // app_users, tax_codes, … are shared
      else out[k] = normalizeJson(row[k]);
    }
    return JSON.stringify(out);
  };
}

function rowsOf(all, member, canon, tables) {
  const out = {};
  for (const t of tables) {
    out[t] = [...member[t]].map((id) => canon(t, all[t].get(id))).sort();
  }
  return out;
}

const clip = (x) => (x.length > 600 ? `${x.slice(0, 600)}…` : x);

/** Fails with a per-table account of what went missing and what appeared. */
function assertSameRows(label, expected, actual) {
  const problems = [];
  for (const t of Object.keys(expected)) {
    const want = expected[t];
    const got = actual[t] ?? [];
    const count = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
    const w = count(want);
    const g = count(got);
    const missing = [];
    const extra = [];
    for (const [k, n] of w) for (let i = 0; i < n - (g.get(k) ?? 0); i++) missing.push(k);
    for (const [k, n] of g) for (let i = 0; i < n - (w.get(k) ?? 0); i++) extra.push(k);
    if (missing.length || extra.length) {
      problems.push(`  ${t}: ${want.length} expected, ${got.length} restored`
        + (missing.length ? `\n    missing: ${missing.slice(0, 2).map(clip).join('\n             ')}` : '')
        + (extra.length ? `\n    extra:   ${extra.slice(0, 2).map(clip).join('\n             ')}` : ''));
    }
  }
  assert.ok(problems.length === 0, `${label}: rows differ\n${problems.join('\n')}`);
}

async function adjustedTotals(clientId) {
  const rows = await sql(`
    SELECT p.period_name,
           sum(v.unadjusted_debit)::text AS ud, sum(v.unadjusted_credit)::text AS uc,
           sum(v.book_adjusted_debit)::text AS bd, sum(v.book_adjusted_credit)::text AS bc,
           sum(v.tax_adjusted_debit)::text AS td, sum(v.tax_adjusted_credit)::text AS tc,
           sum(v.prior_year_debit)::text AS pd, sum(v.prior_year_credit)::text AS pc
      FROM v_adjusted_trial_balance v JOIN periods p ON p.id = v.period_id
     WHERE p.client_id = $1 GROUP BY p.period_name ORDER BY p.period_name`, [clientId]);
  return Object.fromEntries(rows.map(({ period_name: n, ...rest }) => [n, rest]));
}

/** Natural form of one client (or one period of it) as it stands now. */
async function snapshot(clientId, { periodId = null, asNew = false, ignore = {} } = {}) {
  const all = await loadAll();
  let member = scopeOf(all, { clients: [clientId] });
  if (periodId) {
    // A period archive carries the client and its client-level rows too.
    const whole = member;
    const base = Object.fromEntries([...PERIOD_CLIENT_LEVEL, 'fs_client_layouts'].map((t) => [t, whole[t]]));
    member = scopeOf(all, { periods: [periodId] }, base);
    for (const t of PERIOD_CLIENT_LEVEL) member[t] = whole[t];
    // …and the layouts its statement sets use.
    member.fs_client_layouts = new Set([...member.fs_reports].map((id) => all.fs_reports.get(id).client_layout_id));
  }
  return { all, member, rows: rowsOf(all, member, makeCanon(all, { asNew, ignore, member }), schema.scoped) };
}

/** Client-level tables a period archive carries in full. */
const PERIOD_CLIENT_LEVEL = ['clients', 'chart_of_accounts', 'lead_sheets', 'tickmark_library', 'fs_cash_flow_overrides', 'fs_equity_roles'];
/** Client-level tables a period archive does not carry, by design. */
const PERIOD_NOT_CARRIED = ['classification_rules', 'saved_reports', 'export_consolidation_settings'];

// ─────────────────────────────────────────────────────────────── scenarios

async function main() {
  await createScratchDb();
  const env = childEnv({ ...secrets, NODE_ENV: 'development', DATABASE_URL: dbUrl });
  const mig = await run(process.execPath, [...TSX_IMPORT, 'src/migrate.ts'], { cwd: SERVER, env, prefix: '[migrate]' });
  assert.equal(mig.code, 0, `migrations failed: ${mig.stderr}`);
  for (const s of ['001_default_admin.js', '004_comprehensive_demo.js']) {
    const seed = await run(process.execPath, [KNEX_CLI, 'seed:run', '--knexfile', 'knexfile.js', '--specific', s], { cwd: SERVER, env, prefix: '[seed]' });
    assert.equal(seed.code, 0, `seed ${s} failed: ${seed.stderr}`);
  }
  dbc = new Client({ connectionString: dbUrl });
  await dbc.connect();
  await enrichFixture();
  await loadSchema();
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

  await step('a Statement Writer set on FY 2025, computed', async () => {
    const r = await api(`/api/v1/periods/${fx.p25}/fs/reports`, {
      method: 'POST', token,
      json: { name: 'Financial Statements 2025', settings: { framework: 'gaap', columns: { mode: 'cy_py', pctOfRevenue: false, varianceAmt: false, variancePct: false } }, layoutSource: { kind: 'default' } },
    });
    assert.equal(r.status, 201, r.text);
    const c = await api(`/api/v1/fs/reports/${r.json.data.report.id}/compute`, { method: 'POST', token, json: {} });
    assert.equal(c.status, 200, c.text);
  });

  await step('the fixture has a row in every compared table that a client archive carries', async () => {
    const { rows } = await snapshot(fx.clientId);
    const empty = Object.entries(rows).filter(([, r]) => r.length === 0).map(([t]) => t);
    // Rows that need a finalized version, a QuickBooks link or an import are not made here.
    assert.deepEqual(empty.filter((t) => !['fs_report_versions', 'fs_cash_flow_overrides', 'fs_equity_roles', 'document_imports'].includes(t)), []);
    log(`     compared tables: ${schema.scoped.join(', ')}`);
  });

  const before = await snapshot(fx.clientId);
  const totalsBefore = await adjustedTotals(fx.clientId);

  await step('client backup → restore as a new client: every client table comes back equal apart from ids', async () => {
    const b = await api(`/api/v1/backup/client/${fx.clientId}`, { method: 'POST', token });
    assert.equal(b.status, 200, b.text);
    fx.clientBackupId = b.json.data.id;
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: fx.clientBackupId, mode: 'as_new' } });
    assert.equal(r.status, 200, r.text);
    const newId = r.json.data.newClientId;
    assert.ok(newId && newId !== fx.clientId);
    const src = await snapshot(fx.clientId, { asNew: true });
    const got = await snapshot(newId, { asNew: true });
    assertSameRows('restore as new', src.rows, got.rows);
    assert.deepEqual(await adjustedTotals(newId), totalsBefore);
  });

  await step('client backup → replace into the same client: every client table comes back equal apart from ids', async () => {
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: fx.clientBackupId, mode: 'replace', targetClientId: fx.clientId } });
    assert.equal(r.status, 200, r.text);
    const after = await snapshot(fx.clientId);
    assertSameRows('replace', before.rows, after.rows);
    assert.deepEqual(await adjustedTotals(fx.clientId), totalsBefore);
    // Replace re-created the periods; re-point the fixture.
    fx.p25 = (await one(`SELECT id FROM periods WHERE client_id = $1 AND period_name = 'FY 2025'`, [fx.clientId])).id;
  });

  await step('period backup (FY 2025) → restore as a new client: the period and the client-level rows come back equal', async () => {
    const b = await api(`/api/v1/backup/period/${fx.p25}`, { method: 'POST', token });
    assert.equal(b.status, 200, b.text);
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: b.json.data.id, mode: 'as_new' } });
    assert.equal(r.status, 200, r.text);
    const newId = r.json.data.newClientId;
    // By design the prior period is not in a period archive, so the restored
    // period cannot say which period it was rolled forward from.
    const ignore = { periods: ['rolled_forward_from'] };
    const src = await snapshot(fx.clientId, { periodId: fx.p25, asNew: true, ignore });
    const got = await snapshot(newId, { asNew: true, ignore });
    assert.equal((await one(`SELECT rolled_forward_from FROM periods WHERE client_id = $1`, [newId])).rolled_forward_from, null);
    const tables = schema.scoped.filter((t) => !PERIOD_NOT_CARRIED.includes(t));
    const pick = (rows) => Object.fromEntries(tables.map((t) => [t, rows[t]]));
    assertSameRows('period restore as new', pick(src.rows), pick(got.rows));
    for (const t of PERIOD_NOT_CARRIED) assert.equal(got.rows[t].length, 0, `${t} is not part of a period archive`);
    // By design: a variance note comparing to FY 2024 and the reconciliation
    // item for an FY 2024 check have nothing to point at in a period archive.
    assert.equal((await one(`SELECT count(*)::int AS n FROM variance_notes v JOIN periods p ON p.id = v.period_id WHERE p.client_id = $1`, [newId])).n, 0);
    const count = async (q) => (await one(q, [newId])).n;
    assert.equal(await count(`SELECT count(*)::int AS n FROM tickmark_library WHERE client_id = $1`), 3, 'the whole library');
    assert.equal(await count(`SELECT count(*)::int AS n FROM tb_tickmarks t JOIN periods p ON p.id = t.period_id WHERE p.client_id = $1`), 3);
    assert.equal(await count(`SELECT count(*)::int AS n FROM py_comparison_data d JOIN periods p ON p.id = d.period_id WHERE p.client_id = $1`), 3);
    assert.equal(await count(`SELECT count(*)::int AS n FROM bank_reconciliations WHERE client_id = $1`), 1, 'the FY 2025 reconciliation, not the undated one');
    assert.equal(await count(`SELECT count(*)::int AS n FROM reconciliation_items i JOIN bank_reconciliations r ON r.id = i.reconciliation_id WHERE r.client_id = $1`), 2,
      'the FY 2024 check it cleared has no transaction to point at');
    assert.equal(r.json.data.droppedLinks > 0, true, 'the dropped rows are counted');
    const totals = await adjustedTotals(newId);
    assert.deepEqual(totals['FY 2025'], totalsBefore['FY 2025']);
    assert.deepEqual(Object.keys(totals), ['FY 2025']);
  });

  await step('an uploaded client archive passes the manifest check and restores', async () => {
    const dl = await api(`/api/v1/backup/${fx.clientBackupId}/download`, { token });
    assert.equal(dl.status, 200, dl.text);
    const form = new FormData();
    form.append('file', new Blob([dl.buf]), 'client.tbak');
    const up = await api('/api/v1/restore/upload', { method: 'POST', token, form });
    assert.equal(up.status, 200, up.text);
    assert.equal(up.json.data.manifest.formatVersion, 2);
    assert.ok(up.json.data.manifest.schemaVersion, 'the manifest names its schema version');
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { tempFile: up.json.data.tempFile, uploadNonce: up.json.data.uploadNonce, mode: 'as_new' } });
    assert.equal(r.status, 200, r.text);
    const newId = r.json.data.newClientId;
    assert.deepEqual(await adjustedTotals(newId), totalsBefore);
    // An uploaded file is not trusted: who did what is dropped, not misassigned.
    const users = await sql(`
      SELECT (SELECT count(*) FROM tickmark_library WHERE client_id = $1 AND created_by IS NOT NULL)
           + (SELECT count(*) FROM engagement_tasks t JOIN periods p ON p.id = t.period_id WHERE p.client_id = $1 AND (assignee_id IS NOT NULL OR created_by IS NOT NULL OR completed_by IS NOT NULL))
           + (SELECT count(*) FROM bank_reconciliations WHERE client_id = $1 AND (created_by IS NOT NULL OR completed_by IS NOT NULL))
           + (SELECT count(*) FROM py_comparison_data d JOIN periods p ON p.id = d.period_id WHERE p.client_id = $1 AND uploaded_by IS NOT NULL) AS n`, [newId]);
    assert.equal(Number(users[0].n), 0);
    assert.ok((await one(`SELECT count(*)::int AS n FROM tickmark_library WHERE client_id = $1`, [newId])).n === 3);
  });

  log(`\n${passed} steps passed`);
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  if (!(err instanceof assert.AssertionError)) {
    console.error('\n--- last server output ---');
    console.error(lines.slice(-80).join('\n'));
  }
  console.error('\n', err);
} finally {
  if (server) await killTree(server.child);
  await dropScratchDb();
}
process.exit(failed ? 1 : 0);
