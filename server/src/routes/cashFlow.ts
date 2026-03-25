import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const cashFlowRouter = Router({ mergeParams: true });
cashFlowRouter.use(authMiddleware);

function bookNet(r: Record<string, unknown>): number {
  const dr = Number(r.book_adjusted_debit  ?? 0);
  const cr = Number(r.book_adjusted_credit ?? 0);
  return (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
}

function priorNet(r: Record<string, unknown>): number {
  const dr = Number(r.prior_year_debit  ?? 0);
  const cr = Number(r.prior_year_credit ?? 0);
  return (r.normal_balance as string) === 'debit' ? dr - cr : cr - dr;
}

function cashImpact(r: Record<string, unknown>): number {
  const change = bookNet(r) - priorNet(r);
  // Assets (debit normal): increase = use of cash (negative), decrease = source (positive)
  // Liabilities/Equity (credit normal): increase = source (positive), decrease = use (negative)
  return (r.normal_balance as string) === 'debit' ? -change : change;
}

// GET /api/v1/periods/:periodId/cash-flow
cashFlowRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  if (isNaN(periodId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
    return;
  }
  try {
    const rows = await db('v_adjusted_trial_balance as tb')
      .join('chart_of_accounts as c', 'c.id', 'tb.account_id')
      .where('tb.period_id', periodId)
      .where('tb.is_active', true)
      .select(
        'tb.account_id', 'tb.account_number', 'tb.account_name',
        'tb.category', 'tb.normal_balance',
        'tb.book_adjusted_debit', 'tb.book_adjusted_credit',
        'tb.prior_year_debit', 'tb.prior_year_credit',
        'c.cash_flow_category',
      );

    // Normalise bigint strings
    const parsed = rows.map(r => ({
      ...r,
      book_adjusted_debit:  Number(r.book_adjusted_debit  ?? 0),
      book_adjusted_credit: Number(r.book_adjusted_credit ?? 0),
      prior_year_debit:     Number(r.prior_year_debit     ?? 0),
      prior_year_credit:    Number(r.prior_year_credit    ?? 0),
    })) as Record<string, unknown>[];

    // Net income
    const netIncome = parsed.reduce((sum, r) => {
      if (r.category === 'revenue')  return sum + bookNet(r);
      if (r.category === 'expenses') return sum - bookNet(r);
      return sum;
    }, 0);

    // Non-cash add-backs (expense accounts tagged non_cash)
    const nonCashItems = parsed
      .filter(r => r.cash_flow_category === 'non_cash')
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: bookNet(r as Record<string, unknown>),
      }));

    // Working capital changes
    const workingCapital = parsed
      .filter(r => r.cash_flow_category === 'operating')
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: cashImpact(r as Record<string, unknown>),
      }));

    const totalOperating =
      netIncome +
      nonCashItems.reduce((s, i) => s + i.amount, 0) +
      workingCapital.reduce((s, i) => s + i.amount, 0);

    // Investing
    const investingItems = parsed
      .filter(r => r.cash_flow_category === 'investing')
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: cashImpact(r as Record<string, unknown>),
      }));

    const totalInvesting = investingItems.reduce((s, i) => s + i.amount, 0);

    // Financing
    const financingItems = parsed
      .filter(r => r.cash_flow_category === 'financing')
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: cashImpact(r as Record<string, unknown>),
      }));

    const totalFinancing = financingItems.reduce((s, i) => s + i.amount, 0);

    const netChange = totalOperating + totalInvesting + totalFinancing;

    // Cash accounts
    const cashRows = parsed.filter(r => r.cash_flow_category === 'cash');
    const beginningCash = cashRows.reduce((s, r) => s + priorNet(r), 0);
    const endingCash    = cashRows.reduce((s, r) => s + bookNet(r),  0);

    res.json({
      data: {
        operating: { netIncome, nonCashItems, workingCapital, total: totalOperating },
        investing:  { items: investingItems,  total: totalInvesting  },
        financing:  { items: financingItems,  total: totalFinancing  },
        netChange,
        beginningCash,
        endingCash,
      },
      error: null,
    });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
