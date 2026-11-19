#!/usr/bin/env node
// Desktop sync pairing check (S2). Boots the real server against a scratch
// Postgres database with the demo client, then pairs desktops and checks the
// device token's reach: it lists clients on the sync routes, is refused on
// every other route, stops when revoked or when its user is deactivated, and
// a reviewer's device reads but does not write. Pairing under single sign-on
// with oidc_only on is in sso-e2e.mjs.
//
//   npm run test:sync-e2e        (from server/ or the root)
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
const DB_PREFIX = 'vibe_tb_sync_e2e_';

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


// ─────────────────────────────────────────────────────────────── scenarios

async function signIn(username, password, newPassword) {
  let login = await api('/api/v1/auth/login', { method: 'POST', json: { username, password } });
  assert.equal(login.status, 200, login.text);
  if (newPassword) {
    const rot = await api('/api/v1/auth/change-password', { method: 'POST', token: login.json.data.token, json: { currentPassword: password, newPassword } });
    assert.equal(rot.status, 200, rot.text);
    login = await api('/api/v1/auth/login', { method: 'POST', json: { username, password: newPassword } });
    assert.equal(login.status, 200, login.text);
  }
  return login.json.data.token;
}

async function pairWith(sessionToken, deviceName) {
  const c = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: sessionToken });
  assert.equal(c.status, 201, c.text);
  assert.match(c.json.data.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const p = await api('/api/v1/sync/pair', { method: 'POST', json: { code: c.json.data.code.toLowerCase(), deviceName } });
  assert.equal(p.status, 201, p.text);
  assert.match(p.json.data.token, /^vtbsync_/);
  return { code: c.json.data.code, token: p.json.data.token, deviceId: p.json.data.device.id };
}

const unzipper = require('unzipper');

/** Polls a sync job until it is done or failed (30 s). */
async function waitJob(token, jobId) {
  for (let i = 0; i < 200; i++) {
    const j = await api(`/api/v1/sync/jobs/${jobId}`, { token });
    assert.equal(j.status, 200, j.text);
    if (j.json.data.state === 'done' || j.json.data.state === 'failed') return j.json.data;
    await sleep(150);
  }
  throw new Error('job did not finish in 30 s');
}

/** The manifest inside a .tbak. */
async function manifestOf(buf) {
  const dir = await unzipper.Open.buffer(buf);
  const entry = dir.files.find((f) => f.path === 'manifest.json');
  assert.ok(entry, 'manifest.json in the archive');
  return JSON.parse((await entry.buffer()).toString('utf8'));
}

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
  await startServer();

  let admin;
  let laptop;
  let reviewer;
  let reviewerId;
  let reviewerDevice;

  await step('sign in as admin', async () => {
    admin = await signIn('admin', 'admin1234', ADMIN_PASSWORD);
  });

  await step('a code made by a signed-in user pairs a desktop (any case, with the dash)', async () => {
    laptop = await pairWith(admin, 'Example  laptop ');
    const d = await one(`SELECT name, token_hash FROM sync_devices WHERE id = $1`, [laptop.deviceId]);
    assert.equal(d.name, 'Example laptop', 'the name tidied');
    assert.notEqual(d.token_hash, laptop.token, 'only the hash is stored');
    assert.equal(d.token_hash.length, 64);
  });

  await step('the paired token lists clients and says who it is', async () => {
    const r = await api('/api/v1/sync/clients', { token: laptop.token });
    assert.equal(r.status, 200, r.text);
    assert.ok(r.json.data.length > 0, 'the demo clients');
    assert.match(r.json.data[0].sync_uid, /^[0-9a-f-]{36}$/);
    const me = await api('/api/v1/sync/me', { token: laptop.token });
    assert.equal(me.status, 200, me.text);
    assert.equal(me.json.data.device.name, 'Example laptop');
    assert.equal(me.json.data.user.username, 'admin');
    assert.ok(me.json.data.server.appVersion);
    assert.ok((await one(`SELECT last_used_at FROM sync_devices WHERE id = $1`, [laptop.deviceId])).last_used_at, 'last used is kept');
  });

  await step('two desktops typing the same code at once: exactly one pairs', async () => {
    const c = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: admin });
    const both = await Promise.all([1, 2].map((i) => api('/api/v1/sync/pair', { method: 'POST', json: { code: c.json.data.code, deviceName: `Race ${i}` } })));
    assert.deepEqual(both.map((r) => r.status).sort(), [201, 400], both.map((r) => r.text).join(' | '));
    assert.equal((await one(`SELECT count(*)::int AS n FROM sync_devices WHERE name LIKE 'Race %'`)).n, 1);
  });

  await step('a new code retires the earlier unused one', async () => {
    const first = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: admin });
    const second = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: admin });
    const old = await api('/api/v1/sync/pair', { method: 'POST', json: { code: first.json.data.code, deviceName: 'Old code' } });
    assert.equal(old.json.error.code, 'SYNC_CODE_INVALID');
    const fresh = await api('/api/v1/sync/pair', { method: 'POST', json: { code: second.json.data.code, deviceName: 'New code' } });
    assert.equal(fresh.status, 201, fresh.text);
    await api(`/api/v1/desktop-sync/devices/${fresh.json.data.device.id}`, { method: 'DELETE', token: admin });
    await sql(`DELETE FROM sync_devices WHERE name IN ('Race 1', 'Race 2', 'New code')`);
  });

  await step('a code pairs once; a wrong, malformed or expired one is refused alike', async () => {
    const again = await api('/api/v1/sync/pair', { method: 'POST', json: { code: laptop.code, deviceName: 'Second' } });
    assert.equal(again.status, 400, again.text);
    assert.equal(again.json.error.code, 'SYNC_CODE_INVALID');
    const wrong = await api('/api/v1/sync/pair', { method: 'POST', json: { code: 'ABCD-EFGH', deviceName: 'Second' } });
    assert.equal(wrong.json.error.code, 'SYNC_CODE_INVALID');
    const junk = await api('/api/v1/sync/pair', { method: 'POST', json: { code: 'not a code', deviceName: 'Second' } });
    assert.equal(junk.json.error.code, 'SYNC_CODE_INVALID');
    const noName = await api('/api/v1/sync/pair', { method: 'POST', json: { code: 'ABCD-EFGH', deviceName: '  ' } });
    assert.equal(noName.json.error.code, 'VALIDATION_ERROR');
    const c = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: admin });
    await sql(`UPDATE sync_pairing_codes SET expires_at = now() - interval '1 second' WHERE used_at IS NULL`);
    const expired = await api('/api/v1/sync/pair', { method: 'POST', json: { code: c.json.data.code, deviceName: 'Late' } });
    assert.equal(expired.status, 400, expired.text);
    assert.equal(expired.json.error.code, 'SYNC_CODE_INVALID');
    assert.equal(expired.json.error.message, again.json.error.message, 'one message: nothing to learn from which');
  });

  await step('the device token is refused on every route but the sync ones, and a session on the sync ones', async () => {
    for (const p of ['/api/v1/clients', '/api/v1/users', '/api/v1/desktop-sync/devices']) {
      const r = await api(p, { token: laptop.token });
      assert.equal(r.status, 401, `${p}: ${r.text}`);
    }
    const w = await api('/api/v1/clients', { method: 'POST', token: laptop.token, json: { name: 'Example' } });
    assert.equal(w.status, 401, w.text);
    const s = await api('/api/v1/sync/clients', { token: admin });
    assert.equal(s.status, 401, s.text);
    assert.equal(s.json.error.code, 'SYNC_NOT_PAIRED');
    const none = await api('/api/v1/sync/clients');
    assert.equal(none.status, 401);
  });

  await step('a reviewer\'s desktop reads but does not write', async () => {
    const u = await api('/api/v1/users', { method: 'POST', token: admin, json: { username: 'example.reviewer', displayName: 'Example Reviewer', password: 'E2eReviewer!2026', role: 'reviewer' } });
    assert.equal(u.status, 201, u.text);
    reviewerId = u.json.data.id;
    reviewer = await signIn('example.reviewer', 'E2eReviewer!2026', 'E2eReviewer!2027');
    reviewerDevice = await pairWith(reviewer, 'Example reviewer laptop');
    assert.equal((await api('/api/v1/sync/clients', { token: reviewerDevice.token })).status, 200);
    const w = await api('/api/v1/sync/clients', { method: 'POST', token: reviewerDevice.token, json: {} });
    assert.equal(w.status, 403, w.text);
    assert.equal(w.json.error.code, 'READ_ONLY');
    const a = await api('/api/v1/sync/clients', { method: 'POST', token: laptop.token, json: {} });
    assert.equal(a.status, 404, `an admin's device gets past the gate: ${a.text}`);
    // The reviewer gate still holds for ordinary writes; only their own
    // account and desktops are open to them.
    const write = await api('/api/v1/clients', { method: 'POST', token: reviewer, json: { name: 'Example' } });
    assert.equal(write.status, 403, write.text);
    assert.equal(write.json.error.code, 'READ_ONLY');
  });

  await step('each user sees their own devices; an admin everyone\'s; only the owner or an admin removes one', async () => {
    const mine = await api('/api/v1/desktop-sync/devices', { token: reviewer });
    assert.deepEqual(mine.json.data.map((d) => d.name), ['Example reviewer laptop']);
    const all = await api('/api/v1/desktop-sync/devices?all=1', { token: admin });
    assert.deepEqual(all.json.data.map((d) => d.name).sort(), ['Example laptop', 'Example reviewer laptop']);
    const notAll = await api('/api/v1/desktop-sync/devices?all=1', { token: reviewer });
    assert.equal(notAll.json.meta.all, false, 'all is for admins');
    const theirs = await api(`/api/v1/desktop-sync/devices/${laptop.deviceId}`, { method: 'DELETE', token: reviewer });
    assert.equal(theirs.status, 404, 'someone else\'s device is not found');
    const gone = await api(`/api/v1/desktop-sync/devices/${reviewerDevice.deviceId}`, { method: 'DELETE', token: admin });
    assert.equal(gone.status, 200, gone.text);
    const r = await api('/api/v1/sync/clients', { token: reviewerDevice.token });
    assert.equal(r.status, 401);
    assert.equal(r.json.error.code, 'SYNC_DEVICE_REVOKED');
    assert.ok((await one(`SELECT revoked_at FROM sync_devices WHERE id = $1`, [reviewerDevice.deviceId])).revoked_at, 'kept, revoked');
  });

  await step('a deactivated user\'s devices stop at once', async () => {
    const again = await pairWith(reviewer, 'Example reviewer desktop');
    assert.equal((await api('/api/v1/sync/me', { token: again.token })).status, 200);
    const off = await api(`/api/v1/users/${reviewerId}`, { method: 'PATCH', token: admin, json: { isActive: false } });
    assert.equal(off.status, 200, off.text);
    const r = await api('/api/v1/sync/me', { token: again.token });
    assert.equal(r.status, 401, r.text);
    // Removed at deactivation, not merely refused while inactive.
    assert.equal(r.json.error.code, 'SYNC_DEVICE_REVOKED');
  });

  await step('pairing, sync calls and removals are in the audit log, naming the device', async () => {
    const rows = await sql(`SELECT action, description FROM audit_log WHERE entity_type = 'sync_device' ORDER BY id`);
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['pairing_code', 'pair', 'sync', 'revoke']) assert.ok(actions.has(a), `${a} in ${[...actions]}`);
    assert.ok(rows.some((r) => r.action === 'sync' && r.description.includes('"Example laptop"') && r.description.includes('/api/v1/sync/clients')), 'a sync call names its device');
  });

  await step('polling reads are not audited; client data and refusals are', async () => {
    const d = await pairWith(admin, 'Audit probe');
    const before = (await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'sync_device' AND action = 'sync'`)).n;
    for (let i = 0; i < 3; i++) assert.equal((await api('/api/v1/sync/me', { token: d.token })).status, 200);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal((await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'sync_device' AND action = 'sync'`)).n, before, '/me is not audited');
    await api('/api/v1/sync/clients', { token: d.token });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal((await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'sync_device' AND action = 'sync'`)).n, before + 1, 'the client list is');
  });

  await step('a device unused for 90 days ends; one used inside that keeps working', async () => {
    const old = await pairWith(admin, 'Idle desktop');
    await sql(`UPDATE sync_devices SET last_used_at = now() - interval '91 days', created_at = now() - interval '200 days' WHERE id = $1`, [old.deviceId]);
    const r = await api('/api/v1/sync/me', { token: old.token });
    assert.equal(r.status, 401, r.text);
    assert.equal(r.json.error.code, 'SYNC_DEVICE_EXPIRED');
    assert.ok((await one(`SELECT revoked_at FROM sync_devices WHERE id = $1`, [old.deviceId])).revoked_at, 'and it is marked removed');
    const recent = await pairWith(admin, 'Busy desktop');
    await sql(`UPDATE sync_devices SET last_used_at = now() - interval '89 days' WHERE id = $1`, [recent.deviceId]);
    assert.equal((await api('/api/v1/sync/me', { token: recent.token })).status, 200);
  });

  await step("an admin resetting a user's password ends that user's desktops, and only theirs", async () => {
    const u = await api('/api/v1/users', { method: 'POST', token: admin, json: { username: 'example.staff', displayName: 'Example Staff', password: 'E2eStaff!2026', role: 'preparer' } });
    assert.equal(u.status, 201, u.text);
    const staffId = u.json.data.id;
    const staff = await signIn('example.staff', 'E2eStaff!2026', 'E2eStaff!2027');
    const mine = await pairWith(admin, 'Admin desktop');
    const theirs = await pairWith(staff, 'Staff desktop');
    const reset = await api(`/api/v1/users/${staffId}`, { method: 'PATCH', token: admin, json: { password: 'Another-Example-Pass-91!' } });
    assert.equal(reset.status, 200, reset.text);
    assert.equal((await api('/api/v1/sync/me', { token: theirs.token })).json.error.code, 'SYNC_DEVICE_REVOKED');
    assert.equal((await api('/api/v1/sync/me', { token: mine.token })).status, 200, "the admin's own desktop is untouched");
  });

  let afterReset;
  await step('an emailed reset link ends the desktops, and a session from before it cannot pair again', async () => {
    const u = await api('/api/v1/users', { method: 'POST', token: admin, json: { username: 'example.mailreset', displayName: 'Example Mail Reset', password: 'E2eMail!2026', role: 'preparer' } });
    assert.equal(u.status, 201, u.text);
    const oldSession = await signIn('example.mailreset', 'E2eMail!2026', 'E2eMail!2027');
    const desk = await pairWith(oldSession, 'Mail reset desktop');
    // A pending unused code from before the reset must die with it too.
    const pending = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: oldSession });
    assert.equal(pending.status, 201, pending.text);
    // The link the reset email would carry (the mailer is not configured here).
    const raw = 'e2e-reset-' + Date.now();
    await sql(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, encode(sha256($2::bytea), 'hex'), now() + interval '1 hour')`, [u.json.data.id, raw]);
    // Past the second the old session was issued in.
    await new Promise((r) => setTimeout(r, 1100));
    const done = await api('/api/v1/auth/password-reset/confirm', { method: 'POST', json: { token: raw, newPassword: 'E2eMail!2028x' } });
    assert.equal(done.status, 200, done.text);
    assert.equal((await api('/api/v1/sync/me', { token: desk.token })).json.error.code, 'SYNC_DEVICE_REVOKED');
    const usePending = await api('/api/v1/sync/pair', { method: 'POST', json: { code: pending.json.data.code, deviceName: 'From an old code' } });
    assert.equal(usePending.json.error.code, 'SYNC_CODE_INVALID', 'a code made before the reset is gone');
    const again = await api('/api/v1/desktop-sync/codes', { method: 'POST', token: oldSession });
    assert.equal(again.status, 401, `a session from before the reset may not make a code: ${again.text}`);
    assert.equal(again.json.error.code, 'SIGN_IN_AGAIN');
    const fresh = await signIn('example.mailreset', 'E2eMail!2028x');
    afterReset = { userId: u.json.data.id, desk: await pairWith(fresh, 'After reset desktop') };
  });

  await step('deactivating ends the desktops for good: reactivating does not bring them back', async () => {
    // The user from the step above (sign-ins are limited to 10 per 15 minutes).
    const { userId, desk } = afterReset;
    assert.equal((await api('/api/v1/sync/me', { token: desk.token })).status, 200);
    assert.equal((await api(`/api/v1/users/${userId}`, { method: 'PATCH', token: admin, json: { isActive: false } })).status, 200);
    assert.equal((await api(`/api/v1/users/${userId}`, { method: 'PATCH', token: admin, json: { isActive: true } })).status, 200);
    assert.equal((await api('/api/v1/sync/me', { token: desk.token })).json.error.code, 'SYNC_DEVICE_REVOKED');
  });

  // ─────────────────────────────── S3: read and pull
  const s3 = {};
  await step('S3: capabilities say what this server speaks', async () => {
    s3.laptop = await pairWith(admin, 'S3 laptop');
    s3.desk = await pairWith(admin, 'S3 desk');
    const c = await api('/api/v1/sync/capabilities', { token: s3.laptop.token });
    assert.equal(c.status, 200, c.text);
    assert.deepEqual(c.json.data.formatVersions, [2]);
    assert.match(c.json.data.schemaVersion, /^\d{14}_.+\.js$/);
    assert.ok(c.json.data.features.includes('checkout-v1'));
    assert.equal(c.json.data.checkoutWarnDays, 14);
  });

  await step('S3: the client list pages and searches', async () => {
    await sql(`INSERT INTO clients (name, entity_type) VALUES ('Example Paging Client A', 'llc'), ('Example Paging Client B', 'llc')`);
    const all = await sql(`SELECT name FROM clients WHERE is_active ORDER BY name, id`);
    const page = await api('/api/v1/sync/clients?limit=1&offset=1', { token: s3.laptop.token });
    assert.equal(page.status, 200, page.text);
    assert.equal(page.json.meta.total, all.length);
    assert.deepEqual(page.json.data.map((c) => c.name), [all[1].name]);
    const word = all[0].name.split(/\s+/)[0];
    const found = await api(`/api/v1/sync/clients?search=${encodeURIComponent(word.toLowerCase())}`, { token: s3.laptop.token });
    assert.ok(found.json.data.some((c) => c.name === all[0].name), `search "${word}"`);
    assert.equal((await api('/api/v1/sync/clients?limit=0', { token: s3.laptop.token })).status, 400);
  });

  await step("S3: a client's periods carry their stamps, and a reference period is not offered", async () => {
    const c = await one(`SELECT c.id, c.sync_uid FROM clients c JOIN periods p ON p.client_id = c.id JOIN trial_balance tb ON tb.period_id = p.id
                         GROUP BY c.id ORDER BY count(*) DESC, c.id LIMIT 1`);
    s3.client = c;
    const ref = await one(`INSERT INTO periods (client_id, period_name, start_date, end_date, is_reference) VALUES ($1, 'Example reference', '1990-01-01', '1990-12-31', true) RETURNING id`, [c.id]);
    const r = await api(`/api/v1/sync/clients/${c.sync_uid}/periods`, { token: s3.laptop.token });
    assert.equal(r.status, 200, r.text);
    assert.ok(r.json.data.length > 0);
    assert.ok(!r.json.data.some((p) => p.period_name === 'Example reference'), 'the reference is not listed');
    for (const p of r.json.data) {
      assert.match(p.stamp, /^[0-9a-f]{64}$/);
      assert.equal(p.checkout, null);
    }
    await sql(`DELETE FROM periods WHERE id = $1`, [ref.id]);
    const withTb = await one(`SELECT p.id, p.sync_uid FROM periods p JOIN trial_balance tb ON tb.period_id = p.id WHERE p.client_id = $1 GROUP BY p.id ORDER BY count(*) DESC, p.id LIMIT 1`, [c.id]);
    s3.period = { ...withTb, stamp: r.json.data.find((p) => p.sync_uid === withTb.sync_uid).stamp };
    assert.equal((await api('/api/v1/sync/clients/00000000-0000-4000-8000-000000000000/periods', { token: s3.laptop.token })).status, 404);
  });

  await step('S3: a pull with check-out returns a job; its archive carries the stamp and the check-out', async () => {
    const pull = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.laptop.token, json: { checkout: true } });
    assert.equal(pull.status, 202, pull.text);
    s3.checkoutId = pull.json.data.checkoutId;
    assert.ok(s3.checkoutId > 0);
    const job = await waitJob(s3.laptop.token, pull.json.data.jobId);
    assert.equal(job.state, 'done', JSON.stringify(job.error));
    assert.equal(job.result.stamp, s3.period.stamp, 'the stamp in the result is the period as listed');
    const other = await api(`/api/v1/sync/jobs/${pull.json.data.jobId}`, { token: s3.desk.token });
    assert.equal(other.status, 404, "another device's job is not visible");
    const a = await api(`/api/v1/sync/jobs/${pull.json.data.jobId}/archive`, { token: s3.laptop.token });
    assert.equal(a.status, 200, a.text);
    assert.equal(a.buf.subarray(0, 2).toString('latin1'), 'PK');
    const m = await manifestOf(a.buf);
    assert.equal(m.backupLevel, 'period');
    assert.equal(m.periodId, s3.period.id);
    assert.equal(m.sync.stamp, s3.period.stamp);
    assert.equal(m.sync.checkoutId, s3.checkoutId);
    assert.equal(m.sync.periodUid, s3.period.sync_uid);
    assert.equal(m.sync.clientUid, s3.client.sync_uid);
    assert.equal((await one(`SELECT stamp_at_pull FROM period_checkouts WHERE id = $1`, [s3.checkoutId])).stamp_at_pull, s3.period.stamp);
    assert.equal((await one(`SELECT count(*)::int AS n FROM backup_history WHERE period_id = $1`, [s3.period.id])).n, 0, 'a pull is not a backup');
  });

  await step('S3: a checked-out period refuses web writes, naming who has it', async () => {
    const [a1, a2] = (await sql(`SELECT id FROM chart_of_accounts WHERE client_id = $1 ORDER BY account_number LIMIT 2`, [s3.client.id])).map((r) => r.id);
    s3.je = { periodId: s3.period.id, entryType: 'book', entryDate: '2025-12-31', description: 'Example S3 entry', lines: [{ accountId: a1, debit: 100, credit: 0 }, { accountId: a2, debit: 0, credit: 100 }] };
    const w = await api('/api/v1/journal-entries', { method: 'POST', token: admin, json: s3.je });
    assert.equal(w.status, 409, w.text);
    assert.equal(w.json.error.code, 'PERIOD_CHECKED_OUT');
    assert.match(w.json.error.message, /S3 laptop/);
    const listed = await api(`/api/v1/sync/clients/${s3.client.sync_uid}/periods`, { token: s3.desk.token });
    const p = listed.json.data.find((x) => x.sync_uid === s3.period.sync_uid);
    assert.equal(p.checkout.device, 'S3 laptop');
    assert.equal(p.checkout.mine, false);
    assert.equal(p.checkout.stale, false);
  });

  await step('S3: a second device is refused a check-out but may pull to read; the holder re-pulls the same check-out', async () => {
    const again = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.desk.token, json: { checkout: true } });
    assert.equal(again.status, 409, again.text);
    assert.equal(again.json.error.code, 'PERIOD_CHECKED_OUT');
    assert.match(again.json.error.message, /S3 laptop/);
    const read = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.desk.token, json: { checkout: false } });
    assert.equal(read.status, 202, read.text);
    assert.equal(read.json.data.checkoutId, null);
    assert.equal((await waitJob(s3.desk.token, read.json.data.jobId)).state, 'done');
    const mine = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.laptop.token, json: {} });
    assert.equal(mine.status, 202, mine.text);
    assert.equal(mine.json.data.checkoutId, s3.checkoutId, 'checkout defaults to true and is the one it holds');
    await waitJob(s3.laptop.token, mine.json.data.jobId);
  });

  await step("S3: a reviewer's desktop pulls to read only", async () => {
    assert.equal((await api(`/api/v1/users/${reviewerId}`, { method: 'PATCH', token: admin, json: { isActive: true } })).status, 200);
    const rd = await pairWith(reviewer, 'S3 reviewer desktop');
    const out = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: rd.token, json: { checkout: true } });
    assert.equal(out.status, 403, out.text);
    const read = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: rd.token, json: { checkout: false } });
    assert.equal(read.status, 202, read.text);
    assert.equal((await waitJob(rd.token, read.json.data.jobId)).state, 'done');
  });

  await step('S3: an old check-out is flagged stale, never released', async () => {
    await sql(`UPDATE period_checkouts SET created_at = now() - interval '15 days' WHERE id = $1`, [s3.checkoutId]);
    const listed = await api(`/api/v1/sync/clients/${s3.client.sync_uid}/periods`, { token: s3.laptop.token });
    const p = listed.json.data.find((x) => x.sync_uid === s3.period.sync_uid);
    assert.equal(p.checkout.days, 15);
    assert.equal(p.checkout.stale, true);
    assert.equal(p.checkout.mine, true);
  });

  await step('S3: only the holder gives a check-out back; then the web writes again', async () => {
    assert.equal((await api(`/api/v1/sync/checkouts/${s3.checkoutId}`, { method: 'DELETE', token: s3.desk.token })).status, 404);
    const r = await api(`/api/v1/sync/checkouts/${s3.checkoutId}`, { method: 'DELETE', token: s3.laptop.token });
    assert.equal(r.status, 200, r.text);
    const w = await api('/api/v1/journal-entries', { method: 'POST', token: admin, json: s3.je });
    assert.equal(w.status, 201, w.text);
    assert.equal((await api(`/api/v1/sync/checkouts/${s3.checkoutId}`, { method: 'DELETE', token: s3.laptop.token })).status, 404, 'once');
  });

  await step('S3: a locked period pulls only to read', async () => {
    await sql(`UPDATE periods SET locked_at = now() WHERE id = $1`, [s3.period.id]);
    const out = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.laptop.token, json: { checkout: true } });
    assert.equal(out.status, 409, out.text);
    assert.equal(out.json.error.code, 'PERIOD_LOCKED');
    const read = await api(`/api/v1/sync/periods/${s3.period.sync_uid}/pull`, { method: 'POST', token: s3.laptop.token, json: { checkout: false } });
    assert.equal(read.status, 202, read.text);
    await waitJob(s3.laptop.token, read.json.data.jobId);
    await sql(`UPDATE periods SET locked_at = NULL WHERE id = $1`, [s3.period.id]);
  });

  await step('S3: polling is not audited; an archive download is', async () => {
    const n = async () => (await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'sync_device' AND action = 'sync' AND description LIKE '%/archive%'`)).n;
    assert.ok((await n()) >= 1);
    const checkouts = await sql(`SELECT action FROM audit_log WHERE entity_type = 'period_checkout' ORDER BY id`);
    assert.deepEqual([...new Set(checkouts.map((r) => r.action))].sort(), ['checkout', 'release']);
  });

  await step('pairing is rate limited by address, whatever token a guesser sends', async () => {
    let limited = false;
    for (let i = 0; i < 14 && !limited; i++) {
      // A made-up, unsigned JWT naming a different user each time must not
      // buy a fresh bucket.
      const fake = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ userId: 1000 + i })).toString('base64url')}.`;
      const r = await fetch(server.base + '/api/v1/sync/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${fake}` },
        body: JSON.stringify({ code: 'ABCD-EFGH', deviceName: 'Guess' }),
      });
      limited = r.status === 429;
    }
    assert.ok(limited, 'refused after 10 tries in 15 minutes');
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
