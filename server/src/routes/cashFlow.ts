// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { categoryNet, netIncomeContribution } from '../lib/accounting';

export const cashFlowRouter = Router({ mergeParams: true });
cashFlowRouter.use(authMiddleware);

function bookNet(r: Record<string, unknown>): number {
  const dr = Number(r.book_adjusted_debit  ?? 0);
  const cr = Number(r.book_adjusted_credit ?? 0);
  return categoryNet(r.category as string, dr, cr);
}

function priorNet(r: Record<string, unknown>): number {
  const dr = Number(r.prior_year_debit  ?? 0);
  const cr = Number(r.prior_year_credit ?? 0);
  return categoryNet(r.category as string, dr, cr);
}

function cashImpact(r: Record<string, unknown>): number {
  const change = bookNet(r) - priorNet(r);
  // Assets (debit normal): increase = use of cash (negative), decrease = source (positive)
  // Liabilities/Equity (credit normal): increase = source (positive), decrease = use (negative)
  // Contra accounts carry a negative categoryNet, so the same rule nets them correctly.
  return (r.category as string) === 'assets' ? -change : change;
}

// Only balance-sheet accounts may appear as cash-flow section line items;
// income-statement activity enters the statement once, via net income.
function isBalanceSheet(r: Record<string, unknown>): boolean {
  return r.category === 'assets' || r.category === 'liabilities' || r.category === 'equity';
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

    // Net income: revenue (cr - dr) minus expenses (dr - cr), signed by
    // CATEGORY so contra accounts (sales returns, purchase discounts) net
    // against their category instead of inflating it.
    const netIncome = parsed.reduce((sum, r) =>
      sum + netIncomeContribution(
        r.category as string,
        Number(r.book_adjusted_debit),
        Number(r.book_adjusted_credit),
      ), 0);

    // Non-cash add-backs: ONLY revenue/expense accounts tagged non_cash
    // (e.g. Depreciation Expense). Contra-asset accounts like Accumulated
    // Depreciation must NOT land here — otherwise the same economic activity
    // is added back twice.
    const nonCashItems = parsed
      .filter(r =>
        r.cash_flow_category === 'non_cash' &&
        (r.category === 'revenue' || r.category === 'expenses'),
      )
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        // The add-back must reverse exactly what the item contributed to net
        // income: expenses (dr - cr) come back positive, non-cash revenue
        // (cr - dr) comes back negative.
        amount: -netIncomeContribution(
          r.category as string,
          Number(r.book_adjusted_debit),
          Number(r.book_adjusted_credit),
        ),
      }));

    // Surface accounts we couldn't classify so the preparer can fix mappings.
    // Any BS account (asset/liab/equity) without a cash_flow_category is a
    // potential silent omission. We also flag non_cash accounts that were
    // rejected above because their category didn't match.
    const unmappedAccounts = parsed
      .filter(r => {
        const isBsAccount = isBalanceSheet(r);
        const noCategory = !r.cash_flow_category || r.cash_flow_category === '';
        const badNonCash = r.cash_flow_category === 'non_cash' &&
          r.category !== 'revenue' && r.category !== 'expenses';
        // IS accounts mis-mapped to a balance-change section would be
        // double-counted (already inside net income), so they are excluded
        // from the sections below and flagged here instead.
        const badSection = !isBsAccount &&
          ['operating', 'investing', 'financing', 'cash'].includes(r.cash_flow_category as string);
        return (isBsAccount && noCategory) || badNonCash || badSection;
      })
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        category:       r.category,
        current_category: r.cash_flow_category ?? null,
        change_cents:   cashImpact(r as Record<string, unknown>),
      }))
      .filter(r => r.change_cents !== 0);

    // Working capital changes
    const workingCapital = parsed
      .filter(r => r.cash_flow_category === 'operating' && isBalanceSheet(r))
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
      .filter(r => r.cash_flow_category === 'investing' && isBalanceSheet(r))
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: cashImpact(r as Record<string, unknown>),
      }));

    const totalInvesting = investingItems.reduce((s, i) => s + i.amount, 0);

    // Financing
    const financingItems = parsed
      .filter(r => r.cash_flow_category === 'financing' && isBalanceSheet(r))
      .map(r => ({
        account_id:     r.account_id,
        account_number: r.account_number,
        account_name:   r.account_name,
        amount: cashImpact(r as Record<string, unknown>),
      }));

    const totalFinancing = financingItems.reduce((s, i) => s + i.amount, 0);

    const netChange = totalOperating + totalInvesting + totalFinancing;

    // Cash accounts
    const cashRows = parsed.filter(r => r.cash_flow_category === 'cash' && isBalanceSheet(r));
    const beginningCash = cashRows.reduce((s, r) => s + priorNet(r), 0);
    const endingCash    = cashRows.reduce((s, r) => s + bookNet(r),  0);

    // Reconciliation check: ending cash must equal beginning cash + net change
    // exactly — all amounts are integer cents, so any nonzero difference is a
    // real mapping error, never float noise.
    const expectedEnding = beginningCash + netChange;
    const reconciliationDiff = endingCash - expectedEnding;
    const reconciled = reconciliationDiff === 0;

    res.json({
      data: {
        operating: { netIncome, nonCashItems, workingCapital, total: totalOperating },
        investing:  { items: investingItems,  total: totalInvesting  },
        financing:  { items: financingItems,  total: totalFinancing  },
        netChange,
        beginningCash,
        endingCash,
        reconciled,
        reconciliationDiff,
        unmappedAccounts,
      },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'cashFlow.get');
  }
});
