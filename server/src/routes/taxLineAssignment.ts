// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { aiComplete, markAiUsageParseError } from '../lib/aiComplete';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { TB_TASK_CLASSES } from '../lib/routerProvider';
import { extractJsonArray, salvageJsonArray } from '../lib/aiJsonExtract';
import { sendServerError } from '../lib/safeError';
import { buildHistoryBuckets, rankHistoryMatches, type HistoryBuckets, type HistoryRow } from '../lib/taxCodeHistory';
import { selectCatalogForBatch, shortlistCodes } from '../lib/taxCodeShortlist';
import { mapWithConcurrency } from '../lib/concurrency';

export const taxLineAssignmentRouter = Router();
taxLineAssignmentRouter.use(authMiddleware);

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTITY_TO_RETURN_FORM: Record<string, string> = {
  '1040_C': '1040',
  '1065': '1065',
  '1120': '1120',
  '1120S': '1120S',
};

interface AccountRow {
  id: number;
  account_number: string;
  account_name: string;
  category: string;
  normal_balance: string;
  tax_code_id: number | null;
  tax_line: string | null;
  tax_line_source: string | null;
  tax_line_confidence: number | null;
}

interface TaxCodeRow {
  id: number;
  tax_code: string;
  description: string;
  return_form: string;
  activity_type: string;
  sort_order: number;
}

interface SuggestionResult {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: string;
  suggestedTaxCodeId: number | null;
  suggestedTaxCode: string | null;
  suggestedDescription: string | null;
  confidence: number;
  source: 'existing' | 'prior_period' | 'cross_client' | 'firm_history' | 'ai' | 'unmappable';
  reasoning: string;
}

/**
 * Every confirmed name → code mapping in the firm for one entity type, grouped
 * so the history stage can fold spellings together in memory. One query per
 * auto-assign request, loaded only when an account actually reaches that stage.
 */
async function loadFirmHistory(entityType: string): Promise<HistoryBuckets> {
  const rows: Array<{ account_name: string; tax_code_id: number; count: string | number; client_ids: number[] | null }> =
    await db('chart_of_accounts as coa')
      .join('clients as c', 'c.id', 'coa.client_id')
      .where('c.entity_type', entityType)
      .where('coa.is_active', true)
      .whereNotNull('coa.tax_code_id')
      .groupBy('coa.account_name', 'coa.tax_code_id')
      .select('coa.account_name', 'coa.tax_code_id')
      .count('* as count')
      .select(db.raw('array_agg(DISTINCT coa.client_id) as client_ids'));
  const history: HistoryRow[] = rows.map((r) => ({
    account_name: r.account_name,
    tax_code_id: r.tax_code_id,
    count: Number(r.count),
    client_ids: r.client_ids ?? [],
  }));
  return buildHistoryBuckets(history);
}

// ── POST /api/v1/tax-lines/auto-assign ───────────────────────────────────────

// Callers should page this by `accountIds` rather than asking for a whole COA
// at once (TaxMappingPage uses AUTO_ASSIGN_CHUNK_SIZE). Each account costs two
// lookups in the waterfall below, and whatever falls through to step (d) is a
// tb_tax_code_assign call; on a large unmapped COA the total runs past the
// ~100s proxy timeout in front of the AI router and the caller just sees a 524.
/**
 * Step b in bulk: for each account number, the tax code of the most recently
 * updated row on this client that carries one. One query for the whole chunk.
 */
async function loadPriorPeriodMappings(clientId: number, accountNumbers: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const numbers = Array.from(new Set(accountNumbers));
  if (numbers.length === 0) return out;
  const rows = await db('chart_of_accounts')
    .where({ client_id: clientId })
    .whereIn('account_number', numbers)
    .whereNotNull('tax_code_id')
    .orderBy('updated_at', 'desc')
    .select('account_number', 'tax_code_id') as Array<{ account_number: string; tax_code_id: number }>;
  for (const r of rows) {
    if (!out.has(r.account_number)) out.set(r.account_number, r.tax_code_id);
  }
  return out;
}

function normalizeCrossClientName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Step c in bulk: for each normalized account name, the tax code most other
 * clients of this entity type map it to, with the count of accounts agreeing.
 * Ties break on the lower tax code id so the answer is stable across runs.
 */
async function loadCrossClientMappings(
  clientId: number,
  entityType: string,
  accountNames: string[],
): Promise<Map<string, { taxCodeId: number; cnt: number }>> {
  const out = new Map<string, { taxCodeId: number; cnt: number }>();
  const names = Array.from(new Set(accountNames.map(normalizeCrossClientName))).filter((n) => n.length > 0);
  if (names.length === 0) return out;
  const placeholders = names.map(() => '?').join(', ');
  const rows = await db('chart_of_accounts as coa')
    .join('clients as c', 'c.id', 'coa.client_id')
    .where('c.entity_type', entityType)
    .where('coa.is_active', true)
    .whereNotNull('coa.tax_code_id')
    .whereNot('coa.client_id', clientId)
    .whereRaw('LOWER(TRIM(coa.account_name)) IN (' + placeholders + ')', names)
    .groupByRaw('LOWER(TRIM(coa.account_name)), coa.tax_code_id')
    .select(db.raw('LOWER(TRIM(coa.account_name)) as norm'), 'coa.tax_code_id')
    .count('* as cnt') as Array<{ norm: string; tax_code_id: number; cnt: string | number }>;
  for (const r of rows) {
    const cnt = Number(r.cnt);
    const cur = out.get(r.norm);
    if (!cur || cnt > cur.cnt || (cnt === cur.cnt && r.tax_code_id < cur.taxCodeId)) {
      out.set(r.norm, { taxCodeId: r.tax_code_id, cnt });
    }
  }
  return out;
}

// The AI step batches at BATCH_SIZE internally as well, which guards against
// output truncation but does nothing for total request time.

taxLineAssignmentRouter.post('/auto-assign', async (req: AuthRequest, res: Response): Promise<void> => {
  const { clientId, accountIds, includeAll } = req.body as {
    clientId?: number;
    accountIds?: number[];
    includeAll?: boolean;
  };

  if (!clientId || isNaN(Number(clientId))) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId is required' } });
    return;
  }

  try {
    // Load client
    const client = await db('clients')
      .where({ id: clientId })
      .first('id', 'entity_type', 'activity_type', 'name');
    if (!client) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }

    const entityType: string = client.entity_type ?? '1065';
    const activityType: string = client.activity_type ?? 'business';
    const resolvedReturnForm = ENTITY_TO_RETURN_FORM[entityType] ?? 'common';

    // Load accounts to process
    let accountQuery = db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true });

    if (!includeAll && accountIds && accountIds.length > 0) {
      accountQuery = accountQuery.whereIn('id', accountIds);
    } else if (!includeAll) {
      // Default: only unmapped accounts
      accountQuery = accountQuery.whereNull('tax_code_id');
    }

    const accounts: AccountRow[] = await accountQuery.select(
      'id', 'account_number', 'account_name', 'category', 'normal_balance',
      'tax_code_id', 'tax_line', 'tax_line_source', 'tax_line_confidence'
    );

    if (accounts.length === 0) {
      res.json({ data: { suggestions: [], totalProcessed: 0 }, error: null });
      return;
    }

    // Load available tax codes for this entity (plus any common/common codes)
    const taxCodes: TaxCodeRow[] = await db('tax_codes')
      .where('is_active', true)
      .where(function () {
        this.where(function () {
          this.where('return_form', resolvedReturnForm).where('activity_type', activityType);
        }).orWhere(function () {
          this.where('return_form', 'common').where('activity_type', 'common');
        });
      })
      .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'tax_code', order: 'asc' }])
      .select('id', 'tax_code', 'description', 'return_form', 'activity_type', 'sort_order');

    const taxCodeMap = new Map<string, TaxCodeRow>();
    for (const tc of taxCodes) {
      taxCodeMap.set(tc.tax_code, tc);
    }
    const taxCodeById = new Map<number, TaxCodeRow>();
    for (const tc of taxCodes) {
      taxCodeById.set(tc.id, tc);
    }

    const suggestions: SuggestionResult[] = [];
    const needsAi: AccountRow[] = [];
    const catalogIds = new Set(taxCodes.map((tc) => tc.id));
    let firmHistory: HistoryBuckets | null = null;

    // Steps b and c used to run two queries per account, in sequence — on a
    // 200-account COA that was 400 round trips before the AI even started.
    // Both tiers are answered from one query per request instead.
    const unmapped = accounts.filter((a) => a.tax_code_id === null);
    const priorByNumber = await loadPriorPeriodMappings(clientId, unmapped.map((a) => a.account_number));
    const crossByName = await loadCrossClientMappings(clientId, entityType, unmapped.map((a) => a.account_name));

    for (const account of accounts) {
      // Step a: existing mapping
      if (account.tax_code_id !== null) {
        const tc = taxCodeById.get(account.tax_code_id);
        suggestions.push({
          accountId: account.id,
          accountNumber: account.account_number,
          accountName: account.account_name,
          category: account.category,
          suggestedTaxCodeId: account.tax_code_id,
          suggestedTaxCode: tc?.tax_code ?? account.tax_line,
          suggestedDescription: tc?.description ?? null,
          confidence: 1.0,
          source: 'existing',
          reasoning: 'Already has a tax code assigned.',
        });
        continue;
      }

      // Step b: same-client prior periods (same account_number, same client, tax_code_id IS NOT NULL)
      const priorTaxCodeId = priorByNumber.get(account.account_number);
      if (priorTaxCodeId) {
        const tc = taxCodeById.get(priorTaxCodeId);
        if (tc) {
          suggestions.push({
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.account_name,
            category: account.category,
            suggestedTaxCodeId: tc.id,
            suggestedTaxCode: tc.tax_code,
            suggestedDescription: tc.description,
            confidence: 0.95,
            source: 'prior_period',
            reasoning: `Same account number previously mapped to ${tc.tax_code} for this client.`,
          });
          continue;
        }
      }

      // Step c: cross-client patterns
      const cross = crossByName.get(normalizeCrossClientName(account.account_name));
      if (cross) {
        const cnt = cross.cnt;
        if (cnt >= 2) {
          const tc = taxCodeById.get(cross.taxCodeId);
          if (tc) {
            const confidence = Math.min(0.90, cnt / (cnt + 2));
            suggestions.push({
              accountId: account.id,
              accountNumber: account.account_number,
              accountName: account.account_name,
              category: account.category,
              suggestedTaxCodeId: tc.id,
              suggestedTaxCode: tc.tax_code,
              suggestedDescription: tc.description,
              confidence,
              source: 'cross_client',
              reasoning: `${cnt} other ${entityType} clients map "${account.account_name}" to ${tc.tax_code}.`,
            });
            continue;
          }
        }
      }

      // Step c2: firm history — the same names, spelled the way this firm
      // spells them ("Advertising", "Advertising Expense", "6100 · Adv. Exp"),
      // matched by token similarity against every confirmed mapping for this
      // entity type. Deterministic and local: nothing leaves the box.
      if (!firmHistory) firmHistory = await loadFirmHistory(entityType);
      const hist = rankHistoryMatches(account.account_name, firmHistory, { allowedTaxCodeIds: catalogIds });
      if (hist) {
        const tc = taxCodeById.get(hist.taxCodeId);
        if (tc) {
          const where = hist.clientCount === 1 ? '1 client' : `${hist.clientCount} clients`;
          suggestions.push({
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.account_name,
            category: account.category,
            suggestedTaxCodeId: tc.id,
            suggestedTaxCode: tc.tax_code,
            suggestedDescription: tc.description,
            confidence: hist.confidence,
            source: 'firm_history',
            reasoning: `Firm history: "${hist.matchedName}" is mapped to ${tc.tax_code} on ${hist.count} account${hist.count === 1 ? '' : 's'} across ${where}${hist.similarity < 1 ? ' (similar name)' : ''}.`,
          });
          continue;
        }
      }

      needsAi.push(account);
    }

    // Step d: batch AI for remaining accounts
    if (needsAi.length > 0) {
      try {
        const { results: aiSuggestions, uncovered } = await getAiSuggestions(needsAi, taxCodes, entityType, activityType, { userId: req.user?.userId ?? null, userRole: req.user?.role ?? null, clientId });

        for (const account of needsAi) {
          const aiResult = aiSuggestions.get(account.account_number.trim());
          if (!aiResult || !aiResult.suggested_tax_code) {
            suggestions.push({
              accountId: account.id,
              accountNumber: account.account_number,
              accountName: account.account_name,
              category: account.category,
              suggestedTaxCodeId: null,
              suggestedTaxCode: null,
              suggestedDescription: null,
              confidence: 0,
              source: 'unmappable',
              reasoning: aiResult?.reasoning ?? uncovered ?? 'AI could not determine an appropriate tax code.',
            });
          } else {
            const tc = taxCodeMap.get(String(aiResult.suggested_tax_code).trim());
            if (!tc) {
              // Sanitize like the QBO match pass: a code the catalog never
              // offered is not a suggestion, it is a hallucination. Before
              // this it came back as source 'ai' with no id, and the modal
              // showed a code the confirm could never write.
              suggestions.push({
                accountId: account.id,
                accountNumber: account.account_number,
                accountName: account.account_name,
                category: account.category,
                suggestedTaxCodeId: null,
                suggestedTaxCode: null,
                suggestedDescription: null,
                confidence: 0,
                source: 'unmappable',
                reasoning: `AI proposed "${String(aiResult.suggested_tax_code).slice(0, 40)}", which is not in this client's tax code list.`,
              });
              continue;
            }
            suggestions.push({
              accountId: account.id,
              accountNumber: account.account_number,
              accountName: account.account_name,
              category: account.category,
              suggestedTaxCodeId: tc.id,
              suggestedTaxCode: tc.tax_code,
              suggestedDescription: tc.description,
              confidence: Math.min(1, Math.max(0, Number(aiResult.confidence) || 0.5)),
              source: 'ai',
              reasoning: aiResult.reasoning ?? '',
            });
          }
        }
      } catch (aiErr: unknown) {
        // If AI fails, mark all remaining as unmappable
        for (const account of needsAi) {
          suggestions.push({
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.account_name,
            category: account.category,
            suggestedTaxCodeId: null,
            suggestedTaxCode: null,
            suggestedDescription: null,
            confidence: 0,
            source: 'unmappable',
            reasoning: `AI error: ${aiErr instanceof Error ? aiErr.message : 'Unknown AI error'}`,
          });
        }
      }
    }

    res.json({
      data: {
        suggestions,
        totalProcessed: suggestions.length,
        bySource: {
          existing: suggestions.filter((s) => s.source === 'existing').length,
          prior_period: suggestions.filter((s) => s.source === 'prior_period').length,
          cross_client: suggestions.filter((s) => s.source === 'cross_client').length,
          firm_history: suggestions.filter((s) => s.source === 'firm_history').length,
          ai: suggestions.filter((s) => s.source === 'ai').length,
          unmappable: suggestions.filter((s) => s.source === 'unmappable').length,
        },
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'tax-assignment');
  }
});

// ── AI suggestion helper ──────────────────────────────────────────────────────

interface AiAccountInput {
  account_number: string;
  account_name: string;
  category: string;
  normal_balance: string;
}

/** What one account looks like in the prompt: the row plus its lexical hints. */
interface AiAccountPrompt extends AiAccountInput {
  /**
   * Per-call row handle (`r1`, `r2`, …) the reply is joined on. NOT the
   * account number: the router's scrubber redacts anything that looks like an
   * account number to an `[ACCOUNT]` token before the model sees it, so a
   * reply keyed by account_number came back with 25 of 30 keys identical and
   * matched nothing. A short letter-prefixed handle trips no detector.
   */
  ref: string;
  /** Up to LIKELY_PER_ACCOUNT tax_codes whose line label shares words with the name. */
  likely: string[];
}

/**
 * A client's catalog is ~100–135 seeded codes and goes into every batch
 * whole. Only a catalog past this size (custom codes on top of the seed) is
 * trimmed, and then to each account's shortlist plus the head of the list —
 * never the blind `slice(0, 200)` that used to sit here.
 */
const CATALOG_CAP = 180;
const LIKELY_PER_ACCOUNT = 5;

interface AiSuggestionOutput {
  ref?: string;
  account_number: string;
  suggested_tax_code: string | null;
  confidence: number;
  reasoning: string;
}

interface AiSuggestionsResult {
  /** Keyed by trimmed account_number — models return numbers as numbers, so the key is normalised. */
  results: Map<string, AiSuggestionOutput>;
  /** Set when at least one account never got a usable reply: the reason shown on those rows. */
  uncovered: string | null;
}

/**
 * Accounts per AI call. Small on purpose: the reply is one JSON element per
 * account and a reasoning model spends the same max_tokens budget on its
 * thinking first, so a big batch is cut off mid-array and every row in it
 * is lost. Accounts the first pass missed are retried once in RETRY_BATCH_SIZE.
 */
const BATCH_SIZE = 15;
const RETRY_BATCH_SIZE = 6;
/**
 * Batches in flight at once. They are independent (each joins its own refs),
 * so running them side by side divides the AI wall time by this factor; kept
 * modest so one request does not swamp the router's rate limit.
 */
const AI_BATCH_CONCURRENCY = 3;
/** Output budget per account plus headroom for the model's own reasoning tokens. */
const TOKENS_PER_ACCOUNT = 200;
const TOKENS_HEADROOM = 2048;

async function getAiSuggestions(
  accounts: AiAccountInput[],
  taxCodes: TaxCodeRow[],
  entityType: string,
  activityType: string,
  logCtx: { userId: number | null; userRole: string | null; clientId: number },
): Promise<AiSuggestionsResult> {
  const { provider, fastModel } = await getLLMProvider();
  const tokenSettings = await getAiTokenSettings();

  const entityRules = getEntityRules(entityType, activityType);

  const systemPrompt = `You are a tax accountant expert specializing in ${entityType} returns.
Your task is to assign the most appropriate tax code from the provided list to each account.

Entity type: ${entityType}
Activity type: ${activityType}

RULES:
${entityRules}

IMPORTANT:
- Return ONLY a JSON array, no prose before or after
- Use exact tax_code values from the provided list
- Each account carries a "likely" list: tax codes whose line label shares words with the account name. They are lexical hints, not answers — prefer one when it fits, ignore it when the name is misleading, and choose from the full list otherwise
- If no appropriate tax code exists, set suggested_tax_code to null
- Confidence: 0.0-1.0 (1.0 = certain, 0.7 = likely, 0.5 = best guess, 0.0 = unknown)
- Keep "reasoning" to one short clause, under 15 words
- Return each account's "ref" exactly as given; it is how the reply is matched to the account`;

  const results = new Map<string, AiSuggestionOutput>();
  let truncated = 0;
  let unreadable = 0;

  const runBatch = async (batch: AiAccountInput[], label: string): Promise<void> => {
    const maxTokens = Math.max(tokenSettings.maxTokensDefault, batch.length * TOKENS_PER_ACCOUNT + TOKENS_HEADROOM);

    const batchCatalog = selectCatalogForBatch(batch, taxCodes, CATALOG_CAP);
    const taxCodeList = batchCatalog.map((tc) => ({
      tax_code: tc.tax_code,
      description: tc.description,
      return_form: tc.return_form,
      activity_type: tc.activity_type,
    }));
    const batchPrompt: AiAccountPrompt[] = batch.map((a, idx) => ({
      ref: `r${idx + 1}`,
      ...a,
      likely: shortlistCodes(a, batchCatalog, LIKELY_PER_ACCOUNT).map((c) => c.tax_code),
    }));
    const byRef = new Map(batchPrompt.map((a) => [a.ref, a.account_number.trim()]));

    const userPrompt = `Available tax codes:
${JSON.stringify(taxCodeList, null, 2)}

Accounts to assign:
${JSON.stringify(batchPrompt, null, 2)}

Return a JSON array where each element has:
- ref: string (the account's "ref", exactly as given)
- suggested_tax_code: string | null (exact tax_code from the list, or null)
- confidence: number (0.0 to 1.0)
- reasoning: string (one short clause)`;

    const { result: aiResult, logId } = await aiComplete(
      provider,
      { model: fastModel, taskClass: TB_TASK_CLASSES.TAX_CODE_ASSIGN, maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
      { endpoint: 'tax/auto-assign', userId: logCtx.userId, userRole: logCtx.userRole, clientId: logCtx.clientId },
    );

    let parsed = extractJsonArray<AiSuggestionOutput>(aiResult.text);
    if (!parsed) {
      // A reply cut off at max_tokens (finish=length) is the common case with
      // a reasoning model: keep the rows it did finish and retry the rest,
      // instead of dropping the whole batch as "AI could not determine".
      const detail = `finish=${aiResult.stopReason ?? 'unknown'}, text[0..500]=${JSON.stringify(aiResult.text.slice(0, 500))}`;
      const salvaged = salvageJsonArray<AiSuggestionOutput>(aiResult.text);
      if (salvaged.items.length === 0) {
        unreadable++;
        console.error(`[taxLineAssignment] AI ${label} returned no JSON array:`, detail);
        markAiUsageParseError(logId, `${label} invalid JSON array. ${detail}`);
        return;
      }
      truncated++;
      console.warn(`[taxLineAssignment] AI ${label} reply cut off; kept ${salvaged.items.length} of ${batch.length} (${detail.slice(0, 120)})`);
      markAiUsageParseError(logId, `${label} reply truncated: ${salvaged.items.length}/${batch.length} rows salvaged. ${detail}`);
      parsed = salvaged.items;
    }
    let matched = 0;
    for (const r of parsed) {
      if (!r || typeof r !== 'object') continue;
      // Join on ref; fall back to account_number for a model that echoed that instead.
      const key = byRef.get(String(r.ref ?? '').trim()) ?? String(r.account_number ?? '').trim();
      if (!key || results.has(key)) continue;
      results.set(key, { ...r, account_number: key });
      matched++;
    }
    console.log(`[taxLineAssignment] AI ${label}: ${matched} suggestions for ${batch.length} accounts`);
  };

  const chunk = <T,>(list: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };

  await mapWithConcurrency(chunk(accounts, BATCH_SIZE), AI_BATCH_CONCURRENCY,
    (batch, idx) => runBatch(batch, `batch ${idx + 1}`));

  // One retry pass, in smaller batches, for whatever the first pass missed —
  // rows lost to truncation, an unreadable reply, or an account the model
  // simply skipped. Bounded: a second miss is reported, not retried again.
  const missed = accounts.filter((a) => !results.has(a.account_number.trim()));
  if (missed.length > 0) {
    console.warn(`[taxLineAssignment] ${missed.length} of ${accounts.length} accounts had no AI reply; retrying in batches of ${RETRY_BATCH_SIZE}`);
    await mapWithConcurrency(chunk(missed, RETRY_BATCH_SIZE), AI_BATCH_CONCURRENCY,
      (batch, idx) => runBatch(batch, `retry ${idx + 1}`));
  }

  const stillMissing = accounts.filter((a) => !results.has(a.account_number.trim()));
  let uncovered: string | null = null;
  if (stillMissing.length > 0) {
    uncovered = truncated > 0 || unreadable > 0
      ? `No usable AI reply for this account: the model's reply was ${truncated > 0 ? 'cut off at its token limit' : 'not a JSON array'} even on retry (see the AI usage log). Run auto-assign again for the remaining accounts.`
      : 'The AI reply did not include this account. Run auto-assign again for the remaining accounts.';
  }
  return { results, uncovered };
}

function getEntityRules(entityType: string, activityType: string): string {
  const common = [
    '- Meals and entertainment: note 50% limitation applies',
    '- Depreciation: use the appropriate depreciation code for the entity',
    '- Interest income: distinguish between business and investment interest',
    '- Accounts with "DONOTMAP", "do not map", partner capital, or shareholder loan in name: set suggested_tax_code to null',
  ];

  const entitySpecific: Record<string, string[]> = {
    '1065': [
      '- Guaranteed payments to partners: use code for guaranteed payments (look for "guaranteed payment" in description)',
      '- Partner capital accounts (capital, drawing, distributions): set to null (DONOTMAP)',
      '- Partner loans/receivables: set to null',
      '- Rental income/expenses if activity_type is rental: use Form 8825 codes where available',
      '- Self-employment tax: not applicable for partnerships',
    ],
    '1120S': [
      '- Officer compensation (officer salary, officer wages): use officer compensation code',
      '- Shareholder distributions: set to null (DONOTMAP)',
      '- Shareholder loans: set to null (DONOTMAP)',
      '- Built-in gains: use appropriate code if available',
    ],
    '1120': [
      '- Dividends received: use dividends received deduction code if available',
      '- Net operating loss: use NOL carryforward code',
      '- Estimated tax payments: balance sheet item',
    ],
    '1040_C': [
      '- Schedule C: use appropriate business codes',
      '- Home office: use home office deduction code if available',
      '- Self-employment tax: use SE tax deduction code',
    ],
  };

  const rules = [...common];
  if (activityType === 'rental') {
    rules.push('- This is rental activity: prefer Form 8825 codes for rental property expenses');
  }
  if (activityType === 'farm' || activityType === 'farm_rental') {
    rules.push('- This is farm activity: prefer Schedule F codes');
  }

  const specific = entitySpecific[entityType] ?? [];
  return [...rules, ...specific].join('\n');
}

// ── PUT /api/v1/tax-lines/bulk-confirm ───────────────────────────────────────

taxLineAssignmentRouter.put('/bulk-confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  const { clientId, assignments } = req.body as {
    clientId?: number;
    assignments?: Array<{
      accountId: number;
      taxCodeId: number | null;
      source: string;
      confidence: number;
    }>;
  };

  if (!clientId || isNaN(Number(clientId))) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId is required' } });
    return;
  }
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'assignments array is required' } });
    return;
  }

  try {
    const results: Array<{ accountId: number; success: boolean; error?: string }> = [];

    // Pre-load valid tax codes once so each row's taxCodeId is validated
    // against the actual table, not just trusted from an AI payload. An AI
    // that hallucinates an id — or one that crosses return_form boundaries —
    // should be rejected per-row rather than crashing the whole batch on FK.
    const validTaxCodes = new Map<number, string>();
    {
      const rows = await db('tax_codes').select('id', 'tax_code');
      for (const r of rows as Array<{ id: number; tax_code: string }>) {
        validTaxCodes.set(r.id, r.tax_code);
      }
    }

    await db.transaction(async (trx) => {
      for (const assignment of assignments) {
        const { accountId, taxCodeId, source, confidence } = assignment;

        if (!accountId || isNaN(accountId)) {
          results.push({ accountId: accountId ?? 0, success: false, error: 'Invalid accountId' });
          continue;
        }

        let resolvedTaxLine: string | null = null;
        if (taxCodeId != null) {
          if (!validTaxCodes.has(taxCodeId)) {
            results.push({ accountId, success: false, error: `Invalid taxCodeId ${taxCodeId}` });
            continue;
          }
          resolvedTaxLine = validTaxCodes.get(taxCodeId) ?? null;
        }

        const finiteConfidence = typeof confidence === 'number' && Number.isFinite(confidence)
          ? Math.max(0, Math.min(1, confidence))
          : null;

        const updates: Record<string, unknown> = {
          tax_code_id: taxCodeId ?? null,
          tax_line: resolvedTaxLine,
          tax_line_source: source ?? 'ai',
          tax_line_confidence: finiteConfidence,
          updated_at: trx.fn.now(),
        };

        const [updated] = await trx('chart_of_accounts')
          .where({ id: accountId, client_id: Number(clientId) })
          .update(updates)
          .returning('id');

        if (updated) {
          results.push({ accountId, success: true });
        } else {
          results.push({ accountId, success: false, error: 'Account not found' });
        }
      }
    });

    const successCount = results.filter((r) => r.success).length;
    res.json({
      data: {
        results,
        updated: successCount,
        failed: results.length - successCount,
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'tax-assignment');
  }
});

// ── GET /api/v1/tax-lines/patterns/:accountName ───────────────────────────────

taxLineAssignmentRouter.get('/patterns/:accountName', async (req: AuthRequest, res: Response): Promise<void> => {
  const { accountName } = req.params;
  const entityType = (req.query.entityType as string) ?? undefined;

  if (!accountName) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'accountName is required' } });
    return;
  }

  try {
    const normalizedName = accountName.trim().toLowerCase();

    let query = db('chart_of_accounts as coa')
      .join('clients as c', 'c.id', 'coa.client_id')
      .join('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
      .where('coa.is_active', true)
      .whereNotNull('coa.tax_code_id')
      .whereRaw('LOWER(TRIM(coa.account_name)) = ?', [normalizedName]);

    if (entityType) {
      query = query.where('c.entity_type', entityType);
    }

    const rows = await query
      .groupBy('coa.tax_code_id', 'tc.tax_code', 'tc.description', 'tc.sort_order')
      .select('coa.tax_code_id', 'tc.tax_code', 'tc.description', 'tc.sort_order')
      .count('coa.id as cnt')
      .orderBy('cnt', 'desc')
      .limit(3);

    const patterns = rows.map((r: Record<string, unknown>) => ({
      taxCodeId: r.tax_code_id as number,
      taxCode: r.tax_code as string,
      description: r.description as string,
      sortOrder: r.sort_order as number,
      count: Number(r.cnt),
    }));

    res.json({ data: patterns, error: null, meta: { count: patterns.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'tax-assignment');
  }
});
