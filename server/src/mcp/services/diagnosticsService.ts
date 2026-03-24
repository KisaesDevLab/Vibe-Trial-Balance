import { db } from '../../db';
import { logAiUsage } from '../../lib/aiUsage';
import { getLLMProvider } from '../../lib/aiClient';
import { extractJsonArray } from '../../lib/aiJsonExtract';

function parseBigInt(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

export interface DiagnosticObservation {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
}

export async function runDiagnostics(periodId: number): Promise<{ observations: DiagnosticObservation[]; periodId: number } | { error: string }> {
  const period = await db('periods as p')
    .join('clients as c', 'c.id', 'p.client_id')
    .where('p.id', periodId)
    .first('p.period_name', 'p.start_date', 'p.end_date', 'p.locked_at', 'c.name as client_name', 'c.entity_type');

  if (!period) return { error: 'Period not found' };

  const tbRows = await db('v_adjusted_trial_balance').where({ period_id: periodId, is_active: true });

  const jeCounts = await db('journal_entries')
    .where({ period_id: periodId })
    .select('entry_type')
    .count('* as n')
    .groupBy('entry_type');

  const unclassifiedCount = await db('bank_transactions as bt')
    .where('bt.client_id', db.raw('(SELECT client_id FROM periods WHERE id = ?)', [periodId]))
    .where('bt.classification_status', 'unclassified')
    .count('bt.id as n')
    .first();

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

  const totalUnadjDr = tbSummary.reduce((s: number, r: { unadj_dr: number }) => s + r.unadj_dr, 0);
  const totalUnadjCr = tbSummary.reduce((s: number, r: { unadj_cr: number }) => s + r.unadj_cr, 0);
  const totalBkAdjDr = tbSummary.reduce((s: number, r: { bk_adj_dr: number }) => s + r.bk_adj_dr, 0);
  const totalBkAdjCr = tbSummary.reduce((s: number, r: { bk_adj_cr: number }) => s + r.bk_adj_cr, 0);

  const jeCountMap: Record<string, number> = {};
  for (const row of jeCounts) jeCountMap[String(row.entry_type)] = Number(row.n);

  const prompt = `You are a tax and accounting reviewer. Analyze this trial balance period and return a JSON array of diagnostic observations.

Entity type: ${period.entity_type}
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

Focus on: 1. Balance check 2. Large CY vs PY variances (>20% or >$10,000) 3. Accounts with unexpected normal balance direction 4. Unclassified bank transactions 5. Missing or zero-balance accounts 6. Other notable observations

Return 5-15 observations.`;

  try {
    const { provider, fastModel } = await getLLMProvider();
    const aiResult = await provider.complete({
      model: fastModel,
      maxTokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    logAiUsage({ endpoint: 'mcp/diagnostics', model: fastModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: null, clientId: null });

    const observations = extractJsonArray<DiagnosticObservation>(aiResult.text);
    if (!observations) throw new Error('AI returned invalid format');
    return { observations, periodId };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
