#!/usr/bin/env node
// Statement Writer end-to-end check. Boots the real server against a scratch
// Postgres database and walks a statement set through its whole life:
// library seed → create → compute → edit layout → Word/Excel → finalize →
// the trial balance moves (stale + impact) → reopen → v2 → templates →
// roll forward → backup and restore-as-new → delete the period.
//
//   npm run test:fs-e2e            (from the repo root)
//
// Prerequisites: a Postgres the dev credentials can CREATE DATABASE on
// (docker compose up -d gives one), server/node_modules installed.
//   E2E_PG_ADMIN_URL   admin connection (default: the compose dev instance)
//   E2E_KEEP_DB=1      leave the scratch database behind for inspection
//   E2E_VERBOSE=1      stream the server's output instead of buffering it
//
// The PDF steps need a Chromium on this machine. Without one they assert the
// documented degradation instead (503 PDF_ENGINE_UNAVAILABLE, nothing
// written) and the script still passes — that path is as much a contract as
// the PDF itself, because a server without Chromium must keep working.
//
// Same harness shape as test/sso-e2e.mjs: a whitelisted child environment
// (nothing from the developer's shell or server/.env leaks in), a port this
// script picks, and one server process with no wrapper to orphan.

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
const STAFF_PASSWORD = 'E2eStaff!2026';

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
    'ProgramFiles', 'ProgramFiles(x86)', 'PUPPETEER_EXECUTABLE_PATH'];
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
  const stale = await admin.query(`SELECT datname FROM pg_database WHERE datname LIKE 'vibe_tb_fs_e2e_%'`);
  for (const r of stale.rows) await admin.query(`DROP DATABASE "${r.datname}" WITH (FORCE)`);
  dbName = `vibe_tb_fs_e2e_${Date.now().toString(36)}`;
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

const LEAD_SHEETS = ['Cash', 'Accounts Receivable', 'Inventory', 'Fixed Assets', 'Other Assets', 'Accounts Payable', 'Accrued Liabilities',
  'Debt', 'Other Liabilities', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Operating Expenses', 'Other Income', 'Other Expenses'];

// [number, name, category, normal_balance, lead sheet letter, FY2025 (signed cents, + = debit), prior year]
const ACCOUNTS = [
  ['1000', 'Checking', 'assets', 'debit', 'A', 1310081, 1000040],
  ['1100', 'Accounts Receivable', 'assets', 'debit', 'B', 620010, 500030],
  ['1500', 'Equipment', 'assets', 'debit', 'D', 2500000, 2000000],
  // A contra asset whose normal_balance flag says credit: signing must follow the category.
  ['1510', 'Accumulated Depreciation', 'assets', 'credit', 'D', -600000, -400000],
  ['2000', 'Accounts Payable', 'liabilities', 'credit', 'F', -250033, -300025],
  ['2500', 'Bank Loan', 'liabilities', 'credit', 'H', -800000, -1000000],
  ['3000', 'Common Stock', 'equity', 'credit', 'J', -100000, -100000],
  ['3100', 'Retained Earnings', 'equity', 'credit', 'J', -1700045, -900000],
  ['3200', 'Shareholder Distributions', 'equity', 'debit', 'J', 300000, 0],
  ['4000', 'Sales', 'revenue', 'credit', 'K', -5000049, -3000045],
  ['5000', 'Cost of Goods Sold', 'expenses', 'debit', 'L', 2000011, 1000000],
  ['6000', 'Rent', 'expenses', 'debit', 'M', 1200000, 1200000],
  ['6100', 'Depreciation Expense', 'expenses', 'debit', 'M', 200000, 0],
  ['6200', 'Office Supplies', 'expenses', 'debit', 'M', 330025, 0],
  ['7000', 'Interest Income', 'revenue', 'credit', 'N', -10000, 0],
  ['6900', 'Never Used', 'expenses', 'debit', 'M', 0, 0],
];

const fx = {};

async function seedFixtures() {
  const [client] = await sql(`INSERT INTO clients (name, entity_type, tax_year_end, is_active) VALUES ('Acme Widgets, Inc.', '1120S', '1231', true) RETURNING id`);
  fx.clientId = client.id;
  const [p25] = await sql(`INSERT INTO periods (client_id, period_name, start_date, end_date, is_current) VALUES ($1, 'FY2025', '2025-01-01', '2025-12-31', true) RETURNING id`, [fx.clientId]);
  const [p26] = await sql(`INSERT INTO periods (client_id, period_name, start_date, end_date) VALUES ($1, 'FY2026', '2026-01-01', '2026-12-31') RETURNING id`, [fx.clientId]);
  const [undated] = await sql(`INSERT INTO periods (client_id, period_name) VALUES ($1, 'No dates') RETURNING id`, [fx.clientId]);
  Object.assign(fx, { p25: p25.id, p26: p26.id, undated: undated.id });
  const sheetId = {};
  for (const [i, name] of LEAD_SHEETS.entries()) {
    const code = String.fromCharCode(65 + i);
    const [r] = await sql(`INSERT INTO lead_sheets (client_id, code, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`, [fx.clientId, code, name, (i + 1) * 10]);
    sheetId[code] = r.id;
  }
  fx.sheetId = sheetId;
  fx.accountId = {};
  for (const [number, name, category, normal, sheet, cy, py] of ACCOUNTS) {
    const [a] = await sql(
      `INSERT INTO chart_of_accounts (client_id, account_number, account_name, category, normal_balance, lead_sheet_id, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [fx.clientId, number, name, category, normal, sheetId[sheet]],
    );
    fx.accountId[number] = a.id;
    const split = (v) => (v >= 0 ? [v, 0] : [0, -v]);
    await sql(
      `INSERT INTO trial_balance (period_id, account_id, unadjusted_debit, unadjusted_credit, prior_year_debit, prior_year_credit) VALUES ($1,$2,$3,$4,$5,$6)`,
      [fx.p25, a.id, ...split(cy), ...split(py)],
    );
  }
}

const rowBy = (st, caption) => {
  const r = st.rows.find((x) => x.caption === caption);
  assert.ok(r, `row "${caption}" not in ${st.kind}: ${st.rows.map((x) => x.caption).join(' | ')}`);
  return r;
};
const stmt = (model, kind) => model.statements.find((s) => s.kind === kind);

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
  let staffToken;
  let reviewerToken;
  let reportId;
  let layoutId;
  let pdfEngine = false;

  await step('sign in, rotate the bootstrap password, create a preparer and a reviewer', async () => {
    let login = await api('/api/v1/auth/login', { method: 'POST', json: { username: 'admin', password: 'admin1234' } });
    assert.equal(login.status, 200, login.text);
    const rot = await api('/api/v1/auth/change-password', { method: 'POST', token: login.json.data.token, json: { currentPassword: 'admin1234', newPassword: ADMIN_PASSWORD } });
    assert.equal(rot.status, 200, rot.text);
    login = await api('/api/v1/auth/login', { method: 'POST', json: { username: 'admin', password: ADMIN_PASSWORD } });
    token = login.json.data.token;
    for (const [username, role] of [['pat', 'preparer'], ['rev', 'reviewer']]) {
      const c = await api('/api/v1/users', { method: 'POST', token, json: { username, displayName: username, email: `${username}@example.com`, password: STAFF_PASSWORD, role } });
      assert.equal(c.status, 201, c.text);
      // A new account must rotate its password before anything else; skip that for the test users.
      await sql(`UPDATE app_users SET must_change_password = false WHERE username = $1`, [username]);
      const l = await api('/api/v1/auth/login', { method: 'POST', json: { username, password: STAFF_PASSWORD } });
      assert.equal(l.status, 200, l.text);
      if (role === 'preparer') staffToken = l.json.data.token; else reviewerToken = l.json.data.token;
    }
  });

  await step('the firm library seeds itself once: two letters, two styles, a letterhead', async () => {
    const a = await api('/api/v1/fs/library', { token: staffToken });
    assert.equal(a.status, 200, a.text);
    assert.deepEqual(a.json.data.letters.map((l) => l.letterType), ['compilation', 'preparation']);
    assert.equal(a.json.data.letters.filter((l) => l.isDefault).length, 1);
    assert.deepEqual(a.json.data.presets.map((p) => p.name), ['Classic Serif', 'Modern Sans']);
    assert.equal(a.json.data.templates.length, 0);
    await api('/api/v1/fs/library', { token: staffToken });
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_letters'))[0].n, 2);
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_firm_profile'))[0].n, 1);
  });

  await step('library writes are admin-only; the letterhead saves', async () => {
    const body = { displayName: 'Kisaes CPA', city: 'Springfield', state: 'IL', accountantSignature: 'Kisaes CPA LLC' };
    assert.equal((await api('/api/v1/fs/library/letterhead', { method: 'PUT', token: staffToken, json: body })).status, 403);
    const ok = await api('/api/v1/fs/library/letterhead', { method: 'PUT', token, json: body });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.json.data.letterhead.displayName, 'Kisaes CPA');
    const bad = await api('/api/v1/fs/library/letterhead', { method: 'PUT', token, json: { logoDataUri: 'data:image/gif;base64,AAAA' } });
    assert.equal(bad.status, 400);
  });

  await step('preview fonts are public, extensionless and allowlisted', async () => {
    const f = await api('/api/v1/fs-fonts/LiberationSerif-Regular');
    assert.equal(f.status, 200);
    assert.equal(f.headers.get('content-type'), 'font/ttf');
    assert.ok(f.buf.length > 50_000);
    assert.equal((await api('/api/v1/fs-fonts/..%2F..%2Fpackage')).status, 404);
    assert.equal((await api('/api/v1/fs-fonts/Nope')).status, 404);
  });

  await step('a period without dates cannot carry statements', async () => {
    const r = await api(`/api/v1/periods/${fx.undated}/fs/reports`, {
      method: 'POST', token: staffToken,
      json: { name: 'X', settings: { framework: 'gaap', columns: { mode: 'single', pctOfRevenue: false, varianceAmt: false, variancePct: false } }, layoutSource: { kind: 'default' } },
    });
    assert.equal(r.status, 422, r.text);
    assert.equal(r.json.error.code, 'PERIOD_DATES_REQUIRED');
  });

  await step('the default layout binds to the client\'s lead sheets with nothing unresolved', async () => {
    const b = await api(`/api/v1/clients/${fx.clientId}/fs/bind-preview`, { token: reviewerToken });
    assert.equal(b.status, 200, b.text);
    assert.deepEqual(b.json.data.unresolved, []);
    assert.equal(b.json.data.groupings.length, 15);
  });

  await step('create a statement set from the default layout', async () => {
    const r = await api(`/api/v1/periods/${fx.p25}/fs/reports`, {
      method: 'POST', token: staffToken,
      json: { name: 'Financial Statements 2025', settings: { framework: 'gaap', columns: { mode: 'cy_py', pctOfRevenue: false, varianceAmt: false, variancePct: false } }, layoutSource: { kind: 'default' } },
    });
    assert.equal(r.status, 201, r.text);
    reportId = r.json.data.report.id;
    const d = await api(`/api/v1/fs/reports/${reportId}`, { token: staffToken });
    assert.equal(d.status, 200, d.text);
    layoutId = d.json.data.layout.id;
    assert.equal(d.json.data.report.status, 'draft');
    assert.equal(d.json.data.period.end, '2025-12-31');
    assert.equal(d.json.data.defaultEntityKind, 'corporation');
    // The default accountant's report was attached.
    assert.ok(d.json.data.report.frontMatter.letter.letterId > 0);
    // Lead sheet refs were bound to THIS client's ids.
    assert.ok(JSON.stringify(d.json.data.layout.layout).includes(`"groupingId":"${fx.sheetId.A}"`));
  });

  await step('compute: balanced, net income ties to the trial balance, the dormant account is absent', async () => {
    const c = await api(`/api/v1/fs/reports/${reportId}/compute`, { method: 'POST', token: staffToken, json: {} });
    assert.equal(c.status, 200, c.text);
    const model = c.json.data.model;
    assert.deepEqual(model.checks.filter((x) => x.severity === 'error'), []);
    const bs = stmt(model, 'balance_sheet');
    assert.equal(bs.title, 'Balance Sheets');
    assert.equal(rowBy(bs, 'TOTAL ASSETS').values[0], 38301);
    assert.equal(rowBy(bs, "TOTAL LIABILITIES AND STOCKHOLDERS' EQUITY").values[0], 38301);
    // Accumulated depreciation is a credit-normal ASSET: it nets inside its category.
    assert.equal(rowBy(bs, 'Property and equipment, net').values[0], 19000);
    assert.equal(rowBy(stmt(model, 'income_statement'), 'NET INCOME').values[0], 12800);
    assert.ok(!JSON.stringify(model).includes('Never Used'));
    // No period before FY2025's prior year: equity and cash flows show this year only.
    assert.equal(stmt(model, 'cash_flows').columns.length, 1);
    assert.ok(model.checks.find((x) => x.code === 'TB_FS_PY_OPENING_UNAVAILABLE'));
    assert.equal(rowBy(stmt(model, 'cash_flows'), 'CASH, END OF YEAR').values[0], 13101);
  });

  await step('preview data: the source the browser computes from, and the resolved letter', async () => {
    const p = await api(`/api/v1/fs/reports/${reportId}/preview-data`, { token: reviewerToken });
    assert.equal(p.status, 200, p.text);
    const { source, letter, letterhead } = p.json.data;
    assert.deepEqual(Object.keys(source.snapshots).sort(), ['2024-12-31', '2025-12-31']);
    assert.equal(source.snapshots['2025-12-31'].balances[String(fx.accountId['1000'])], 1310081);
    assert.equal(source.reAccountId, String(fx.accountId['3100']));
    assert.equal(letterhead.displayName, 'Kisaes CPA');
    assert.ok(letter.bodyHtml.includes('Acme Widgets, Inc.'));
    assert.ok(letter.bodyHtml.includes('December 31, 2025'));
    assert.ok(letter.bodyHtml.includes('Springfield, IL'));
    assert.ok(!letter.bodyHtml.includes('{{'), `unresolved variable in: ${letter.bodyHtml}`);
  });

  await step('a reviewer can read but not write', async () => {
    assert.equal((await api(`/api/v1/clients/${fx.clientId}/fs/reports`, { token: reviewerToken })).status, 200);
    assert.equal((await api(`/api/v1/fs/reports/${reportId}/compute`, { method: 'POST', token: reviewerToken, json: {} })).status, 403);
  });

  await step('layout save: optimistic concurrency, and foreign ids are refused', async () => {
    const d = await api(`/api/v1/fs/reports/${reportId}`, { token: staffToken });
    const { layout, style, updatedAt } = d.json.data.layout;
    const style2 = { ...style, number: { ...style.number, decimals: 2 } };
    const ok = await api(`/api/v1/fs/layouts/${layoutId}`, { method: 'PATCH', token: staffToken, json: { style: style2, expectedUpdatedAt: updatedAt } });
    assert.equal(ok.status, 200, ok.text);
    const stale = await api(`/api/v1/fs/layouts/${layoutId}`, { method: 'PATCH', token: staffToken, json: { style, expectedUpdatedAt: updatedAt } });
    assert.equal(stale.status, 409, stale.text);
    assert.equal(stale.json.error.code, 'FS_CONFLICT');
    // An account id that is not this client's.
    const [other] = await sql(`INSERT INTO clients (name, entity_type, is_active) VALUES ('Other Co', '1065', true) RETURNING id`);
    const [foreign] = await sql(`INSERT INTO chart_of_accounts (client_id, account_number, account_name, category, normal_balance) VALUES ($1, '1000', 'Theirs', 'assets', 'debit') RETURNING id`, [other.id]);
    const hacked = structuredClone(layout);
    hacked.statements[0].body.push({ type: 'account', id: 'x', refs: [{ accountId: String(foreign.id) }], caption: 'Theirs' });
    const bad = await api(`/api/v1/fs/layouts/${layoutId}`, { method: 'PATCH', token: staffToken, json: { layout: hacked } });
    assert.equal(bad.status, 400, bad.text);
    // Back to whole dollars for the rest of the run.
    const back = await api(`/api/v1/fs/layouts/${layoutId}`, { method: 'PATCH', token: staffToken, json: { style } });
    assert.equal(back.status, 200, back.text);
  });

  await step('cash-flow classification and equity roles', async () => {
    const g = await api(`/api/v1/clients/${fx.clientId}/fs/cash-flow-overrides`, { token: staffToken });
    assert.equal(g.status, 200, g.text);
    const loan = g.json.data.accounts.find((a) => a.number === '2500');
    assert.equal(loan.fallback, 'financing');
    assert.equal(g.json.data.accounts.find((a) => a.number === '1510').fallback, 'noncash_adjustment');
    assert.ok(!g.json.data.accounts.find((a) => a.number === '4000'), 'only balance sheet accounts are classified');
    const put = await api(`/api/v1/clients/${fx.clientId}/fs/cash-flow-overrides`, {
      method: 'PUT', token: staffToken, json: { overrides: [{ accountId: String(fx.accountId['2500']), classification: 'operating' }] },
    });
    assert.equal(put.status, 200, put.text);
    let c = await api(`/api/v1/fs/reports/${reportId}/compute`, { method: 'POST', token: staffToken, json: {} });
    assert.ok(stmt(c.json.data.model, 'cash_flows').rows.some((r) => r.caption === 'Increase (decrease) in bank loan' || r.caption === 'Increase (decrease) in debt'));
    await api(`/api/v1/clients/${fx.clientId}/fs/cash-flow-overrides`, {
      method: 'PUT', token: staffToken, json: { overrides: [{ accountId: String(fx.accountId['2500']), classification: null }] },
    });
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_cash_flow_overrides'))[0].n, 0);

    const roles = await api(`/api/v1/clients/${fx.clientId}/fs/equity-roles`, { token: staffToken });
    assert.equal(roles.json.data.accounts.find((a) => a.number === '3200').defaultRole, 'distributions');
    const set = await api(`/api/v1/clients/${fx.clientId}/fs/equity-roles`, {
      method: 'PUT', token: staffToken, json: { roles: [{ accountId: String(fx.accountId['3100']), role: 'retained', isFold: true }] },
    });
    assert.equal(set.status, 200, set.text);
    const notEquity = await api(`/api/v1/clients/${fx.clientId}/fs/equity-roles`, {
      method: 'PUT', token: staffToken, json: { roles: [{ accountId: String(fx.accountId['1000']), role: 'retained' }] },
    });
    assert.equal(notEquity.status, 400);
    c = await api(`/api/v1/fs/reports/${reportId}/compute`, { method: 'POST', token: staffToken, json: {} });
    assert.deepEqual(c.json.data.model.checks.filter((x) => x.severity === 'error'), []);
  });

  await step('Excel and Word exports, named for the engagement', async () => {
    const x = await api(`/api/v1/fs/reports/${reportId}/export?format=xlsx`, { token: reviewerToken });
    assert.equal(x.status, 200, x.text);
    assert.equal(x.buf.subarray(0, 2).toString('latin1'), 'PK');
    assert.match(x.headers.get('content-disposition'), /FY2025_Acme Widgets, Inc_financial-statements-draft\.xlsx/);
    const w = await api(`/api/v1/fs/reports/${reportId}/export?format=docx`, { token: staffToken });
    assert.equal(w.status, 200, w.text);
    assert.equal(w.buf.subarray(0, 2).toString('latin1'), 'PK');
    assert.ok((await sql(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'fs_report' AND action = 'export'`))[0].n >= 2);
  });

  await step('PDF engine status', async () => {
    const s = await api('/api/v1/fs/status', { token: staffToken });
    assert.equal(s.status, 200, s.text);
    pdfEngine = s.json.data.pdfEngine.available;
    log(`     pdf engine: ${pdfEngine ? `${s.json.data.pdfEngine.path} (${s.json.data.pdfEngine.source})` : 'not installed'}`);
    assert.equal((await api('/api/v1/fs/pdf-engine', { method: 'PUT', token: staffToken, json: { chromiumPath: null } })).status, 403);
  });

  if (!pdfEngine) {
    await step('without Chromium: finalize is refused with a clear error and nothing is written', async () => {
      const f = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(f.status, 503, f.text);
      assert.equal(f.json.error.code, 'PDF_ENGINE_UNAVAILABLE');
      assert.equal((await sql('SELECT count(*)::int AS n FROM fs_report_versions'))[0].n, 0);
      assert.equal((await sql('SELECT status FROM fs_reports WHERE id = $1', [reportId]))[0].status, 'draft');
    });
  } else {
    await step('a configured path that does not exist is reported, not silently replaced', async () => {
      const bad = await api('/api/v1/fs/pdf-engine', { method: 'PUT', token, json: { chromiumPath: '/nope/chromium' } });
      assert.equal(bad.status, 200, bad.text);
      assert.equal(bad.json.data.pdfEngine.available, false);
      const f = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(f.status, 503, f.text);
      assert.equal(f.json.error.code, 'PDF_ENGINE_UNAVAILABLE');
      assert.equal((await sql('SELECT count(*)::int AS n FROM fs_report_versions'))[0].n, 0);
      const ok = await api('/api/v1/fs/pdf-engine', { method: 'PUT', token, json: { chromiumPath: null } });
      assert.equal(ok.json.data.pdfEngine.available, true);
    });

    await step('the exact-PDF proof renders the draft', async () => {
      const p = await api(`/api/v1/fs/reports/${reportId}/preview.pdf`, { token: reviewerToken });
      assert.equal(p.status, 200, p.text);
      assert.equal(p.buf.subarray(0, 5).toString('latin1'), '%PDF-');
    });

    await step('finalize → v1: frozen, PDF stored, edits locked', async () => {
      const f = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(f.status, 200, f.text);
      assert.equal(f.json.data.versionNo, 1);
      assert.ok(f.json.data.pageCount >= 6, `pages: ${f.json.data.pageCount}`);
      assert.equal(f.json.data.periodUnlocked, true);
      const d = await api(`/api/v1/fs/reports/${reportId}`, { token: staffToken });
      assert.equal(d.json.data.report.status, 'final');
      assert.deepEqual(d.json.data.versions.map((v) => [v.versionNo, v.status, v.stale, v.hasFile, v.finalizedByName]), [[1, 'final', false, true, 'pat']]);
      const locked = await api(`/api/v1/fs/reports/${reportId}`, { method: 'PATCH', token: staffToken, json: { name: 'Renamed' } });
      assert.equal(locked.status, 423, locked.text);
      assert.equal((await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} })).status, 423);
      const pdf = await api(`/api/v1/fs/reports/${reportId}/export?format=pdf&version=1`, { token: reviewerToken });
      assert.equal(pdf.status, 200);
      assert.equal(pdf.buf.subarray(0, 5).toString('latin1'), '%PDF-');
      assert.match(pdf.headers.get('content-disposition'), /financial-statements-v1\.pdf/);
      const [v] = await sql('SELECT pdf_sha256, pdf_size FROM fs_report_versions WHERE report_id = $1', [reportId]);
      assert.equal(v.pdf_size, pdf.buf.length);
    });

    await step('the trial balance moves: the version goes stale and the impact check says the numbers changed', async () => {
      const before = await api(`/api/v1/fs/reports/${reportId}/versions/1/impact`, { token: staffToken });
      assert.deepEqual(before.json.data, { stale: false, changed: false });
      // Rename an account inside a one-line lead sheet: stale, but nothing printed changed.
      await sql(`UPDATE chart_of_accounts SET account_name = 'Trade Receivables' WHERE id = $1`, [fx.accountId['1100']]);
      assert.deepEqual((await api(`/api/v1/fs/reports/${reportId}/versions/1/impact`, { token: staffToken })).json.data, { stale: true, changed: false });
      // Move $100 from rent to cash.
      await sql(`UPDATE trial_balance SET unadjusted_debit = unadjusted_debit + 10000 WHERE period_id = $1 AND account_id = $2`, [fx.p25, fx.accountId['1000']]);
      await sql(`UPDATE trial_balance SET unadjusted_debit = unadjusted_debit - 10000 WHERE period_id = $1 AND account_id = $2`, [fx.p25, fx.accountId['6000']]);
      assert.deepEqual((await api(`/api/v1/fs/reports/${reportId}/versions/1/impact`, { token: staffToken })).json.data, { stale: true, changed: true });
      const list = await api(`/api/v1/clients/${fx.clientId}/fs/reports`, { token: staffToken });
      assert.equal(list.json.data.reports.find((r) => r.id === reportId).currentVersion.stale, true);
      // The issued version itself is untouched.
      const v1 = await api(`/api/v1/fs/reports/${reportId}/versions/1`, { token: staffToken });
      assert.equal(rowBy(stmt(v1.json.data.model, 'income_statement'), 'NET INCOME').values[0], 12800);
    });

    await step('reopen → finalize again → v2 supersedes v1', async () => {
      assert.equal((await api(`/api/v1/fs/reports/${reportId}/reopen`, { method: 'POST', token: staffToken })).status, 200);
      const f = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(f.status, 200, f.text);
      assert.equal(f.json.data.versionNo, 2);
      const d = await api(`/api/v1/fs/reports/${reportId}`, { token: staffToken });
      assert.deepEqual(d.json.data.versions.map((v) => [v.versionNo, v.status]), [[2, 'final'], [1, 'superseded']]);
      const v2 = await api(`/api/v1/fs/reports/${reportId}/versions/2`, { token: staffToken });
      assert.equal(rowBy(stmt(v2.json.data.model, 'income_statement'), 'NET INCOME').values[0], 12900);
      assert.equal(v2.json.data.stale, false);
    });

    await step('validation errors block finalize unless overridden with a reason', async () => {
      // An account with a balance and no lead sheet.
      await sql(`UPDATE chart_of_accounts SET lead_sheet_id = NULL WHERE id = $1`, [fx.accountId['6200']]);
      await api(`/api/v1/fs/reports/${reportId}/reopen`, { method: 'POST', token: staffToken });
      const blocked = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(blocked.status, 422, blocked.text);
      assert.ok(blocked.json.error.details.checks.some((c) => c.code === 'TB_FS_UNASSIGNED'));
      assert.equal((await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: { overrideValidation: true, reason: 'no' } })).status, 400);
      const forced = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: { overrideValidation: true, reason: 'Issued at the client\'s request' } });
      assert.equal(forced.status, 200, forced.text);
      assert.equal(forced.json.data.validationOverride, true);
      assert.ok((await sql(`SELECT description FROM audit_log WHERE entity_type = 'fs_report' AND action = 'override'`))[0].description.includes('TB_FS_UNASSIGNED'));
      await sql(`UPDATE chart_of_accounts SET lead_sheet_id = $2 WHERE id = $1`, [fx.accountId['6200'], fx.sheetId.M]);
      // Back to a clean final (v4) for the steps that follow.
      await api(`/api/v1/fs/reports/${reportId}/reopen`, { method: 'POST', token: staffToken });
      const clean = await api(`/api/v1/fs/reports/${reportId}/finalize`, { method: 'POST', token: staffToken, json: {} });
      assert.equal(clean.status, 200, clean.text);
      assert.equal(clean.json.data.versionNo, 4);
      assert.equal(clean.json.data.validationOverride, false);
    });

    await step('an issued PDF that was lost is rendered again from the frozen snapshot and flagged', async () => {
      const [v] = await sql('SELECT id FROM fs_report_versions WHERE report_id = $1 AND version_no = 2', [reportId]);
      await sql('DELETE FROM fs_report_version_files WHERE version_id = $1', [v.id]);
      const pdf = await api(`/api/v1/fs/reports/${reportId}/export?format=pdf&version=2`, { token: staffToken });
      assert.equal(pdf.status, 200, pdf.text);
      assert.equal(pdf.buf.subarray(0, 5).toString('latin1'), '%PDF-');
      assert.equal((await sql('SELECT regenerated FROM fs_report_version_files WHERE version_id = $1', [v.id]))[0].regenerated, true);
    });

    await step('saving to the client folder needs a linked folder', async () => {
      const r = await api(`/api/v1/fs/reports/${reportId}/versions/3/save-to-folder`, { method: 'POST', token: staffToken });
      // The fixture client was inserted by SQL and has no folder link.
      assert.equal(r.json?.error?.code, 'CLIENT_NOT_LINKED', r.text);
    });
  }

  await step('save the layout as a firm template (admin), then start another year from it', async () => {
    const no = await api(`/api/v1/fs/layouts/${layoutId}/save-as-template`, { method: 'POST', token: staffToken, json: { name: 'House style' } });
    assert.equal(no.status, 403);
    const t = await api(`/api/v1/fs/layouts/${layoutId}/save-as-template`, { method: 'POST', token, json: { name: 'House style' } });
    assert.equal(t.status, 201, t.text);
    const tpl = t.json.data.template;
    assert.equal(tpl.entityKind, 'corporation');
    assert.ok(!JSON.stringify(tpl.layout).includes('groupingId'), 'a template carries lead sheet codes, never client ids');
    const r = await api(`/api/v1/periods/${fx.p26}/fs/reports`, {
      method: 'POST', token: staffToken,
      json: { name: 'From template', settings: { framework: 'tax', columns: { mode: 'single', pctOfRevenue: true, varianceAmt: false, variancePct: false } }, layoutSource: { kind: 'template', templateId: tpl.id } },
    });
    assert.equal(r.status, 201, r.text);
    const c = await api(`/api/v1/fs/reports/${r.json.data.report.id}/compute`, { method: 'POST', token: staffToken, json: {} });
    assert.equal(c.status, 200, c.text);
    assert.equal(stmt(c.json.data.model, 'income_statement').title, 'Statement of Revenues and Expenses — Income Tax Basis');
    fx.templateReportId = r.json.data.report.id;
  });

  await step('roll a statement set forward into another period on the same layout', async () => {
    const same = await api(`/api/v1/fs/reports/${reportId}/roll-forward`, { method: 'POST', token: staffToken, json: { periodId: fx.p25 } });
    assert.equal(same.status, 400);
    const r = await api(`/api/v1/fs/reports/${reportId}/roll-forward`, { method: 'POST', token: staffToken, json: { periodId: fx.p26 } });
    assert.equal(r.status, 201, r.text);
    const d = await api(`/api/v1/fs/reports/${r.json.data.report.id}`, { token: staffToken });
    assert.equal(d.json.data.report.name, 'Financial Statements 2026');
    assert.equal(d.json.data.layout.id, layoutId);
    assert.equal(d.json.data.report.status, 'draft');
    assert.equal(d.json.data.period.name, 'FY2026');
  });

  await step('archive hides a statement set from the list', async () => {
    assert.equal((await api(`/api/v1/fs/reports/${fx.templateReportId}`, { method: 'DELETE', token: staffToken })).status, 200);
    const list = await api(`/api/v1/clients/${fx.clientId}/fs/reports`, { token: staffToken });
    assert.ok(!list.json.data.reports.some((r) => r.id === fx.templateReportId));
  });

  await step('backup → restore as a new client: ids inside the layout are remapped, the issued numbers survive', async () => {
    const b = await api(`/api/v1/backup/client/${fx.clientId}`, { method: 'POST', token });
    assert.equal(b.status, 200, b.text);
    fx.backupId = b.json.data.id;
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: fx.backupId, mode: 'as_new' } });
    assert.equal(r.status, 200, r.text);
    const newClientId = r.json.data.newClientId;
    assert.ok(newClientId && newClientId !== fx.clientId);

    const before = (await sql('SELECT count(*)::int AS n FROM fs_reports WHERE client_id = $1', [fx.clientId]))[0].n;
    const restored = await sql('SELECT id, name, status, current_version_id, client_layout_id, period_id FROM fs_reports WHERE client_id = $1 ORDER BY id', [newClientId]);
    assert.equal(restored.length, before, 'every statement set came across (archived ones included)');
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_equity_roles WHERE client_id = $1', [newClientId]))[0].n, 1);

    // Every id a restored layout names belongs to the NEW client.
    const [{ layout_json: layout }] = await sql('SELECT layout_json FROM fs_client_layouts WHERE client_id = $1 ORDER BY id LIMIT 1', [newClientId]);
    const ids = [...JSON.stringify(layout).matchAll(/"groupingId":"(\d+)"/g)].map((m) => Number(m[1]));
    assert.ok(ids.length >= 10);
    const own = new Set((await sql('SELECT id FROM lead_sheets WHERE client_id = $1', [newClientId])).map((x) => x.id));
    assert.deepEqual(ids.filter((id) => !own.has(id)), [], 'no lead sheet id of the original client is left in the layout');

    // The copy of the rolled-forward draft computes on the new client's own data.
    const draft = restored.find((x) => x.name === 'Financial Statements 2026');
    const c = await api(`/api/v1/fs/reports/${draft.id}/compute`, { method: 'POST', token: staffToken, json: {} });
    assert.equal(c.status, 200, c.text);

    if (pdfEngine) {
      const fin = restored.find((x) => x.status === 'final');
      assert.ok(fin?.current_version_id, 'the final set kept its current version');
      const [v] = await sql('SELECT id, version_no, numbers_hash FROM fs_report_versions WHERE id = $1', [fin.current_version_id]);
      const [orig] = await sql('SELECT numbers_hash FROM fs_report_versions WHERE report_id = $1 AND version_no = $2', [reportId, v.version_no]);
      assert.equal(v.numbers_hash, orig.numbers_hash);
      // Rows, not bytes: the PDF was not in the archive…
      assert.equal((await sql('SELECT count(*)::int AS n FROM fs_report_version_files WHERE version_id = $1', [v.id]))[0].n, 0);
      // …and is produced again from the frozen version on demand.
      const pdf = await api(`/api/v1/fs/reports/${fin.id}/export?format=pdf&version=${v.version_no}`, { token: staffToken });
      assert.equal(pdf.status, 200, pdf.text);
      assert.equal(pdf.buf.subarray(0, 5).toString('latin1'), '%PDF-');
      assert.equal((await sql('SELECT regenerated FROM fs_report_version_files WHERE version_id = $1', [v.id]))[0].regenerated, true);
      // New ids → a different source stamp, but the same balances → the same numbers.
      const impact = await api(`/api/v1/fs/reports/${fin.id}/versions/${v.version_no}/impact`, { token: staffToken });
      assert.deepEqual(impact.json.data, { stale: true, changed: false });
    }
    fx.restoredClientId = newClientId;
  });

  await step('restore in place (replace): the client\'s statements come back, pointing at its re-created rows', async () => {
    const before = (await sql('SELECT count(*)::int AS n FROM fs_reports WHERE client_id = $1', [fx.clientId]))[0].n;
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: fx.backupId, mode: 'replace', targetClientId: fx.clientId } });
    assert.equal(r.status, 200, r.text);
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_reports WHERE client_id = $1', [fx.clientId]))[0].n, before);
    const sets = await sql(`SELECT r.id, r.name, r.status, r.client_layout_id, p.period_name FROM fs_reports r JOIN periods p ON p.id = r.period_id WHERE r.client_id = $1 AND r.archived_at IS NULL ORDER BY r.id`, [fx.clientId]);
    // Replace re-creates periods, accounts and lead sheets with new ids; re-point the fixtures.
    const main = sets.find((x) => x.name === 'Financial Statements 2025');
    reportId = main.id;
    layoutId = main.client_layout_id;
    fx.p25 = (await sql(`SELECT id FROM periods WHERE client_id = $1 AND period_name = 'FY2025'`, [fx.clientId]))[0].id;
    const c = await api(`/api/v1/fs/reports/${reportId}/${main.status === 'final' ? 'versions/4' : 'compute'}`, main.status === 'final' ? { token: staffToken } : { method: 'POST', token: staffToken, json: {} });
    assert.equal(c.status, 200, c.text);
    const [{ layout_json: layout }] = await sql('SELECT layout_json FROM fs_client_layouts WHERE id = $1', [layoutId]);
    const own = new Set((await sql('SELECT id FROM lead_sheets WHERE client_id = $1', [fx.clientId])).map((x) => x.id));
    const ids = [...JSON.stringify(layout).matchAll(/"groupingId":"(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(ids.filter((id) => !own.has(id)), []);
  });

  await step('the firm library rides in a settings backup and is restored in place', async () => {
    const b = await api('/api/v1/backup/settings', { method: 'POST', token });
    assert.equal(b.status, 200, b.text);
    const ids = (await sql('SELECT id, name FROM fs_letters ORDER BY id')).map((x) => x.id);
    await sql(`UPDATE fs_letters SET body_html = '<p>changed</p>' WHERE builtin_key = 'preparation_arc70'`);
    await sql(`UPDATE fs_firm_profile SET display_name = 'Someone Else'`);
    const r = await api('/api/v1/restore/execute', { method: 'POST', token, json: { backupId: b.json.data.id, mode: 'settings' } });
    assert.equal(r.status, 200, r.text);
    const lib = r.json.data.settingsReport.statementLibrary;
    assert.equal(lib.letterhead, true);
    assert.equal(lib.letters, 2);
    assert.equal(lib.presets, 2);
    assert.equal(lib.templates, 1);
    // Updated in place: same rows, same ids — statement sets point at them.
    assert.deepEqual((await sql('SELECT id FROM fs_letters ORDER BY id')).map((x) => x.id), ids);
    assert.ok((await sql(`SELECT body_html FROM fs_letters WHERE builtin_key = 'preparation_arc70'`))[0].body_html.includes('No assurance'));
    assert.equal((await sql('SELECT display_name FROM fs_firm_profile'))[0].display_name, 'Kisaes CPA');
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_letters WHERE is_default'))[0].n, 1);
  });

  await step('deleting a period that has statements (and audit rows) takes them along', async () => {
    // The replace-restore above re-created the period; give it an audit row,
    // because audit_log is append-only and a period WITH history is the
    // case that once made period deletes fail.
    assert.equal((await api(`/api/v1/fs/reports/${reportId}/export?format=xlsx`, { token: staffToken })).status, 200);
    assert.ok((await sql('SELECT count(*)::int AS n FROM audit_log WHERE period_id = $1', [fx.p25]))[0].n > 0);
    const del = await api(`/api/v1/periods/${fx.p25}`, { method: 'DELETE', token });
    assert.equal(del.status, 200, del.text);
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_reports WHERE period_id = $1', [fx.p25]))[0].n, 0);
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_report_versions WHERE report_id = $1', [reportId]))[0].n, 0);
    // The layout is the client's and survives: the rolled-forward set still uses it.
    assert.equal((await sql('SELECT count(*)::int AS n FROM fs_client_layouts WHERE id = $1', [layoutId]))[0].n, 1);
  });

  log(`\n${passed} steps passed${pdfEngine ? '' : ' (PDF steps skipped: no Chromium on this machine)'}`);
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  console.error('\n--- last server output ---');
  console.error(lines.slice(-120).join('\n'));
  console.error('\n', err);
} finally {
  if (server) await killTree(server.child);
  await dropScratchDb();
}
process.exit(failed ? 1 : 0);
