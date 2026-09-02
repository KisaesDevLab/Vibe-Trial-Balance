// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The opt-in AI pass of the QuickBooks import: for the QBO accounts that
 * neither an id, a number nor an exact name placed, ask which existing
 * account each one IS. Pure — the route feeds it and applies its answer.
 *
 * What leaves the building is the QBO account's name and Classification and
 * the chart of accounts' number, name and category. No client name, no
 * amounts, no ids that mean anything outside this import: the COA rows are
 * referred to by a per-call ordinal, not their database id, so the reply can
 * only name a candidate that was offered.
 *
 * The reply is a SUGGESTION: the route hands it to the preview, where it is
 * badged with its confidence and the reviewer confirms or changes it. Nothing
 * is written on the strength of it. Anything the model returns that is not a
 * candidate offered, that contradicts the QBO Classification, or that names
 * the same account twice is dropped here (`sanitizeSuggestions`) — a wrong
 * account is worse than an empty one.
 */
import { classificationToCategory, type MatchedRow } from './matcher';

export interface SuggestCandidate {
  id: number;
  account_number: string;
  account_name: string;
  category: string | null;
}

export type SuggestConfidence = 'high' | 'medium' | 'low';

export interface MatchSuggestion {
  rowKey: string;
  accountId: number;
  accountNumber: string;
  accountName: string;
  confidence: SuggestConfidence;
}

/** Rows per AI call — keeps one call well inside the router's proxy timeout. */
export const QBO_SUGGEST_BATCH_SIZE = 40;

export function buildSuggestPrompt(rows: MatchedRow[], candidates: SuggestCandidate[]): string {
  const qboLines = rows
    .map((r) => `${r.rowKey}|${r.qboFullName.replace(/\|/g, '/')}|${r.classification ?? ''}`)
    .join('\n');
  const coaLines = candidates
    .map((c, i) => `${i + 1}|${c.account_number}|${c.account_name.replace(/\|/g, '/')}|${c.category ?? ''}`)
    .join('\n');

  return `You are an expert accountant reconciling two charts of accounts for the same business.

The QuickBooks Online accounts below have no account numbers, so they could not be matched by number. For each one, decide whether one of the existing accounts in the client's chart of accounts is the SAME account under a different name (for example "Bank Service Charges" and "Bank Charges", or "Office Supplies & Software" and "Office Supplies").

QuickBooks accounts (format: key|name|classification — a name written as Parent:Child is a sub-account):
\`\`\`
${qboLines}
\`\`\`

Existing chart of accounts (format: candidate#|account_number|account_name|category):
\`\`\`
${coaLines}
\`\`\`

Return ONLY a valid JSON array (no prose, no markdown, no code fences), one element per QuickBooks account, with this exact structure:
[
  { "key": "12", "candidate": 7, "confidence": "high" },
  { "key": "13", "candidate": null, "confidence": "low" }
]

Rules:
- candidate: the candidate# of the existing account that is the same account, or null when none is. Never invent a number that is not listed.
- confidence: "high" when the names clearly describe the same account, "medium" when they plausibly do, "low" when it is a guess. When in doubt, return null — a wrong match moves a balance into the wrong account, an empty one only means the reviewer picks it by hand.
- A candidate may be used for at most ONE QuickBooks account. If two QuickBooks accounts both look like the same existing account, keep the better one and return null for the other.
- The category must agree: an Asset can only match an assets account, a Liability a liabilities account, Equity equity, Revenue revenue, Expense expenses.
- Do not match a parent account to the account of one of its children, or a sub-account to its parent's account, unless the names are the same.
- Include every key exactly once.`;
}

interface RawSuggestion {
  key?: unknown;
  candidate?: unknown;
  confidence?: unknown;
}

function isConfidence(v: unknown): v is SuggestConfidence {
  return v === 'high' || v === 'medium' || v === 'low';
}

const RANK: Record<SuggestConfidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * Turn the model's reply into suggestions the preview can show. Drops: keys
 * that were not asked about, candidate numbers not offered, category
 * contradictions, and every claim after the first (best) on one candidate.
 */
export function sanitizeSuggestions(raw: unknown, rows: MatchedRow[], candidates: SuggestCandidate[]): MatchSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const rowByKey = new Map(rows.map((r) => [r.rowKey, r]));
  const best = new Map<number, MatchSuggestion>();
  const seenKeys = new Set<string>();
  for (const item of raw as RawSuggestion[]) {
    if (!item || typeof item !== 'object') continue;
    const key = typeof item.key === 'number' ? String(item.key) : typeof item.key === 'string' ? item.key : null;
    if (!key || seenKeys.has(key)) continue;
    const row = rowByKey.get(key);
    if (!row) continue;
    seenKeys.add(key);
    const ordinal = typeof item.candidate === 'number' ? item.candidate : typeof item.candidate === 'string' ? Number(item.candidate) : NaN;
    if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > candidates.length) continue;
    const c = candidates[ordinal - 1];
    const typed = classificationToCategory(row.classification);
    if (typed && c.category && c.category !== typed.category) continue;
    const confidence: SuggestConfidence = isConfidence(item.confidence) ? item.confidence : 'low';
    const prev = best.get(c.id);
    if (prev && RANK[prev.confidence] >= RANK[confidence]) continue;
    best.set(c.id, { rowKey: key, accountId: c.id, accountNumber: c.account_number, accountName: c.account_name, confidence });
  }
  // Report in row order so the preview applies them top to bottom.
  const order = new Map(rows.map((r, i) => [r.rowKey, i]));
  return [...best.values()].sort((a, b) => (order.get(a.rowKey) ?? 0) - (order.get(b.rowKey) ?? 0));
}
