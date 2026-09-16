// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Operator backstop: clear a user's second factors from the server itself.
 *
 *   npm run reset-2fa -- <username>          (dev, via tsx)
 *   node dist/reset-2fa.js <username>        (production build)
 *   docker compose exec api node dist/reset-2fa.js <username>
 *
 * For the firm whose ONLY admin lost their authenticator: there is no web
 * path to this on purpose — it needs a shell on the box, the same trust level
 * as the database. Removes TOTP, every passkey, every remembered browser and
 * any half-finished passkey challenge, and writes an audit row.
 *
 * Exit codes: 0 done · 1 usage · 2 user not found / refused · 3 failure.
 */

import 'dotenv/config';
import { db } from './db';
import { resetTwoFactor } from './lib/twoFactorReset';

async function main(): Promise<number> {
  const username = process.argv[2]?.trim();
  if (!username || process.argv.length > 3) {
    console.error('Usage: reset-2fa <username>');
    return 1;
  }
  if (username === 'mcp_agent') {
    console.error('mcp_agent is a system account with no sign-in; nothing to reset.');
    return 2;
  }
  const user = await db('app_users').where({ username }).first('id', 'username', 'is_active');
  if (!user) {
    console.error(`No user named "${username}".`);
    return 2;
  }
  const r = await resetTwoFactor(user.id as number, { actorUserId: null, via: 'cli' });
  console.log(
    `Reset 2FA for "${r.username}": ` +
      `${r.totpRemoved ? 'authenticator app removed' : 'no authenticator app'}, ` +
      `${r.passkeysRemoved} passkey(s) removed, ${r.trustedBrowsersRevoked} remembered browser(s) revoked.`,
  );
  console.log('The user can now sign in with their password alone' +
    (user.is_active ? '.' : ' once the account is reactivated.'));
  return 0;
}

main()
  .then((code) => db.destroy().then(() => process.exit(code)))
  .catch(async (err) => {
    console.error(`reset-2fa failed: ${err instanceof Error ? err.message : String(err)}`);
    try { await db.destroy(); } catch { /* ignore */ }
    process.exit(3);
  });
