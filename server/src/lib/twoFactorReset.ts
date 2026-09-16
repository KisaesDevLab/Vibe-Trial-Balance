// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Remove every second factor a user has: TOTP, passkeys, remembered browsers
 * and any half-finished WebAuthn challenge. One transaction, one audit row.
 * Shared by the admin action on the Users page and the `reset-2fa` CLI (the
 * backstop for a firm whose only admin lost their authenticator).
 */

import { db } from '../db';
import { invalidateAuthCache } from '../middleware/auth';
import { logAudit } from './periodGuard';

export interface TwoFactorResetResult {
  totpRemoved: boolean;
  passkeysRemoved: number;
  trustedBrowsersRevoked: number;
}

export async function resetTwoFactor(
  userId: number,
  opts: { actorUserId: number | null; via: 'admin' | 'cli' },
): Promise<TwoFactorResetResult & { username: string }> {
  const user = await db('app_users').where({ id: userId }).first('id', 'username');
  if (!user) throw new Error(`User ${userId} not found`);

  const result = await db.transaction(async (trx) => {
    const totp = await trx('user_totp').where({ user_id: userId }).delete();
    const passkeys = await trx('user_passkeys').where({ user_id: userId }).delete();
    const browsers = await trx('trusted_browsers')
      .where({ user_id: userId })
      .whereNull('revoked_at')
      .update({ revoked_at: trx.fn.now() });
    await trx('webauthn_challenges').where({ user_id: userId }).delete();
    const r: TwoFactorResetResult = { totpRemoved: totp > 0, passkeysRemoved: passkeys, trustedBrowsersRevoked: browsers };
    await logAudit(
      {
        userId: opts.actorUserId,
        periodId: null,
        entityType: 'user',
        entityId: userId,
        action: 'two_factor_reset',
        description: `Reset 2FA for "${user.username}" via ${opts.via} — removed ${r.totpRemoved ? 'TOTP, ' : ''}${r.passkeysRemoved} passkey(s), revoked ${r.trustedBrowsersRevoked} trusted browser(s)`,
      },
      trx,
    );
    return r;
  });

  invalidateAuthCache(userId);
  return { ...result, username: user.username as string };
}
