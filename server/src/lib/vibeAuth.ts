// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Vibe Auth (single sign-on) for Trial Balance.
 *
 * The package (@kisaesdevlab/vibe-auth) owns the OIDC flow, the Settings →
 * Authentication API and the break-glass rules; this module is the product
 * side of the contract:
 *
 *   - UserAdapter over app_users (lib/vibeAuthUsers.ts, shared with the CLI).
 *   - SessionAdapter for a stateless-JWT product. There is no cookie session
 *     to create: an SSO login mints the same 8 h bearer token POST /login does
 *     (plus a `sid` claim) and hands it to the SPA on the fragment of the
 *     post-login redirect — `/login#sso_token=<jwt>` — which the login page
 *     stores exactly as it stores a password login. The identity behind the
 *     token (issuer, subject, IdP session id, ID token) is parked in
 *     auth_sessions_oidc so logout and back-channel logout can find it.
 *   - Revocation list (D16): back-channel logout revokes the user's tokens;
 *     middleware/auth.ts consults it on every verify.
 *   - Identity / settings stores on the package tables, secrets wrapped with
 *     the product's AES-GCM key, audit events into audit_log.
 *
 * Paths. Every deployment strips the SPA prefix before the API sees a request
 * (the Vite proxy, the single-app nginx, and the appliance Caddy `handle_path
 * /tb/*`), so the engine routes on `/auth/*` with an empty basePath. The
 * browser-facing prefix (`/tb` in multi-app mode) comes from the app's public
 * URL and is applied to the paths the engine hands the browser: the login /
 * break-glass pages, the post-login return and the test-connection popup.
 */

import crypto from 'crypto';
import express, { type Request, type RequestHandler, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  createPgStores,
  createVibeAuth,
  sendHttpResponse,
  toHttpRequest,
  type HttpResponse,
  type SessionAdapter,
  type SessionIdentity,
  type VibeAuth,
  type VibeUser,
} from '@kisaesdevlab/vibe-auth';
import { db } from '../db';
import { JWT_SECRET } from './jwtConfig';
import { decrypt, encrypt } from './encryption';
import { buildCookie, parseCookieHeader } from './cookies';
import { cookiesAreSecure, signFullToken } from './sessionTokens';
import { resolvePublicUrl } from './publicUrl';
import { invalidateAuthCache, setRevocationCheck } from '../middleware/auth';
import { createVibeUsers, vibeAuditSink } from './vibeAuthUsers';

export const VIBE_TB_ROLES = { roles: ['admin', 'reviewer', 'preparer'], adminRole: 'admin' } as const;

/** Server-side prefix of the engine's routes. Always '/auth/...' — see the header comment. */
const AUTH_PREFIX = '/auth';

/**
 * The settings page opens the test-connection popup by plain navigation, so
 * no bearer header travels with it. POST /auth/settings/test (which the page
 * calls first, with the bearer) answers with this short-lived cookie scoped to
 * the OIDC paths; currentUserId() accepts it for that one navigation only.
 */
const SSO_ADMIN_COOKIE = 'vibe_tb_sso_admin';
const SSO_ADMIN_COOKIE_TTL_SEC = 10 * 60;

interface SessionClaims {
  userId: number;
  username: string;
  role: string;
  sid?: string;
  stage?: unknown;
  exp?: number;
}

function bearerFrom(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Verify a TB session token. Scoped (mfa / enrol) tokens are not sessions. */
function verifySession(token: string): SessionClaims | null {
  try {
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as SessionClaims;
    if (p.stage !== undefined && p.stage !== null) return null;
    if (typeof p.userId !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

function isTestStartNavigation(req: Request): boolean {
  return req.method === 'GET' && req.path === `${AUTH_PREFIX}/oidc/start` && req.query.test === '1';
}

function sessionFor(req: Request): SessionClaims | null {
  const bearer = bearerFrom(req);
  if (bearer) return verifySession(bearer);
  if (isTestStartNavigation(req)) {
    const cookie = parseCookieHeader(req.headers.cookie)[SSO_ADMIN_COOKIE];
    if (cookie) return verifySession(cookie);
  }
  return null;
}

async function mintSsoToken(user: VibeUser, identity: SessionIdentity): Promise<{ token: string; expiresAt?: string }> {
  const id = Number(user.id);
  let username = user.username;
  if (!username) {
    const row = await db('app_users').where({ id }).first('username');
    username = (row?.username as string | undefined) ?? '';
  }
  const sid = crypto.randomBytes(16).toString('hex');
  await db('auth_sessions_oidc').insert({
    sid,
    user_id: id,
    issuer: identity.issuer,
    subject: identity.subject,
    oidc_sid: identity.sid ?? null,
    id_token: identity.idToken ?? null,
  });
  // The role may have just been synced from the IdP's claims.
  invalidateAuthCache(id);
  const token = signFullToken({ id, username, role: user.role }, { sid });
  const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
  return { token, expiresAt: exp ? new Date(exp * 1000).toISOString() : undefined };
}

const sessions: SessionAdapter = {
  async create(_req: Request, res: Response, user: VibeUser, identity: SessionIdentity) {
    const { token } = await mintSsoToken(user, identity);
    // vibeAuthMiddleware() appends it to the engine's post-login redirect.
    res.locals.vibeAuthToken = token;
  },

  /** The client discards its bearer; all we hold server-side is the identity row. */
  async destroy(req: Request) {
    const s = sessionFor(req);
    if (s?.sid) await db('auth_sessions_oidc').where({ sid: s.sid }).delete();
  },

  async currentUserId(req: Request) {
    const s = sessionFor(req);
    return s ? String(s.userId) : null;
  },

  async currentIdentity(req: Request) {
    const s = sessionFor(req);
    if (!s?.sid) return null;
    const row = await db('auth_sessions_oidc').where({ sid: s.sid }).first('issuer', 'subject', 'oidc_sid', 'id_token');
    if (!row) return null;
    return {
      issuer: row.issuer as string,
      subject: row.subject as string,
      sid: (row.oidc_sid as string | null) ?? undefined,
      idToken: (row.id_token as string | null) ?? undefined,
    };
  },

  /** Back-channel logout: drop the identity rows; the revocation list does the rest. */
  async destroyByIdentity(i) {
    const userId = i.userId !== undefined ? Number(i.userId) : NaN;
    const q = db('auth_sessions_oidc').where((b) => {
      let any = false;
      if (i.sid) { b.orWhere({ oidc_sid: i.sid }); any = true; }
      if (i.subject) { b.orWhere({ issuer: i.issuer, subject: i.subject }); any = true; }
      if (Number.isInteger(userId)) { b.orWhere({ user_id: userId }); any = true; }
      if (!any) b.whereRaw('false');
    });
    return q.delete();
  },

  /** Tauri-style loopback clients get the same bearer the SPA does. */
  issueToken: mintSsoToken,
};

/**
 * The package's stores speak parameterised SQL with $1..$n placeholders.
 * knex.raw() insists on counting `?` bindings, so run them on a pooled pg
 * connection borrowed from knex instead.
 */
interface RawPgConnection { query(sql: string, params: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }
async function pgQuery(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const client = db.client as { acquireConnection(): Promise<RawPgConnection>; releaseConnection(c: RawPgConnection): Promise<void> };
  const conn = await client.acquireConnection();
  try {
    return (await conn.query(sql, params)).rows;
  } finally {
    await client.releaseConnection(conn);
  }
}

const pgStores = createPgStores({ query: pgQuery });

let instance: VibeAuth | null = null;
let spaPrefix = '';

/** The browser-facing SPA prefix ('' or e.g. '/tb') the engine's paths are rewritten with. */
export function getSpaPrefix(): string {
  getVibeAuth();
  return spaPrefix;
}

/**
 * Built on first use, which app.ts arranges to be after the public-URL
 * setting has been loaded (start() runs after loadSecuritySettings()). The
 * public URL is TB's existing one (Settings → public app URL, APP_BASE_URL,
 * or the first ALLOWED_ORIGIN); the console's VIBE_OIDC_PUBLIC_URL wins when
 * set. Changing it later needs a restart, like the other URL-derived config.
 */
export function getVibeAuth(): VibeAuth {
  if (instance) return instance;

  const fromEnv = process.env.VIBE_OIDC_PUBLIC_URL?.trim().replace(/\/+$/, '');
  const publicUrl = fromEnv || resolvePublicUrl().url;
  try {
    spaPrefix = new URL(publicUrl).pathname.replace(/\/+$/, '');
  } catch {
    spaPrefix = '';
  }

  instance = createVibeAuth({
    product: { slug: 'vibe-tb', name: 'Vibe Trial Balance', roles: VIBE_TB_ROLES },
    users: createVibeUsers({ onUserChanged: invalidateAuthCache }),
    session: sessions,
    identities: pgStores.identities,
    settings: pgStores.settings,
    revocations: pgStores.revocations,
    secretWrap: { wrap: async (p) => encrypt(p), unwrap: async (w) => decrypt(w) },
    audit: vibeAuditSink,
    basePath: '',
    loginPath: `${spaPrefix}/login`,
    breakglassLoginPath: `${spaPrefix}/login/local`,
    // The login page reads the token off the fragment, so SSO always lands there.
    defaultReturnTo: `${spaPrefix}/login`,
    publicUrl,
    trustProxy: true,
    syncRoles: true,
    logger: {
      info: (m, meta) => console.log(`[vibe-auth] ${m}`, meta ?? ''),
      warn: (m, meta) => console.warn(`[vibe-auth] ${m}`, meta ?? ''),
      error: (m, meta) => console.error(`[vibe-auth] ${m}`, meta ?? ''),
    },
  });

  const auth = instance;
  setRevocationCheck((key, issuedAtMs) => auth.isRevoked(key, issuedAtMs));
  return instance;
}

/**
 * Boot: resolve config and begin IdP discovery. Throws only for the one
 * refusal the package makes at startup — oidc_only with no active break-glass
 * user — which app.ts turns into a fatal exit with the package's message.
 */
export async function startVibeAuth(): Promise<void> {
  const auth = getVibeAuth();
  await auth.start();
  const s = auth.status();
  console.log(`[vibe-auth] mode=${s.mode} sso=${s.oidc.enabled ? s.oidc.issuer : 'off'} prefix=${spaPrefix || '/'}`);
}

/** The sign-in policy hook for POST /login: 403 in oidc_only unless it is the break-glass user. */
export const requireLocalLoginAllowed: RequestHandler = (req, res, next) => {
  const username = (req.body as { username?: unknown } | undefined)?.username;
  const v = getVibeAuth().localLoginAllowed(typeof username === 'string' ? username : '');
  if (v.allowed) return next();
  res.status(403).json({
    data: null,
    error: { code: 'LOCAL_LOGIN_DISABLED', message: 'Local sign-in is disabled for this product. Use single sign-on.' },
  });
};

function isHtml(r: HttpResponse): boolean {
  return (r.headers['content-type'] ?? '').startsWith('text/html');
}

function isJsonObject(body: unknown): body is Record<string, unknown> {
  return !!body && typeof body === 'object' && !Buffer.isBuffer(body) && !Array.isArray(body);
}

/** Prefix a path the engine built for the browser with the SPA prefix. */
function withPrefix(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.startsWith(AUTH_PREFIX) ? spaPrefix + v : v;
}

async function handleAuthRequest(req: Request, res: Response): Promise<boolean> {
  const auth = getVibeAuth();
  const r = await auth.handle(toHttpRequest(req, res));
  if (!r) return false;

  // Post-login handoff: the session adapter minted a bearer; the SPA reads it
  // off the fragment, which never reaches a server or a log.
  const token = res.locals.vibeAuthToken as string | undefined;
  if (token && r.status >= 300 && r.status < 400 && r.headers.location) {
    r.headers.location = `${r.headers.location.split('#')[0]}#sso_token=${encodeURIComponent(token)}`;
  }

  // Test-connection popup: hand the admin's bearer to the OIDC start path as a
  // cookie, since the popup is a plain navigation (see SSO_ADMIN_COOKIE).
  if (req.method === 'POST' && req.path === `${AUTH_PREFIX}/settings/test` && r.status === 200) {
    const bearer = bearerFrom(req);
    if (bearer) {
      res.append(
        'Set-Cookie',
        buildCookie(SSO_ADMIN_COOKIE, bearer, {
          maxAgeSec: SSO_ADMIN_COOKIE_TTL_SEC,
          secure: cookiesAreSecure(),
          path: `${spaPrefix}${AUTH_PREFIX}/oidc`,
          sameSite: 'Lax',
        }),
      );
    }
  }

  // Browser-facing paths in JSON answers get the SPA prefix (multi-app mode).
  if (spaPrefix && isJsonObject(r.body)) {
    if (typeof r.body.url === 'string') r.body.url = withPrefix(r.body.url);
    const oidc = r.body.oidc;
    if (isJsonObject(oidc) && typeof oidc.startPath === 'string') oidc.startPath = withPrefix(oidc.startPath);
  }

  // The engine's own pages (logged out, sign-in error, test result) carry an
  // inline style and, for the popup, an inline postMessage script. Give them
  // a CSP that permits exactly that, and let the popup keep window.opener.
  if (isHtml(r)) {
    r.headers['content-security-policy'] =
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
    res.removeHeader('Cross-Origin-Opener-Policy');
  }

  sendHttpResponse(res, r);
  return true;
}

/**
 * Express middleware for the engine's routes. Mount at app level, after the
 * public probes and JSON body parser, before any router that applies
 * authMiddleware; it passes every path outside /auth/* straight through.
 * The back-channel logout endpoint posts a form, hence the scoped urlencoded
 * parser.
 */
export function vibeAuthMiddleware(): RequestHandler {
  const urlencoded = express.urlencoded({ extended: false });
  return (req, res, next) => {
    if (req.path !== AUTH_PREFIX && !req.path.startsWith(`${AUTH_PREFIX}/`)) return next();
    urlencoded(req, res, (err?: unknown) => {
      if (err) return next(err);
      handleAuthRequest(req, res)
        .then((handled) => { if (!handled) next(); })
        .catch(next);
    });
  };
}
