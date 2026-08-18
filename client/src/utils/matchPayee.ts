// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import type { Payee } from '../api/bankTransactions';

export type PayeeMatchHow = 'ai' | 'exact' | 'normalized' | 'prefix' | 'tokens';

export interface PayeeMatch {
  payee: Payee;
  /** 0..1 — how sure we are this description means this payee. */
  confidence: number;
  how: PayeeMatchHow;
}

const NOISE_WORDS = new Set(['inc', 'llc', 'co', 'corp', 'ltd', 'the', 'and', 'of']);

/** Lowercase, strip punctuation and corporate suffixes, collapse whitespace. */
export function normalizePayeeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(' ')
    .trim();
}

/** Category the register would pre-fill for a payee: rule first, then most-used. */
export function resolvePayeeAccount(p: Payee | null | undefined): number | null {
  if (!p) return null;
  return p.ruleAccountId ?? p.categories[0]?.accountId ?? null;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Best-effort match of a free-text (possibly hand-written / AI-transcribed)
 * description to one of the client's known payees. `aiMatched` is the name the
 * extraction model picked from the hint list, if any — it wins when it exists.
 * Returns null when nothing clears the 0.6 bar.
 */
export function matchPayee(description: string, payees: Payee[], aiMatched?: string | null): PayeeMatch | null {
  const desc = description.trim();
  if (!desc || payees.length === 0) return null;

  if (aiMatched) {
    const p = payees.find((x) => x.payee === aiMatched) ?? payees.find((x) => x.payee.toLowerCase() === aiMatched.toLowerCase());
    if (p) return { payee: p, confidence: 0.9, how: 'ai' };
  }

  const exact = payees.find((p) => p.payee === desc);
  if (exact) return { payee: exact, confidence: 1, how: 'exact' };

  const nd = normalizePayeeName(desc);
  if (!nd) return null;

  const normalizedEq = payees.find((p) => normalizePayeeName(p.payee) === nd);
  if (normalizedEq) return { payee: normalizedEq, confidence: 0.95, how: 'normalized' };

  // Ties are broken by the longer normalized payee name (more specific match).
  let best: (PayeeMatch & { _len: number }) | null = null;
  const consider = (m: PayeeMatch, len: number) => {
    if (!best || m.confidence > best.confidence || (m.confidence === best.confidence && len > best._len)) best = { ...m, _len: len };
  };
  const descTokens = new Set(nd.split(' '));

  for (const p of payees) {
    const np = normalizePayeeName(p.payee);
    if (!np) continue;
    // Whole-token prefix only. A known payee leading the description is a good
    // sign ("deposit" ← "deposit - sales", "amazon" ← "amazon order 4412"); a
    // description leading a LONGER payee is only trusted when the description
    // has at least two words ("fuel pump" → "fuel pump repairs", but never
    // "fuel" → "fuel pump repairs").
    if (nd.length >= 4 && np.length >= 4) {
      if (nd.startsWith(np + ' ')) { consider({ payee: p, confidence: 0.8, how: 'prefix' }, np.length); continue; }
      if (descTokens.size >= 2 && np.startsWith(nd + ' ')) { consider({ payee: p, confidence: 0.7, how: 'prefix' }, np.length); continue; }
    }
    const npTokens = new Set(np.split(' '));
    // Jaccard on single-token names is all-or-nothing and already handled by the normalized-equal rule.
    if (descTokens.size < 2 || npTokens.size < 2) continue;
    const j = jaccard(descTokens, npTokens);
    if (j >= 0.6) consider({ payee: p, confidence: 0.5 + 0.25 * j, how: 'tokens' }, np.length);
  }
  const found = best as (PayeeMatch & { _len: number }) | null; // assigned inside the closure above
  return found ? { payee: found.payee, confidence: found.confidence, how: found.how } : null;
}
