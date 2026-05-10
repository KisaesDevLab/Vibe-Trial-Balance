// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import nodemailer, { Transporter } from 'nodemailer';
import { db } from '../db';
import { decrypt, isEncrypted } from './encryption';

export type MailTransport = 'smtp' | 'postmark' | 'emailit';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
  /** Free-text label used in logs / "transport: smtp (from DB)" hints. */
  describe(): string;
}

export interface MailConfig {
  transport: MailTransport;
  from: string;
  smtp?: { host: string; port: number; user?: string; pass?: string; secure?: boolean };
  postmark?: { token: string };
  emailit?: { apiKey: string; apiUrl?: string };
}

const SETTING_KEYS = [
  'mail.transport',
  'mail.from',
  'mail.smtp_host',
  'mail.smtp_port',
  'mail.smtp_user',
  'mail.smtp_password',
  'mail.smtp_secure',
  'mail.postmark_token',
  'mail.emailit_api_key',
  'mail.emailit_api_url',
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

async function loadDbSettings(): Promise<Partial<Record<SettingKey, string>>> {
  try {
    const rows = await db('settings').whereIn('key', SETTING_KEYS as readonly string[]).select('key', 'value');
    const out: Partial<Record<SettingKey, string>> = {};
    for (const row of rows) {
      if (!row.value) continue;
      out[row.key as SettingKey] = row.value as string;
    }
    return out;
  } catch (err) {
    console.error('[mail] failed to load settings from DB:', (err as Error).message);
    return {};
  }
}

function decryptIfNeeded(value: string | undefined): string {
  if (!value) return '';
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value; // legacy plaintext or different key — return as-is
  }
}

/** Read the effective mail config: DB takes precedence over env. Returns null
 *  if no transport is configured anywhere. */
export async function loadMailConfig(): Promise<MailConfig | null> {
  const dbVals = await loadDbSettings();

  // Transport: DB wins, then env. Empty/whitespace counts as unset.
  const transport = ((dbVals['mail.transport'] || process.env.MAIL_TRANSPORT || '').trim().toLowerCase()) as MailTransport | '';
  if (!transport) return null;
  if (transport !== 'smtp' && transport !== 'postmark' && transport !== 'emailit') {
    console.error(`[mail] unknown transport "${transport}"`);
    return null;
  }

  const from = (dbVals['mail.from'] || process.env.MAIL_FROM || '').trim();
  if (!from) {
    console.error('[mail] MAIL_FROM (or settings mail.from) is required');
    return null;
  }

  const cfg: MailConfig = { transport, from };

  if (transport === 'smtp') {
    const host = (dbVals['mail.smtp_host'] || process.env.SMTP_HOST || '').trim();
    if (!host) {
      console.error('[mail] SMTP_HOST is required when transport=smtp');
      return null;
    }
    const portRaw = (dbVals['mail.smtp_port'] || process.env.SMTP_PORT || '587').trim();
    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      console.error(`[mail] invalid SMTP port "${portRaw}"`);
      return null;
    }
    const user = (dbVals['mail.smtp_user'] || process.env.SMTP_USER || '').trim() || undefined;
    const pass =
      decryptIfNeeded(dbVals['mail.smtp_password']) ||
      process.env.SMTP_PASS ||
      undefined;
    const secureRaw = (dbVals['mail.smtp_secure'] ?? process.env.SMTP_SECURE ?? '').toLowerCase();
    const secure = secureRaw === 'true';
    cfg.smtp = { host, port, user, pass, secure };
  } else if (transport === 'postmark') {
    const token =
      decryptIfNeeded(dbVals['mail.postmark_token']) ||
      process.env.POSTMARK_TOKEN ||
      '';
    if (!token) {
      console.error('[mail] POSTMARK_TOKEN is required when transport=postmark');
      return null;
    }
    cfg.postmark = { token };
  } else {
    const apiKey =
      decryptIfNeeded(dbVals['mail.emailit_api_key']) ||
      process.env.EMAILIT_API_KEY ||
      '';
    if (!apiKey) {
      console.error('[mail] EMAILIT_API_KEY is required when transport=emailit');
      return null;
    }
    const apiUrl = (dbVals['mail.emailit_api_url'] || process.env.EMAILIT_API_URL || '').trim() || undefined;
    cfg.emailit = { apiKey, apiUrl };
  }

  return cfg;
}

function buildSmtpFromCfg(cfg: MailConfig): Mailer {
  const s = cfg.smtp!;
  const transporter: Transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: !!s.secure,
    auth: s.user ? { user: s.user, pass: s.pass ?? '' } : undefined,
  });
  return {
    async send(msg) {
      await transporter.sendMail({
        from: cfg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    },
    describe() {
      return `smtp ${s.host}:${s.port}`;
    },
  };
}

function buildPostmarkFromCfg(cfg: MailConfig): Mailer {
  const token = cfg.postmark!.token;
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
          From: cfg.from,
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
    describe() {
      return 'postmark';
    },
  };
}

function buildEmailitFromCfg(cfg: MailConfig): Mailer {
  const e = cfg.emailit!;
  const baseUrl = (e.apiUrl || 'https://api.emailit.com/v1').replace(/\/$/, '');
  return {
    async send(msg) {
      const res = await fetch(`${baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${e.apiKey}`,
        },
        body: JSON.stringify({
          from: cfg.from,
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
    describe() {
      return `emailit ${baseUrl}`;
    },
  };
}

function buildMailerFromConfig(cfg: MailConfig): Mailer {
  if (cfg.transport === 'smtp') return buildSmtpFromCfg(cfg);
  if (cfg.transport === 'postmark') return buildPostmarkFromCfg(cfg);
  return buildEmailitFromCfg(cfg);
}

// Memoized so we don't hit the DB on every reset request, but invalidated
// any time an admin saves the mail-provider settings card.
let cached: Mailer | null | undefined;

/**
 * Returns the configured mailer, or null when no transport is configured
 * (no DB row, no env vars). Always returns the same instance until
 * invalidateMailerCache() is called.
 */
export async function getMailer(): Promise<Mailer | null> {
  if (cached !== undefined) return cached;
  const cfg = await loadMailConfig();
  cached = cfg ? buildMailerFromConfig(cfg) : null;
  return cached;
}

/** True when a mailer is configured. Used by /api/v1/features. */
export async function isMailerConfigured(): Promise<boolean> {
  return (await getMailer()) !== null;
}

/** Drop the cached mailer so the next getMailer() re-reads settings. Call
 *  this from any handler that mutates a `mail.*` setting. */
export function invalidateMailerCache(): void {
  cached = undefined;
}

/** Build a one-off mailer from an explicit config — used by the test-send
 *  endpoint so the admin can validate edits without persisting them first. */
export function buildMailerFor(cfg: MailConfig): Mailer {
  return buildMailerFromConfig(cfg);
}
