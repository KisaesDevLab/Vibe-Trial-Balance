// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * User invitations. `sendUserInvite` is the single entry point for both the
 * first send and every resend — the two differ only in the email's wording
 * and the audit action, both derived from whether invited_at is already set.
 *
 * An invite token is the same hashed, single-use row as a password reset
 * (purpose='invite', longer TTL) so the existing /auth/password-reset/verify
 * and /confirm endpoints accept it unchanged.
 */

import crypto from 'crypto';
import { db } from '../db';
import { getMailer } from './mailService';
import { logAudit } from './periodGuard';
import { actionButton, buildTokenUrl, escapeHtml, fallbackLink } from './mailTemplates';

/** Invites are long-lived — a new hire may not check mail for days. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteFailureReason =
  | 'not_found'
  | 'inactive'
  | 'no_email'
  | 'mail_not_configured'
  | 'send_failed';

export type InviteResult =
  | { sent: true; resend: boolean; email: string; expiresAt: string }
  | { sent: false; reason: InviteFailureReason; message: string };

export interface SendInviteOptions {
  /** Admin performing the send, for the audit trail. */
  invitedByUserId?: number | null;
  requesterIp?: string | null;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function formatValidity(): string {
  return 'valid for 7 days';
}

function buildInviteEmail(
  displayName: string,
  username: string,
  link: string,
  resend: boolean,
): { subject: string; html: string; text: string } {
  const subject = resend
    ? 'Your Vibe TB invitation (resent)'
    : "You've been invited to Vibe TB";
  const lead = resend
    ? 'Here is a fresh link to finish setting up your Vibe TB account — any earlier link no longer works.'
    : 'An account has been created for you in Vibe TB. Set a password to activate it.';

  const text = [
    `Hi ${displayName},`,
    '',
    lead,
    '',
    `Your username is: ${username}`,
    '',
    `Set your password (${formatValidity()}):`,
    link,
    '',
    "If you weren't expecting this, you can ignore this email — the account stays inactive until a password is set.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>${escapeHtml(lead)}</p>
    <p style="color:#555;font-size:13px">Your username is <strong>${escapeHtml(username)}</strong>.</p>
    ${actionButton('Set your password', link)}
    ${fallbackLink(link, formatValidity())}
    <p style="color:#555;font-size:13px">If you weren't expecting this, you can ignore this email — the account stays inactive until a password is set.</p>
  `;

  return { subject, html, text };
}

/**
 * Issue a fresh invite token for a user and email it. Safe to call repeatedly:
 * every call invalidates the user's outstanding tokens first, so only the
 * newest link works.
 *
 * Never throws for an expected condition (no email on file, mailer not
 * configured, provider rejected the send) — callers get a typed result so
 * they can surface an accurate message instead of a 500.
 */
export async function sendUserInvite(userId: number, opts: SendInviteOptions = {}): Promise<InviteResult> {
  const user = await db('app_users')
    .where({ id: userId })
    .first('id', 'username', 'display_name', 'email', 'is_active', 'invited_at', 'invite_accepted_at');

  if (!user) {
    return { sent: false, reason: 'not_found', message: 'User not found.' };
  }
  if (!user.is_active) {
    return { sent: false, reason: 'inactive', message: 'Reactivate this user before sending an invite.' };
  }
  if (!user.email) {
    return { sent: false, reason: 'no_email', message: 'This user has no email address on file. Add one first.' };
  }

  const mailer = await getMailer();
  if (!mailer) {
    return {
      sent: false,
      reason: 'mail_not_configured',
      message: 'No mail transport is configured. Set one up under Settings → Email.',
    };
  }

  const resend = !!user.invited_at;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // One live token per user: retire everything outstanding, then issue.
  await db.transaction(async (trx) => {
    await trx('password_reset_tokens')
      .where({ user_id: user.id, consumed_at: null })
      .update({ consumed_at: trx.fn.now() });
    await trx('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
      requester_ip: opts.requesterIp ?? null,
      purpose: 'invite',
    });
  });

  const link = buildTokenUrl('/invite/accept', rawToken);
  const { subject, html, text } = buildInviteEmail(
    user.display_name || user.username,
    user.username,
    link,
    resend,
  );

  try {
    await mailer.send({ to: user.email, subject, html, text });
  } catch (err) {
    console.error('[invite] mail send failed:', (err as Error).message);
    // The token stays live — the admin can retry without the user losing the
    // (unsent) link, and the next send supersedes it anyway.
    return {
      sent: false,
      reason: 'send_failed',
      message: 'The invite could not be delivered. Check the mail settings and try again.',
    };
  }

  await db('app_users').where({ id: user.id }).update({ invited_at: db.fn.now() });

  await logAudit({
    userId: opts.invitedByUserId ?? null,
    periodId: null,
    entityType: 'user',
    entityId: user.id,
    action: resend ? 'invite_resent' : 'invite_sent',
    description: `${resend ? 'Resent' : 'Sent'} invite email for "${user.username}"`,
  });

  return { sent: true, resend, email: user.email, expiresAt: expiresAt.toISOString() };
}
