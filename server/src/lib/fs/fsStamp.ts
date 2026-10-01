// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Staleness of a finalized statement set.
 *
 * `fsSourceStamp` is a SHA-256 over everything the engine reads: balances,
 * accounts and their lead sheets, equity roles, cash-flow classes, the dates
 * and the names that print. A content hash rather than a timestamp or a
 * change counter, for the reasons spelled out on `leadSheetBalanceStamp`:
 * deleting a journal entry LOWERS max(updated_at), and a restore rewrites
 * every timestamp.
 *
 * The stamp says "something the statements are built from moved". Whether
 * the issued NUMBERS moved is a second question, answered by `numbersHash`
 * over the rendered model — renaming an account that sits inside a one-line
 * lead sheet changes the stamp and not the statements.
 */

import crypto from 'crypto';
import type { FsRenderedReport, FsSourceData } from './engine';

/** JSON with object keys sorted at every level, so key order never moves a hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** The 'v1' prefix lets a later change to the serialization invalidate every stored stamp on purpose. */
export function fsSourceStamp(source: Omit<FsSourceData, 'sourceStamp'>): string {
  const { accounts, groupings, cashFlowOverrides, ...rest } = source as FsSourceData;
  const body = {
    ...rest,
    sourceStamp: undefined,
    // Order is presentation, not content.
    accounts: [...accounts].sort((a, b) => a.id.localeCompare(b.id)),
    groupings: [...groupings]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((g) => ({ ...g, accountIds: [...g.accountIds].sort() })),
    cashFlowOverrides: [...cashFlowOverrides]
      .sort((a, b) => `${a.accountId}|${a.groupingId}`.localeCompare(`${b.accountId}|${b.groupingId}`)),
  };
  return sha256(`v1\n${canonicalJson(body)}`);
}

/** What was issued: titles, date lines, column labels, captions and values. */
export function fsNumbersHash(model: FsRenderedReport): string {
  const parts: string[] = [];
  for (const st of [...model.statements, ...model.schedules]) {
    parts.push(`#${st.kind}|${st.scheduleNo ?? ''}|${st.title}|${st.dateLine}|${st.columns.map((c) => `${c.label}/${c.sublabel ?? ''}/${c.kind}`).join(',')}`);
    for (const r of st.rows) {
      if (r.kind === 'blank' || r.kind === 'page_break') continue;
      parts.push(`${r.kind}|${r.caption}|${r.values.map((v) => (v === null ? '' : String(v))).join(',')}`);
    }
  }
  return sha256(`v1\n${parts.join('\n')}`);
}
