import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const glPeriodRouter = Router({ mergeParams: true });
glPeriodRouter.use(authMiddleware);

// GET /api/v1/periods/:periodId/general-ledger
// Returns one entry per account that has either a TB balance or JE activity,
// with the unadjusted TB balance and all JE lines for the period.
glPeriodRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }

  try {
    // TB opening balances (unadjusted per-books amounts)
    const tbRows = await db('trial_balance as tb')
      .join('chart_of_accounts as coa', 'coa.id', 'tb.account_id')
      .where('tb.period_id', periodId)
      .select(
        'coa.id as account_id',
        'coa.account_number',
        'coa.account_name',
        'coa.category',
        'coa.normal_balance',
        'tb.unadjusted_debit',
        'tb.unadjusted_credit',
      )
      .orderBy('coa.account_number');

    // All JE lines for the period
    const jeLines = await db('journal_entry_lines as jel')
      .join('journal_entries as je', 'je.id', 'jel.journal_entry_id')
      .join('chart_of_accounts as coa', 'coa.id', 'jel.account_id')
      .where('je.period_id', periodId)
      .select(
        'coa.id as account_id',
        'coa.account_number',
        'coa.account_name',
        'coa.category',
        'coa.normal_balance',
        'je.id as journal_entry_id',
        'je.entry_date',
        'je.entry_number',
        'je.entry_type',
        'je.description',
        'jel.debit',
        'jel.credit',
      )
      .orderBy(['coa.account_number', 'je.entry_date', 'je.entry_number']);

    // Index TB rows by account_id
    interface TBRow { account_id: number; account_number: string; account_name: string; category: string; normal_balance: string; unadjusted_debit: unknown; unadjusted_credit: unknown; }
    interface JELine { account_id: number; account_number: string; account_name: string; category: string; normal_balance: string; journal_entry_id: number; entry_date: string; entry_number: number; entry_type: string; description: string | null; debit: unknown; credit: unknown; }

    const tbMap = new Map<number, TBRow>();
    for (const row of tbRows as TBRow[]) tbMap.set(row.account_id, row);

    // Collect all unique accounts (TB + JE), preserving sort
    const accountOrder = new Map<number, { account_id: number; account_number: string; account_name: string; category: string; normal_balance: string }>();
    for (const row of tbRows as TBRow[]) {
      if (!accountOrder.has(row.account_id)) accountOrder.set(row.account_id, row);
    }
    for (const line of jeLines as JELine[]) {
      if (!accountOrder.has(line.account_id)) accountOrder.set(line.account_id, line);
    }

    // Group JE lines by account_id
    const linesByAccount = new Map<number, JELine[]>();
    for (const line of jeLines as JELine[]) {
      const existing = linesByAccount.get(line.account_id) ?? [];
      existing.push(line);
      linesByAccount.set(line.account_id, existing);
    }

    // Build result sorted by account_number
    const accounts = [...accountOrder.values()].sort((a, b) =>
      a.account_number.localeCompare(b.account_number),
    );

    const result = accounts.map((acct) => {
      const tb = tbMap.get(acct.account_id);
      const lines = (linesByAccount.get(acct.account_id) ?? []).map((l) => ({
        journal_entry_id: l.journal_entry_id,
        entry_date: l.entry_date,
        entry_number: l.entry_number,
        entry_type: l.entry_type,
        description: l.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }));
      return {
        account_id: acct.account_id,
        account_number: acct.account_number,
        account_name: acct.account_name,
        category: acct.category,
        normal_balance: acct.normal_balance,
        unadjusted_debit: tb ? Number(tb.unadjusted_debit) : 0,
        unadjusted_credit: tb ? Number(tb.unadjusted_credit) : 0,
        lines,
      };
    });

    res.json({ data: result, error: null, meta: { count: result.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
