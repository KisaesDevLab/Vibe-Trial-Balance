"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxLineAssignmentRouter = void 0;
const express_1 = require("express");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.taxLineAssignmentRouter = (0, express_1.Router)();
exports.taxLineAssignmentRouter.use(auth_1.authMiddleware);
// ── Helpers ───────────────────────────────────────────────────────────────────
async function getAnthropicClient() {
    const setting = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
    const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('Claude API key not configured');
    return new sdk_1.default({ apiKey });
}
const ENTITY_TO_RETURN_FORM = {
    '1040_C': '1040',
    '1065': '1065',
    '1120': '1120',
    '1120S': '1120S',
};
// ── POST /api/v1/tax-lines/auto-assign ───────────────────────────────────────
exports.taxLineAssignmentRouter.post('/auto-assign', async (req, res) => {
    const { clientId, accountIds, includeAll } = req.body;
    if (!clientId || isNaN(Number(clientId))) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId is required' } });
        return;
    }
    try {
        // Load client
        const client = await (0, db_1.db)('clients')
            .where({ id: clientId })
            .first('id', 'entity_type', 'activity_type', 'name');
        if (!client) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        const entityType = client.entity_type ?? '1065';
        const activityType = client.activity_type ?? 'business';
        const resolvedReturnForm = ENTITY_TO_RETURN_FORM[entityType] ?? 'common';
        // Load accounts to process
        let accountQuery = (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true });
        if (!includeAll && accountIds && accountIds.length > 0) {
            accountQuery = accountQuery.whereIn('id', accountIds);
        }
        else if (!includeAll) {
            // Default: only unmapped accounts
            accountQuery = accountQuery.whereNull('tax_code_id');
        }
        const accounts = await accountQuery.select('id', 'account_number', 'account_name', 'category', 'normal_balance', 'tax_code_id', 'tax_line', 'tax_line_source', 'tax_line_confidence');
        if (accounts.length === 0) {
            res.json({ data: { suggestions: [], totalProcessed: 0 }, error: null });
            return;
        }
        // Load available tax codes for this entity
        const taxCodes = await (0, db_1.db)('tax_codes')
            .where('is_active', true)
            .where(function () {
            this.where('return_form', resolvedReturnForm).orWhere('return_form', 'common');
        })
            .where(function () {
            this.where('activity_type', activityType).orWhere('activity_type', 'common');
        })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'tax_code', order: 'asc' }])
            .select('id', 'tax_code', 'description', 'return_form', 'activity_type', 'sort_order');
        const taxCodeMap = new Map();
        for (const tc of taxCodes) {
            taxCodeMap.set(tc.tax_code, tc);
        }
        const taxCodeById = new Map();
        for (const tc of taxCodes) {
            taxCodeById.set(tc.id, tc);
        }
        const suggestions = [];
        const needsAi = [];
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
            const priorMapping = await (0, db_1.db)('chart_of_accounts')
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
            const crossClientRows = await (0, db_1.db)('chart_of_accounts as coa')
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
                const row = crossClientRows[0];
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
                    }
                    else {
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
            }
            catch (aiErr) {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
async function getAiSuggestions(accounts, taxCodes, entityType, activityType) {
    const anthropic = await getAnthropicClient();
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
    const userPrompt = `Available tax codes:
${JSON.stringify(taxCodeList, null, 2)}

Accounts to assign:
${JSON.stringify(accounts, null, 2)}

Return a JSON array where each element has:
- account_number: string (the original account_number)
- suggested_tax_code: string | null (exact tax_code from the list, or null)
- confidence: number (0.0 to 1.0)
- reasoning: string (1-2 sentences)`;
    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });
    const raw = message.content[0].text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch)
        throw new Error('AI returned invalid format');
    return JSON.parse(jsonMatch[0]);
}
function getEntityRules(entityType, activityType) {
    const common = [
        '- Meals and entertainment: note 50% limitation applies',
        '- Depreciation: use the appropriate depreciation code for the entity',
        '- Interest income: distinguish between business and investment interest',
        '- Accounts with "DONOTMAP", "do not map", partner capital, or shareholder loan in name: set suggested_tax_code to null',
    ];
    const entitySpecific = {
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
exports.taxLineAssignmentRouter.put('/bulk-confirm', async (req, res) => {
    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'assignments array is required' } });
        return;
    }
    try {
        const results = [];
        await db_1.db.transaction(async (trx) => {
            for (const assignment of assignments) {
                const { accountId, taxCodeId, source, confidence } = assignment;
                if (!accountId || isNaN(accountId)) {
                    results.push({ accountId: accountId ?? 0, success: false, error: 'Invalid accountId' });
                    continue;
                }
                const updates = {
                    tax_code_id: taxCodeId ?? null,
                    tax_line_source: source ?? 'ai',
                    tax_line_confidence: confidence != null ? confidence : null,
                    updated_at: trx.fn.now(),
                };
                // Dual-write: look up tax_code string
                if (taxCodeId != null) {
                    const tc = await trx('tax_codes').where({ id: taxCodeId }).first('tax_code');
                    updates.tax_line = tc?.tax_code ?? null;
                }
                else {
                    updates.tax_line = null;
                }
                const [updated] = await trx('chart_of_accounts')
                    .where({ id: accountId })
                    .update(updates)
                    .returning('id');
                if (updated) {
                    results.push({ accountId, success: true });
                }
                else {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── GET /api/v1/tax-lines/patterns/:accountName ───────────────────────────────
exports.taxLineAssignmentRouter.get('/patterns/:accountName', async (req, res) => {
    const { accountName } = req.params;
    const entityType = req.query.entityType ?? undefined;
    if (!accountName) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'accountName is required' } });
        return;
    }
    try {
        const normalizedName = accountName.trim().toLowerCase();
        let query = (0, db_1.db)('chart_of_accounts as coa')
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
        const patterns = rows.map((r) => ({
            taxCodeId: r.tax_code_id,
            taxCode: r.tax_code,
            description: r.description,
            sortOrder: r.sort_order,
            count: Number(r.cnt),
        }));
        res.json({ data: patterns, error: null, meta: { count: patterns.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=taxLineAssignment.js.map