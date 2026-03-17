import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const diagnosticsRouter = Router({ mergeParams: true });
diagnosticsRouter.use(authMiddleware);

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await db('settings').where({ key: 'claude_api_key' }).first('value');
  const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Claude API key not configured');
  return new Anthropic({ apiKey });
}

function parseBigInt(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

// POST /api/v1/periods/:periodId/diagnostics
diagnosticsRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }

  try {
    // Gather period + client info
    const period = await db('periods as p')
      .join('clients as c', 'c.id', 'p.client_id')
      .where('p.id', periodId)
      .first('p.period_name', 'p.start_date', 'p.end_date', 'p.locked_at',
             'c.name as client_name', 'c.entity_type');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    // TB summary from view
    const tbRows = await db('v_adjusted_trial_balance')
      .where({ period_id: periodId, is_active: true });

    // JE counts
    const jeCounts = await db('journal_entries')
      .where({ period_id: periodId })
      .select('entry_type')
      .count('* as n')
      .groupBy('entry_type');

    // Unclassified bank txns
    const unclassifiedCount = await db('bank_transactions as bt')
      .join('periods as p', 'p.id', db.raw('?', [periodId]))
      .where('bt.client_id', db.raw('(SELECT client_id FROM periods WHERE id = ?)', [periodId]))
      .where('bt.classification_status', 'unclassified')
      .count('bt.id as n')
      .first();

    // Build structured summary for Claude
    const tbSummary = tbRows.map((r: Record<string, unknown>) => ({
      account: `${r.account_number} ${r.account_name}`,
      category: r.category,
      normal_balance: r.normal_balance,
      unadj_dr: parseBigInt(r.unadjusted_debit) / 100,
      unadj_cr: parseBigInt(r.unadjusted_credit) / 100,
      bk_adj_dr: parseBigInt(r.book_adjusted_debit) / 100,
      bk_adj_cr: parseBigInt(r.book_adjusted_credit) / 100,
      py_dr: parseBigInt(r.prior_year_debit) / 100,
      py_cr: parseBigInt(r.prior_year_credit) / 100,
    }));

    const totalUnadjDr  = tbSummary.reduce((s: number, r: { unadj_dr: number }) => s + r.unadj_dr, 0);
    const totalUnadjCr  = tbSummary.reduce((s: number, r: { unadj_cr: number }) => s + r.unadj_cr, 0);
    const totalBkAdjDr  = tbSummary.reduce((s: number, r: { bk_adj_dr: number }) => s + r.bk_adj_dr, 0);
    const totalBkAdjCr  = tbSummary.reduce((s: number, r: { bk_adj_cr: number }) => s + r.bk_adj_cr, 0);

    const jeCountMap: Record<string, number> = {};
    for (const row of jeCounts) jeCountMap[String(row.entry_type)] = Number(row.n);

    const prompt = `You are a tax and accounting reviewer. Analyze this trial balance period and return a JSON array of diagnostic observations.

Client: ${period.client_name} (${period.entity_type})
Period: ${period.period_name}${period.start_date ? ` (${period.start_date} to ${period.end_date})` : ''}
Period locked: ${period.locked_at ? 'Yes' : 'No'}

Journal Entries:
- Book AJEs: ${jeCountMap['book'] ?? 0}
- Tax AJEs: ${jeCountMap['tax'] ?? 0}
- Trans JEs: ${jeCountMap['trans'] ?? 0}
Unclassified bank transactions: ${Number((unclassifiedCount as Record<string, unknown>)?.n ?? 0)}

TB Totals:
- Unadjusted: Dr ${totalUnadjDr.toFixed(2)} / Cr ${totalUnadjCr.toFixed(2)} (${totalUnadjDr === totalUnadjCr ? 'BALANCED' : 'OUT OF BALANCE by ' + Math.abs(totalUnadjDr - totalUnadjCr).toFixed(2)})
- Book Adjusted: Dr ${totalBkAdjDr.toFixed(2)} / Cr ${totalBkAdjCr.toFixed(2)} (${totalBkAdjDr === totalBkAdjCr ? 'BALANCED' : 'OUT OF BALANCE by ' + Math.abs(totalBkAdjDr - totalBkAdjCr).toFixed(2)})

Account detail (all amounts in dollars):
${JSON.stringify(tbSummary, null, 2)}

Return ONLY a JSON array (no prose outside the array) of observation objects with these fields:
- severity: "error" | "warning" | "info"
- category: short category like "Balance Check", "Prior Year Variance", "Unclassified Items", "Missing Data", "Unusual Balance", etc.
- message: clear, concise description (1-2 sentences, be specific with account names and dollar amounts)

Focus on:
1. Balance check (TB in/out of balance)
2. Large CY vs PY variances (>20% or >$10,000)
3. Accounts with unexpected normal balance direction
4. Unclassified bank transactions
5. Missing or zero-balance accounts in key categories
6. Any other notable observations

Return 5-15 observations. Be specific and actionable.`;

    const anthropic = await getAnthropicClient();
    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (aiMessage.content[0] as { type: string; text: string }).text.trim();
    // Extract JSON array from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI returned invalid format');
    const observations = JSON.parse(jsonMatch[0]) as unknown[];

    res.json({ data: { observations, periodId }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
