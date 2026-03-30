import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { extractJsonArray } from '../lib/aiJsonExtract';

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
  source: 'existing' | 'prior_period' | 'cross_client' | 'ai' | 'unmappable';
  reasoning: string;
}

// ── POST /api/v1/tax-lines/auto-assign ───────────────────────────────────────

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

    // Load available tax codes for this entity (include common codes like REPORTING_ONLY)
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
      const priorMapping = await db('chart_of_accounts')
        .where({ client_id: clientId, account_number: account.account_number })
        .whereNotNull('tax_code_id')
        .orderBy('updated_at', 'desc')
        .first('tax_code_id');

      if (priorMapping?.tax_code_id) {
        const tc = taxCodeById.get(priorMapping.tax_code_id);
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
      const normalizedName = account.account_name.trim().toLowerCase();
      const crossClientRows = await db('chart_of_accounts as coa')
        .join('clients as c', 'c.id', 'coa.client_id')
        .where('c.entity_type', entityType)
        .where('coa.is_active', true)
        .whereNotNull('coa.tax_code_id')
        .whereNot('coa.client_id', clientId)
        .whereRaw('LOWER(TRIM(coa.account_name)) = ?', [normalizedName])
        .groupBy('coa.tax_code_id')
        .select('coa.tax_code_id')
        .count('* as cnt')
        .orderBy('cnt', 'desc')
        .limit(1);

      if (crossClientRows.length > 0 && crossClientRows[0]) {
        const row = crossClientRows[0] as { tax_code_id: number; cnt: string | number };
        const cnt = Number(row.cnt);
        if (cnt >= 2) {
          const tc = taxCodeById.get(row.tax_code_id);
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

      needsAi.push(account);
    }

    // Step d: batch AI for remaining accounts
    if (needsAi.length > 0) {
      try {
        const aiSuggestions = await getAiSuggestions(needsAi, taxCodes, entityType, activityType);

        for (const account of needsAi) {
          const aiResult = aiSuggestions.find((r) => r.account_number === account.account_number);
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
              reasoning: aiResult?.reasoning ?? 'AI could not determine an appropriate tax code.',
            });
          } else {
            const tc = taxCodeMap.get(aiResult.suggested_tax_code);
            suggestions.push({
              accountId: account.id,
              accountNumber: account.account_number,
              accountName: account.account_name,
              category: account.category,
              suggestedTaxCodeId: tc?.id ?? null,
              suggestedTaxCode: tc?.tax_code ?? aiResult.suggested_tax_code,
              suggestedDescription: tc?.description ?? null,
              confidence: Math.min(1, Math.max(0, aiResult.confidence ?? 0.5)),
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
          ai: suggestions.filter((s) => s.source === 'ai').length,
          unmappable: suggestions.filter((s) => s.source === 'unmappable').length,
        },
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── AI suggestion helper ──────────────────────────────────────────────────────

interface AiAccountInput {
  account_number: string;
  account_name: string;
  category: string;
  normal_balance: string;
}

interface AiSuggestionOutput {
  account_number: string;
  suggested_tax_code: string | null;
  confidence: number;
  reasoning: string;
}

async function getAiSuggestions(
  accounts: AiAccountInput[],
  taxCodes: TaxCodeRow[],
  entityType: string,
  activityType: string,
): Promise<AiSuggestionOutput[]> {
  const { provider, fastModel } = await getLLMProvider();
  const tokenSettings = await getAiTokenSettings();

  // Limit to top 200 most relevant tax codes to avoid token overload
  const taxCodeList = taxCodes.slice(0, 200).map((tc) => ({
    tax_code: tc.tax_code,
    description: tc.description,
    return_form: tc.return_form,
    activity_type: tc.activity_type,
    sort_order: tc.sort_order,
  }));

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
- If no appropriate tax code exists, set suggested_tax_code to null
- Confidence: 0.0-1.0 (1.0 = certain, 0.7 = likely, 0.5 = best guess, 0.0 = unknown)
- Reasoning should be 1-2 sentences explaining the choice`;

  // Batch accounts into groups of 30 to avoid output truncation
  const BATCH_SIZE = 30;
  const allResults: AiSuggestionOutput[] = [];

  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const maxTokens = Math.max(tokenSettings.maxTokensDefault, batch.length * 120);

    const userPrompt = `Available tax codes:
${JSON.stringify(taxCodeList, null, 2)}

Accounts to assign:
${JSON.stringify(batch, null, 2)}

Return a JSON array where each element has:
- account_number: string (the original account_number)
- suggested_tax_code: string | null (exact tax_code from the list, or null)
- confidence: number (0.0 to 1.0)
- reasoning: string (1-2 sentences)`;

    const aiResult = await provider.complete({
      model: fastModel,
      maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    logAiUsage({ endpoint: 'tax/auto-assign', model: fastModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: null, clientId: null });

    const parsed = extractJsonArray<AiSuggestionOutput>(aiResult.text);
    if (!parsed) {
      console.error(`[taxLineAssignment] AI batch ${Math.floor(i / BATCH_SIZE) + 1} returned non-array:`, aiResult.text.slice(0, 500));
      // Don't fail the whole run — skip this batch, caller will mark them unmappable
      continue;
    }
    allResults.push(...parsed);
    console.log(`[taxLineAssignment] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${parsed.length} suggestions from ${batch.length} accounts`);
  }

  return allResults;
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

    await db.transaction(async (trx) => {
      for (const assignment of assignments) {
        const { accountId, taxCodeId, source, confidence } = assignment;

        if (!accountId || isNaN(accountId)) {
          results.push({ accountId: accountId ?? 0, success: false, error: 'Invalid accountId' });
          continue;
        }

        const updates: Record<string, unknown> = {
          tax_code_id: taxCodeId ?? null,
          tax_line_source: source ?? 'ai',
          tax_line_confidence: confidence != null ? confidence : null,
          updated_at: trx.fn.now(),
        };

        // Dual-write: look up tax_code string
        if (taxCodeId != null) {
          const tc = await trx('tax_codes').where({ id: taxCodeId }).first('tax_code');
          updates.tax_line = tc?.tax_code ?? null;
        } else {
          updates.tax_line = null;
        }

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
