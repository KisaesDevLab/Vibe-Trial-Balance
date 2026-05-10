// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import nodemailer, { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

type Transport = 'smtp' | 'postmark' | 'emailit';

function readFromAddress(): string {
  const from = process.env.MAIL_FROM?.trim();
  if (!from) throw new Error('MAIL_FROM is not set');
  return from;
}

function buildSmtp(): Mailer {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim() || '587';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const secure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  if (!host) throw new Error('SMTP_HOST is required when MAIL_TRANSPORT=smtp');
  const port = Number(portRaw);
  if (!Number.isFinite(port)) throw new Error(`SMTP_PORT is not a number: ${portRaw}`);

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass || '' } : undefined,
  });

  const from = readFromAddress();
  return {
    async send(msg) {
      await transporter.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
  };
}

function buildPostmark(): Mailer {
  const token = process.env.POSTMARK_TOKEN?.trim();
  if (!token) throw new Error('POSTMARK_TOKEN is required when MAIL_TRANSPORT=postmark');
  const from = readFromAddress();
  return {
    async send(msg) {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: from,
          To: msg.to,
          Subject: msg.subject,
          TextBody: msg.text,
          HtmlBody: msg.html,
          MessageStream: 'outbound',
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Postmark send failed: ${res.status} ${body.slice(0, 200)}`);
      }
    },
  };
}

function buildEmailit(): Mailer {
  const apiKey = process.env.EMAILIT_API_KEY?.trim();
  if (!apiKey) throw new Error('EMAILIT_API_KEY is required when MAIL_TRANSPORT=emailit');
  const baseUrl = (process.env.EMAILIT_API_URL?.trim() || 'https://api.emailit.com/v1').replace(/\/$/, '');
  const from = readFromAddress();
  return {
    async send(msg) {
      const res = await fetch(`${baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Emailit send failed: ${res.status} ${body.slice(0, 200)}`);
      }
    },
  };
}

let cached: Mailer | null | undefined;

/**
 * Returns the configured mailer, or null when MAIL_TRANSPORT is unset / blank.
 * The caller (password reset request endpoint) must always respond 200 even
 * when this is null, to avoid leaking the mail-configuration state.
 */
export function getMailer(): Mailer | null {
  if (cached !== undefined) return cached;
  const transport = (process.env.MAIL_TRANSPORT?.trim().toLowerCase() || '') as Transport | '';
  if (!transport) {
    cached = null;
    return null;
  }
  try {
    if (transport === 'smtp') cached = buildSmtp();
    else if (transport === 'postmark') cached = buildPostmark();
    else if (transport === 'emailit') cached = buildEmailit();
    else {
      console.error(`[mail] unknown MAIL_TRANSPORT="${transport}" — ignoring`);
      cached = null;
    }
  } catch (err) {
    console.error(`[mail] transport ${transport} failed to initialize:`, (err as Error).message);
    cached = null;
  }
  return cached;
}

/** True when a mailer is configured. Used by /api/v1/features. */
export function isMailerConfigured(): boolean {
  return getMailer() !== null;
}

/** Test helper — clears the memoized mailer so tests can change env between cases. */
export function _resetMailerForTests(): void {
  cached = undefined;
}
