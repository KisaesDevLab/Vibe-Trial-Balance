// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * QuickBooks OAuth helpers + settings resolution.
 * Run: npx tsx --test src/lib/__tests__/qboOauth.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import {
  buildAuthorizeUrl,
  classifyTokenError,
  exchangeCode,
  parseTokenResponse,
  QboOAuthError,
  refreshTokens,
  revokeToken,
  type FetchLike,
} from '../qbo/oauth';
import {
  defaultRedirectUri,
  intuitAppUrls,
  publicBaseFromRedirectUri,
  QBO_CALLBACK_PATH,
  QBO_SCOPE,
  redirectUriProblem,
  resolveQboConfig,
} from '../qbo/settings';

// tokenStore pulls in db + encryption; the secret must exist before require().
process.env.JWT_SECRET ??= 'test'.repeat(16);
const { hashState } = require('../qbo/tokenStore') as typeof import('../qbo/tokenStore');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('buildAuthorizeUrl carries exactly the Intuit parameters', () => {
  const url = new URL(buildAuthorizeUrl({ clientId: 'abc', redirectUri: 'https://tb.example.com' + QBO_CALLBACK_PATH, state: 's1' }));
  assert.equal(url.origin + url.pathname, 'https://appcenter.intuit.com/connect/oauth2');
  assert.equal(url.searchParams.get('client_id'), 'abc');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), QBO_SCOPE);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://tb.example.com' + QBO_CALLBACK_PATH);
  assert.equal(url.searchParams.get('state'), 's1');
  assert.equal([...url.searchParams.keys()].length, 5);
});

test('parseTokenResponse: expiries from seconds-from-now, defaults when absent, refresh token required', () => {
  const now = Date.UTC(2026, 0, 1);
  const t = parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, x_refresh_token_expires_in: 8726400 }, now);
  assert.equal(t.accessTokenExpiresAt.getTime(), now + 3600_000);
  assert.equal(t.refreshTokenExpiresAt.getTime(), now + 8726400_000);

  const d = parseTokenResponse({ access_token: 'a', refresh_token: 'r' }, now);
  assert.equal(d.accessTokenExpiresAt.getTime(), now + 3600_000);
  assert.equal(d.refreshTokenExpiresAt.getTime(), now + 100 * 86_400_000);

  assert.throws(() => parseTokenResponse({ access_token: 'a' }, now), QboOAuthError);
  assert.throws(() => parseTokenResponse({ refresh_token: 'r' }, now), QboOAuthError);
});

test('classifyTokenError', () => {
  assert.equal(classifyTokenError(400, { error: 'invalid_grant' }), 'invalid_grant');
  assert.equal(classifyTokenError(429, {}), 'transient');
  assert.equal(classifyTokenError(503, {}), 'transient');
  assert.equal(classifyTokenError(401, { error: 'invalid_client' }), 'fatal');
  assert.equal(classifyTokenError(400, { error: 'invalid_request' }), 'fatal');
});

test('exchangeCode posts a form with Basic auth and the snapshotted redirect URI', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(200, { access_token: 'A', refresh_token: 'R', expires_in: 10, x_refresh_token_expires_in: 20 });
  };
  const t = await exchangeCode({ clientId: 'id', clientSecret: 'sec', code: 'c0de', redirectUri: 'https://x/y', fetchImpl });
  assert.equal(t.accessToken, 'A');
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');
  const headers = init!.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Basic ${Buffer.from('id:sec').toString('base64')}`);
  const form = new URLSearchParams(String(init!.body));
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('code'), 'c0de');
  assert.equal(form.get('redirect_uri'), 'https://x/y');
});

test('refreshTokens surfaces invalid_grant as a typed error carrying only error/description', async () => {
  const fetchImpl: FetchLike = async () => jsonResponse(400, { error: 'invalid_grant', error_description: 'Token invalid', secret_field: 'never' });
  await assert.rejects(
    refreshTokens({ clientId: 'id', clientSecret: 'sec', refreshToken: 'dead', fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof QboOAuthError);
      assert.equal(err.kind, 'invalid_grant');
      assert.equal(err.status, 400);
      assert.equal(err.intuitError, 'invalid_grant: Token invalid');
      assert.ok(!err.message.includes('never'));
      return true;
    },
  );
});

test('revokeToken is best effort: true on 200, false on error or throw', async () => {
  const ok: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init!.body)) as { token: string };
    assert.equal(body.token, 'tok');
    return new Response(null, { status: 200 });
  };
  assert.equal(await revokeToken({ clientId: 'i', clientSecret: 's', token: 'tok', fetchImpl: ok }), true);
  const bad: FetchLike = async () => jsonResponse(400, { error: 'invalid_request' });
  assert.equal(await revokeToken({ clientId: 'i', clientSecret: 's', token: 'tok', fetchImpl: bad }), false);
  const boom: FetchLike = async () => {
    throw new Error('offline');
  };
  assert.equal(await revokeToken({ clientId: 'i', clientSecret: 's', token: 'tok', fetchImpl: boom }), false);
});

test('defaultRedirectUri / publicBaseFromRedirectUri round trip, base paths included', () => {
  for (const base of ['https://tb.firm.com', 'https://tb.firm.com/', 'http://localhost:5173', 'https://host/tb']) {
    const uri = defaultRedirectUri(base);
    assert.ok(uri.endsWith(QBO_CALLBACK_PATH));
    assert.equal(publicBaseFromRedirectUri(uri), base.replace(/\/+$/, ''));
  }
  assert.equal(publicBaseFromRedirectUri('https://host/other/path'), 'https://host');
});

test('redirectUriProblem', () => {
  assert.equal(redirectUriProblem('https://tb.firm.com' + QBO_CALLBACK_PATH), null);
  assert.equal(redirectUriProblem('https://tb.firm.com' + QBO_CALLBACK_PATH + '/'), null);
  assert.ok(redirectUriProblem('not a url'));
  assert.ok(redirectUriProblem('ftp://tb.firm.com' + QBO_CALLBACK_PATH));
  assert.ok(redirectUriProblem('https://tb.firm.com' + QBO_CALLBACK_PATH + '?x=1'));
  assert.ok(redirectUriProblem('https://tb.firm.com/api/v1/other'));
});

test('resolveQboConfig: settings rows beat env, env is a fallback, unconfigured otherwise', () => {
  const env = { QBO_CLIENT_ID: 'envid', QBO_CLIENT_SECRET: 'envsec', QBO_ENVIRONMENT: 'production' } as NodeJS.ProcessEnv;
  const fromDb = resolveQboConfig({ 'qbo.client_id': 'dbid', 'qbo.client_secret': 'dbsec' }, env, 'https://tb');
  assert.equal(fromDb.configured, true);
  assert.equal(fromDb.clientId, 'dbid');
  assert.equal(fromDb.envOverride, false);
  assert.equal(fromDb.environment, 'production'); // env still supplies the environment when the row is absent
  assert.equal(fromDb.redirectUri, 'https://tb' + QBO_CALLBACK_PATH);

  const fromEnv = resolveQboConfig({}, env, 'https://tb');
  assert.equal(fromEnv.configured, true);
  assert.equal(fromEnv.clientId, 'envid');
  assert.equal(fromEnv.envOverride, true);
  assert.equal(fromEnv.apiBaseUrl, 'https://quickbooks.api.intuit.com');

  const none = resolveQboConfig({}, {} as NodeJS.ProcessEnv, 'https://tb');
  assert.equal(none.configured, false);
  assert.equal(none.environment, 'sandbox');
  assert.equal(none.apiBaseUrl, 'https://sandbox-quickbooks.api.intuit.com');

  // A DB client id with no secret is "from DB" and NOT configured — env must not half-fill it.
  const half = resolveQboConfig({ 'qbo.client_id': 'dbid' }, env, 'https://tb');
  assert.equal(half.configured, false);
  assert.equal(half.clientSecret, '');

  // An invalid override is ignored in favour of the derived default.
  const badOverride = resolveQboConfig({ 'qbo.redirect_uri': 'https://x/nope' }, {} as NodeJS.ProcessEnv, 'https://tb');
  assert.equal(badOverride.redirectUri, 'https://tb' + QBO_CALLBACK_PATH);
  const goodOverride = resolveQboConfig({ 'qbo.redirect_uri': 'https://pub/tb' + QBO_CALLBACK_PATH }, {} as NodeJS.ProcessEnv, 'https://tb');
  assert.equal(goodOverride.redirectUri, 'https://pub/tb' + QBO_CALLBACK_PATH);
});

test('hashState is sha256 hex of the raw nonce', () => {
  assert.equal(hashState('abc'), createHash('sha256').update('abc').digest('hex'));
  assert.equal(hashState('abc').length, 64);
  assert.notEqual(hashState('abc'), hashState('abd'));
});

test('intuitAppUrls: every production-checklist address hangs off the public base, host domain is bare', () => {
  const u = intuitAppUrls('https://tb.example.com/tb/');
  assert.equal(u.hostDomain, 'tb.example.com');
  assert.equal(u.launchUrl, 'https://tb.example.com/tb/quickbooks');
  assert.equal(u.connectUrl, 'https://tb.example.com/tb/quickbooks');
  assert.equal(u.disconnectUrl, 'https://tb.example.com/tb/quickbooks?disconnected=1');
  assert.equal(u.privacyPolicyUrl, 'https://tb.example.com/tb/privacy');
  assert.equal(u.eulaUrl, 'https://tb.example.com/tb/terms');
  // Non-default port stays in the host domain; a base that is not a URL degrades without throwing.
  assert.equal(intuitAppUrls('https://tb.example.com:8443').hostDomain, 'tb.example.com:8443');
  assert.equal(intuitAppUrls('tb.example.com/x').hostDomain, 'tb.example.com');
  // Derived from the same base the callback redirects to, so the two can never disagree.
  const base = publicBaseFromRedirectUri(defaultRedirectUri('https://tb.example.com/tb'));
  assert.equal(intuitAppUrls(base).privacyPolicyUrl, 'https://tb.example.com/tb/privacy');
});
