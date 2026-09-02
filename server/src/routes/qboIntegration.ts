// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks Online connector administration: app credentials (settings rows,
 * never .env edits), the OAuth round trip, and per-client connections.
 *
 * The OAuth callback is the one unauthenticated route here — Intuit sends the
 * browser to it and carries no bearer token. It never trusts the request for
 * anything: the state nonce is consumed atomically, the redirect target is
 * derived from the CONFIGURED redirect URI, and the only things appended to
 * that target are an integer pending id or a short enum error code.
 *
 * A finished authorization does not bind straight away. The callback parks
 * the tokens on the state row and the user confirms "bind company X to
 * client Y" on the QuickBooks page — a re-auth for a client that already has
 * a connection would otherwise collide with UNIQUE(client_id) mid-callback,
 * and a QBOA user who picked the wrong company gets to discard it.
 */

import { randomBytes } from 'crypto';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { decrypt, encrypt } from '../lib/encryption';
import { PdfTemplateService } from '../pdf/PdfTemplateService';
import { buildQboSetupGuideContent } from '../pdf/qboSetupGuide';
import {
  QBO_SETTING_KEYS,
  appBaseUrl,
  invalidateQboCache,
  loadQboConfig,
  publicBaseFromRedirectUri,
  redirectUriProblem,
} from '../lib/qbo/settings';
import { buildAuthorizeUrl, exchangeCode, QboOAuthError, refreshTokens, type TokenSet } from '../lib/qbo/oauth';
import { createQboApi } from '../lib/qbo/apiClient';
import { qboLimiter } from '../lib/qbo/limiter';
import {
  apiForConnection,
  hashState,
  loadConnection,
  QboConnectionError,
  revokeEncryptedToken,
  type QboConnectionRow,
} from '../lib/qbo/tokenStore';

export const qboIntegrationRouter = Router();

const STATE_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 30 * 60_000;

/** The short enum of error codes the callback may append to the SPA redirect. */
type CallbackError = 'access_denied' | 'state_invalid' | 'exchange_failed' | 'company_info_failed' | 'not_configured';

function spaRedirect(base: string, query: { pending?: number; error?: CallbackError }): string {
  const target = `${base.replace(/\/+$/, '')}/quickbooks`;
  if (query.pending !== undefined) return `${target}?pending=${Math.trunc(query.pending)}`;
  if (query.error) return `${target}?error=${query.error}`;
  return target;
}

// ─────────────────────────────────────────────────────────────────────────
// GET /callback — unauthenticated; Intuit lands the browser here.
// ─────────────────────────────────────────────────────────────────────────
qboIntegrationRouter.get('/callback', async (req, res: Response): Promise<void> => {
  const cfg = await loadQboConfig();
  const fallbackBase = publicBaseFromRedirectUri(cfg.redirectUri);
  const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const realmId = typeof req.query.realmId === 'string' ? req.query.realmId.trim() : '';
  const intuitError = typeof req.query.error === 'string' ? req.query.error : '';

  if (!stateRaw || stateRaw.length > 200) {
    res.redirect(spaRedirect(fallbackBase, { error: 'state_invalid' }));
    return;
  }

  interface StateRow {
    id: number;
    client_id: number;
    environment: string;
    redirect_uri: string;
  }
  let state: StateRow | null = null;
  try {
    // Atomic consume: a refresh of the callback URL finds consumed_at set and cannot re-exchange the code.
    const result = await db.raw(
      `UPDATE qbo_oauth_states SET consumed_at = now()
         WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > now()
         RETURNING id, client_id, environment, redirect_uri`,
      [hashState(stateRaw)],
    );
    state = (result.rows?.[0] as StateRow | undefined) ?? null;
  } catch (err) {
    console.error('[qbo] Callback state lookup failed:', err instanceof Error ? err.message : err);
  }
  if (!state) {
    res.redirect(spaRedirect(fallbackBase, { error: 'state_invalid' }));
    return;
  }
  // From here on the state row is ours; redirect relative to ITS snapshot so a base-path override holds.
  const base = publicBaseFromRedirectUri(state.redirect_uri);

  if (intuitError || !code) {
    await db('qbo_oauth_states').where({ id: state.id }).update({ discarded_at: db.fn.now() });
    res.redirect(spaRedirect(base, { error: 'access_denied' }));
    return;
  }
  if (!cfg.configured) {
    res.redirect(spaRedirect(base, { error: 'not_configured' }));
    return;
  }

  let tokens: TokenSet;
  try {
    tokens = await exchangeCode({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      code,
      redirectUri: state.redirect_uri,
    });
  } catch (err) {
    console.error(
      '[qbo] Code exchange failed:',
      err instanceof QboOAuthError ? `HTTP ${err.status} ${err.intuitError ?? err.kind}` : err instanceof Error ? err.message : err,
    );
    res.redirect(spaRedirect(base, { error: 'exchange_failed' }));
    return;
  }

  let companyName = '';
  try {
    const api = createQboApi({
      baseUrl: cfg.apiBaseUrl,
      realmId,
      getAccessToken: async () => tokens.accessToken,
      limiter: qboLimiter,
    });
    companyName = (await api.companyInfo()).CompanyName;
  } catch (err) {
    console.error('[qbo] CompanyInfo after authorization failed:', err instanceof Error ? err.message : err);
    res.redirect(spaRedirect(base, { error: 'company_info_failed' }));
    return;
  }

  try {
    await db('qbo_oauth_states')
      .where({ id: state.id })
      .update({
        realm_id: realmId.slice(0, 32),
        company_name: companyName.slice(0, 255) || null,
        token_payload_enc: encrypt(
          JSON.stringify({
            accessToken: tokens.accessToken,
            accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
            refreshToken: tokens.refreshToken,
            refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
          }),
        ),
        pending_expires_at: new Date(Date.now() + PENDING_TTL_MS),
      });
  } catch (err) {
    console.error('[qbo] Could not store pending authorization:', err instanceof Error ? err.message : err);
    res.redirect(spaRedirect(base, { error: 'exchange_failed' }));
    return;
  }
  res.redirect(spaRedirect(base, { pending: state.id }));
});

// Everything below requires a signed-in user.
qboIntegrationRouter.use(authMiddleware);

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    return;
  }
  next();
}

/** Same sentinel settings.ts / storage.ts use: "leave the stored secret alone". */
const SECRET_KEEP = '__keep__';

async function upsertSetting(key: string, value: string): Promise<void> {
  await db('settings')
    .insert({ key, value, updated_at: db.fn.now() })
    .onConflict('key')
    .merge({ value, updated_at: db.fn.now() });
}

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return '••••••••' + value.slice(-4);
}

// ─────────────────────────────────────────────────────────────────────────
// GET /setup-guide.pdf — any signed-in user
// ─────────────────────────────────────────────────────────────────────────
qboIntegrationRouter.get('/setup-guide.pdf', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = await loadQboConfig();
    const svc = await PdfTemplateService.fromDb(db);
    const docDef = svc.buildDocument({
      title: 'QuickBooks Online Setup Guide',
      clientName: svc.firmName || 'Vibe Trial Balance',
      periodName: 'Connector setup',
      pageOrientation: 'portrait',
      content: buildQboSetupGuideContent({
        redirectUri: cfg.redirectUri,
        defaultRedirectUri: cfg.defaultRedirectUri,
        environment: cfg.environment,
        appBaseUrl: appBaseUrl(),
        configured: cfg.configured,
        envOverride: cfg.envOverride,
      }),
    });
    const buf = await svc.generateBuffer(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="QuickBooks Setup Guide.pdf"');
    res.send(buf);
  } catch (err) {
    sendServerError(res, err, 'qbo setup guide');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Settings (admin)
// ─────────────────────────────────────────────────────────────────────────
async function settingsPayload(): Promise<Record<string, unknown>> {
  const cfg = await loadQboConfig();
  return {
    configured: cfg.configured,
    envOverride: cfg.envOverride,
    environment: cfg.environment,
    clientId: cfg.clientId,
    hasClientSecret: cfg.clientSecret.length > 0,
    clientSecretMasked: cfg.clientSecret ? maskSecret(cfg.clientSecret) : '',
    redirectUriOverride: cfg.redirectUriOverride,
    redirectUri: cfg.redirectUri,
    defaultRedirectUri: cfg.defaultRedirectUri,
    appBaseUrl: appBaseUrl(),
  };
}

qboIntegrationRouter.get('/settings', adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ data: await settingsPayload(), error: null });
  } catch (err) {
    sendServerError(res, err, 'qbo settings');
  }
});

const settingsSchema = z.object({
  environment: z.enum(['sandbox', 'production']),
  clientId: z.string().trim().max(200),
  clientSecret: z.string().max(500).optional(),
  redirectUri: z.string().trim().max(1024).optional(),
});

qboIntegrationRouter.put('/settings', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const body = parsed.data;
  // Validate BEFORE any write — upsertSetting starts its query the moment it is called.
  if (body.redirectUri) {
    const problem = redirectUriProblem(body.redirectUri);
    if (problem) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: problem } });
      return;
    }
  }
  try {
    const before = await loadQboConfig();
    await upsertSetting(QBO_SETTING_KEYS.environment, body.environment);
    await upsertSetting(QBO_SETTING_KEYS.clientId, body.clientId);
    if (body.clientSecret !== undefined && body.clientSecret !== SECRET_KEEP) {
      await upsertSetting(QBO_SETTING_KEYS.clientSecret, body.clientSecret === '' ? '' : encrypt(body.clientSecret));
    }
    if (body.redirectUri !== undefined) await upsertSetting(QBO_SETTING_KEYS.redirectUri, body.redirectUri);
    invalidateQboCache();
    const after = await loadQboConfig();
    const changed: string[] = [];
    if (before.environment !== after.environment) changed.push(`environment ${before.environment}→${after.environment}`);
    if (before.clientId !== after.clientId) changed.push('client id');
    if (body.clientSecret !== undefined && body.clientSecret !== SECRET_KEEP) changed.push(body.clientSecret ? 'client secret' : 'client secret cleared');
    if (before.redirectUriOverride !== after.redirectUriOverride) changed.push('redirect uri');
    await logAudit({
      userId: req.user!.userId,
      periodId: null,
      entityType: 'setting',
      entityId: null,
      action: 'update',
      description: `QuickBooks settings updated${changed.length ? `: ${changed.join(', ')}` : ''}`,
    });
    res.json({ data: await settingsPayload(), error: null });
  } catch (err) {
    sendServerError(res, err, 'qbo settings update');
  }
});

/**
 * Credential probe without a connection: Intuit's token endpoint answers a
 * bogus refresh with `invalid_grant` when the client id/secret are accepted
 * and `invalid_client` when they are not — that distinction is the test.
 */
qboIntegrationRouter.post('/settings/test', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = settingsSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  try {
    const cfg = await loadQboConfig();
    const clientId = (parsed.data.clientId ?? '').trim() || cfg.clientId;
    const supplied = parsed.data.clientSecret;
    const clientSecret = supplied === undefined || supplied === SECRET_KEEP || supplied === '' ? cfg.clientSecret : supplied;
    if (!clientId || !clientSecret) {
      res.json({ data: { ok: false, message: 'Enter a Client ID and Client Secret first.' }, error: null });
      return;
    }
    const started = Date.now();
    try {
      await refreshTokens({ clientId, clientSecret, refreshToken: 'vibe-tb-credential-probe' });
      res.json({ data: { ok: true, message: 'Intuit accepted the credentials.' }, error: null, meta: { latencyMs: Date.now() - started } });
    } catch (err) {
      if (err instanceof QboOAuthError && err.kind === 'invalid_grant') {
        res.json({
          data: { ok: true, message: 'Intuit accepted the credentials. Connect a client to authorize a company.' },
          error: null,
          meta: { latencyMs: Date.now() - started },
        });
        return;
      }
      const message =
        err instanceof QboOAuthError && err.status === 401
          ? 'Intuit rejected the Client ID / Client Secret (invalid_client). Check the key set matches the selected environment.'
          : err instanceof Error
            ? err.message
            : String(err);
      res.json({ data: { ok: false, message }, error: null, meta: { latencyMs: Date.now() - started } });
    }
  } catch (err) {
    sendServerError(res, err, 'qbo settings test');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Connect / pending / bind / discard (admin)
// ─────────────────────────────────────────────────────────────────────────
qboIntegrationRouter.post('/connect', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ clientId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  try {
    const cfg = await loadQboConfig();
    if (!cfg.configured) {
      res.status(409).json({ data: null, error: { code: 'QBO_NOT_CONFIGURED', message: 'Enter the Intuit app credentials and save before connecting a client.' } });
      return;
    }
    const client = await db('clients').where({ id: parsed.data.clientId }).first('id', 'name');
    if (!client) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found.' } });
      return;
    }
    const raw = randomBytes(32).toString('base64url');
    await db('qbo_oauth_states').insert({
      state_hash: hashState(raw),
      client_id: client.id,
      user_id: req.user!.userId,
      environment: cfg.environment,
      redirect_uri: cfg.redirectUri,
      expires_at: new Date(Date.now() + STATE_TTL_MS),
    });
    res.json({
      data: { authorizeUrl: buildAuthorizeUrl({ clientId: cfg.clientId, redirectUri: cfg.redirectUri, state: raw }) },
      error: null,
    });
  } catch (err) {
    sendServerError(res, err, 'qbo connect');
  }
});

interface PendingRow {
  id: number;
  client_id: number;
  user_id: number;
  environment: string;
  realm_id: string | null;
  company_name: string | null;
  token_payload_enc: string | null;
  pending_expires_at: Date | string | null;
  bound_at: Date | string | null;
  discarded_at: Date | string | null;
}

async function loadPending(id: number, userId: number): Promise<{ row: PendingRow | null; problem: string | null }> {
  const row = (await db('qbo_oauth_states').where({ id }).first()) as PendingRow | undefined;
  if (!row || row.user_id !== userId) return { row: null, problem: 'Pending authorization not found.' };
  if (row.bound_at) return { row, problem: 'This authorization was already bound.' };
  if (row.discarded_at) return { row, problem: 'This authorization was discarded.' };
  if (!row.realm_id || !row.token_payload_enc) return { row, problem: 'This authorization did not complete.' };
  const exp = row.pending_expires_at ? new Date(row.pending_expires_at).getTime() : 0;
  if (exp < Date.now()) return { row, problem: 'This authorization expired before it was confirmed. Connect again.' };
  return { row, problem: null };
}

qboIntegrationRouter.get('/pending/:id', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id.' } });
    return;
  }
  try {
    const { row, problem } = await loadPending(id, req.user!.userId);
    if (!row || problem) {
      res.status(row ? 410 : 404).json({ data: null, error: { code: 'PENDING_UNAVAILABLE', message: problem ?? 'Not found.' } });
      return;
    }
    const client = await db('clients').where({ id: row.client_id }).first('id', 'name');
    const existing = (await db('qbo_connections').where({ client_id: row.client_id }).first('realm_id', 'company_name')) as
      | { realm_id: string; company_name: string | null }
      | undefined;
    const elsewhere = (await db('qbo_connections')
      .join('clients', 'clients.id', 'qbo_connections.client_id')
      .where({ 'qbo_connections.environment': row.environment, 'qbo_connections.realm_id': row.realm_id })
      .whereNot('qbo_connections.client_id', row.client_id)
      .first('clients.name as name')) as { name: string } | undefined;
    res.json({
      data: {
        id: row.id,
        clientId: row.client_id,
        clientName: client?.name ?? '',
        companyName: row.company_name,
        realmId: row.realm_id,
        environment: row.environment,
        replacesCompany: existing && existing.realm_id !== row.realm_id ? existing.company_name ?? existing.realm_id : null,
        boundElsewhereTo: elsewhere?.name ?? null,
      },
      error: null,
    });
  } catch (err) {
    sendServerError(res, err, 'qbo pending');
  }
});

qboIntegrationRouter.post('/pending/:id/bind', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id.' } });
    return;
  }
  try {
    const { row, problem } = await loadPending(id, req.user!.userId);
    if (!row || problem) {
      res.status(row ? 410 : 404).json({ data: null, error: { code: 'PENDING_UNAVAILABLE', message: problem ?? 'Not found.' } });
      return;
    }
    const cfg = await loadQboConfig();
    if (row.environment !== cfg.environment) {
      res.status(409).json({
        data: null,
        error: { code: 'QBO_ENV_CHANGED', message: `This authorization was made under ${row.environment}; QuickBooks is now set to ${cfg.environment}. Connect again.` },
      });
      return;
    }
    const elsewhere = (await db('qbo_connections')
      .join('clients', 'clients.id', 'qbo_connections.client_id')
      .where({ 'qbo_connections.environment': row.environment, 'qbo_connections.realm_id': row.realm_id })
      .whereNot('qbo_connections.client_id', row.client_id)
      .first('clients.name as name')) as { name: string } | undefined;
    if (elsewhere) {
      // No silent move: the other client's binding is deliberate until an admin disconnects it.
      res.status(409).json({
        data: null,
        error: { code: 'QBO_REALM_BOUND_ELSEWHERE', message: `This QuickBooks company is already connected to client "${elsewhere.name}". Disconnect it there first.` },
      });
      return;
    }

    let payload: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string };
    try {
      payload = JSON.parse(decrypt(row.token_payload_enc!));
    } catch {
      res.status(410).json({ data: null, error: { code: 'PENDING_UNAVAILABLE', message: 'Stored authorization could not be read. Connect again.' } });
      return;
    }

    let realmChanged = false;
    let connectionId = 0;
    let replacedRefreshEnc: string | null = null;
    await db.transaction(async (trx) => {
      const claimed = await trx('qbo_oauth_states')
        .where({ id: row.id })
        .whereNull('bound_at')
        .whereNull('discarded_at')
        .update({ bound_at: trx.fn.now() });
      if (!claimed) throw new QboConnectionError('NOT_FOUND', 'This authorization was already used.');

      const existing = (await trx('qbo_connections').where({ client_id: row.client_id }).first()) as QboConnectionRow | undefined;
      realmChanged = !!existing && existing.realm_id !== row.realm_id;
      if (realmChanged) replacedRefreshEnc = existing!.refresh_token_enc;
      const now = trx.fn.now();
      const values = {
        client_id: row.client_id,
        realm_id: row.realm_id!,
        company_name: row.company_name,
        environment: row.environment,
        status: 'active',
        access_token_enc: encrypt(payload.accessToken),
        access_token_expires_at: new Date(payload.accessTokenExpiresAt),
        refresh_token_enc: encrypt(payload.refreshToken),
        refresh_token_expires_at: new Date(payload.refreshTokenExpiresAt),
        first_authorized_at: existing && !realmChanged ? existing.first_authorized_at : now,
        last_refreshed_at: now,
        last_refresh_error: null,
        connected_by: req.user!.userId,
        bound_at: now,
        updated_at: now,
      };
      const [inserted] = (await trx('qbo_connections')
        .insert(values)
        .onConflict('client_id')
        .merge(Object.keys(values).filter((k) => k !== 'client_id'))
        .returning('id')) as Array<{ id: number }>;
      connectionId = inserted.id;

      if (realmChanged) {
        // Ids from the old company mean nothing in the new one; a stale link would match the wrong account.
        await trx('chart_of_accounts').where({ client_id: row.client_id }).update({ qbo_account_id: null });
      }
      // The parked tokens are now live on the connection; drop the copy.
      await trx('qbo_oauth_states').where({ id: row.id }).update({ token_payload_enc: null });

      await logAudit(
        {
          userId: req.user!.userId,
          periodId: null,
          clientId: row.client_id,
          entityType: 'qbo_connection',
          entityId: connectionId,
          action: existing ? 'update' : 'create',
          description: `QuickBooks company "${row.company_name ?? row.realm_id}" ${existing ? (realmChanged ? 'replaced the previous company on' : 're-authorized for') : 'connected to'} this client${realmChanged ? ' (account links cleared)' : ''}`,
        },
        trx,
      );
    });

    // A DIFFERENT company's grant was replaced: nothing here uses it any more, so
    // tell Intuit (best effort). Same-company re-auths do not revoke — Intuit
    // revokes per app+company, which would kill the grant we just stored.
    if (replacedRefreshEnc) await revokeEncryptedToken(replacedRefreshEnc);
    res.json({ data: { connectionId, realmChanged }, error: null });
  } catch (err) {
    if (err instanceof QboConnectionError) {
      res.status(409).json({ data: null, error: { code: err.code, message: err.message } });
      return;
    }
    sendServerError(res, err, 'qbo bind');
  }
});

qboIntegrationRouter.post('/pending/:id/discard', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id.' } });
    return;
  }
  try {
    const row = (await db('qbo_oauth_states').where({ id }).first()) as PendingRow | undefined;
    if (!row || row.user_id !== req.user!.userId) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Pending authorization not found.' } });
      return;
    }
    const claimed = await db('qbo_oauth_states')
      .where({ id })
      .whereNull('bound_at')
      .whereNull('discarded_at')
      .update({ discarded_at: db.fn.now() });
    if (claimed && row.token_payload_enc && row.realm_id) {
      // Revoking would also kill a LIVE connection's grant for the same company: only revoke when nobody holds it.
      const live = await db('qbo_connections').where({ environment: row.environment, realm_id: row.realm_id }).first('id');
      if (!live) {
        try {
          const payload = JSON.parse(decrypt(row.token_payload_enc)) as { refreshToken: string };
          await revokeEncryptedToken(encrypt(payload.refreshToken));
        } catch {
          /* best effort */
        }
      }
      await db('qbo_oauth_states').where({ id }).update({ token_payload_enc: null });
    }
    res.json({ data: { discarded: claimed > 0 }, error: null });
  } catch (err) {
    sendServerError(res, err, 'qbo discard');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Connections
// ─────────────────────────────────────────────────────────────────────────
qboIntegrationRouter.get('/connections', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = await loadQboConfig();
    const rows = (await db('clients')
      .leftJoin('qbo_connections as qc', 'qc.client_id', 'clients.id')
      .where({ 'clients.is_active': true })
      .orderBy('clients.name')
      .select(
        'clients.id as client_id',
        'clients.name as client_name',
        'qc.id as connection_id',
        'qc.realm_id',
        'qc.company_name',
        'qc.environment',
        'qc.status',
        'qc.access_token_expires_at',
        'qc.refresh_token_expires_at',
        'qc.first_authorized_at',
        'qc.last_refreshed_at',
        'qc.last_refresh_error',
        'qc.last_import_at',
        'qc.bound_at',
      )) as Array<Record<string, unknown>>;
    const data = rows.map((r) => {
      const connected = r.connection_id !== null && r.connection_id !== undefined;
      const envMismatch = connected && r.environment !== cfg.environment;
      return {
        clientId: r.client_id,
        clientName: r.client_name,
        connectionId: connected ? r.connection_id : null,
        companyName: connected ? r.company_name : null,
        realmId: connected ? r.realm_id : null,
        environment: connected ? r.environment : null,
        status: !connected ? 'not_connected' : envMismatch ? 'needs_reauth' : r.status,
        statusDetail: envMismatch
          ? `Authorized under ${String(r.environment)}; QuickBooks is now set to ${cfg.environment}.`
          : connected
            ? (r.last_refresh_error as string | null)
            : null,
        accessTokenExpiresAt: connected ? r.access_token_expires_at : null,
        refreshTokenExpiresAt: connected ? r.refresh_token_expires_at : null,
        firstAuthorizedAt: connected ? r.first_authorized_at : null,
        lastRefreshedAt: connected ? r.last_refreshed_at : null,
        lastImportAt: connected ? r.last_import_at : null,
        boundAt: connected ? r.bound_at : null,
      };
    });
    res.json({ data, error: null, meta: { configured: cfg.configured, environment: cfg.environment } });
  } catch (err) {
    sendServerError(res, err, 'qbo connections');
  }
});

qboIntegrationRouter.delete('/connections/:id', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id.' } });
    return;
  }
  try {
    const conn = await loadConnection(id);
    if (!conn) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Connection not found.' } });
      return;
    }
    const revoked = await revokeEncryptedToken(conn.refresh_token_enc);
    await db('qbo_connections').where({ id }).del();
    await logAudit({
      userId: req.user!.userId,
      periodId: null,
      clientId: conn.client_id,
      entityType: 'qbo_connection',
      entityId: id,
      action: 'delete',
      description: `QuickBooks company "${conn.company_name ?? conn.realm_id}" disconnected${revoked ? '' : ' (Intuit revoke did not confirm)'}`,
    });
    res.json({ data: { deleted: true, revoked }, error: null });
  } catch (err) {
    sendServerError(res, err, 'qbo disconnect');
  }
});

qboIntegrationRouter.post('/connections/:id/test', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id.' } });
    return;
  }
  try {
    const conn = await loadConnection(id);
    if (!conn) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Connection not found.' } });
      return;
    }
    const started = Date.now();
    try {
      const api = await apiForConnection(conn);
      const info = await api.companyInfo();
      if (info.CompanyName && info.CompanyName !== conn.company_name) {
        await db('qbo_connections').where({ id }).update({ company_name: info.CompanyName.slice(0, 255), updated_at: db.fn.now() });
      }
      res.json({
        data: { ok: true, message: `Connected to "${info.CompanyName || conn.realm_id}".`, companyName: info.CompanyName },
        error: null,
        meta: { latencyMs: Date.now() - started },
      });
    } catch (err) {
      res.json({
        data: { ok: false, message: err instanceof Error ? err.message : String(err), code: err instanceof QboConnectionError ? err.code : null },
        error: null,
        meta: { latencyMs: Date.now() - started },
      });
    }
  } catch (err) {
    sendServerError(res, err, 'qbo connection test');
  }
});
