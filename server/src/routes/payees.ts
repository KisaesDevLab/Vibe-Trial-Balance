import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const payeesRouter = Router({ mergeParams: true });
payeesRouter.use(authMiddleware);

// GET /api/v1/clients/:clientId/payees
// Returns known payees with category history, rule info, and usage counts.
// Sorted by last_used desc.
payeesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  try {
    // Distinct payees from bank_transactions
    const txPayees = await db('bank_transactions as bt')
      .where('bt.client_id', clientId)
      .whereNotNull('bt.description')
      .groupBy('bt.description')
      .select(
        db.raw('bt.description as payee'),
        db.raw('COUNT(*) as total_transactions'),
        db.raw('MAX(bt.transaction_date) as last_used'),
      )
      .orderBy('last_used', 'desc')
      .limit(200);

    // Category breakdown per payee
    const catRows = await db('bank_transactions as bt')
      .join('chart_of_accounts as c', 'bt.account_id', 'c.id')
      .where('bt.client_id', clientId)
      .whereNotNull('bt.description')
      .whereNotNull('bt.account_id')
      .groupBy('bt.description', 'bt.account_id', 'c.account_number', 'c.account_name')
      .select(
        db.raw('bt.description as payee'),
        db.raw('bt.account_id'),
        db.raw('c.account_number'),
        db.raw('c.account_name'),
        db.raw('COUNT(*) as cnt'),
      );

    // Classification rules
    const rules = await db('classification_rules as r')
      .join('chart_of_accounts as c', 'r.account_id', 'c.id')
      .where('r.client_id', clientId)
      .select(
        'r.payee_pattern',
        'r.account_id as rule_account_id',
        db.raw("CONCAT(c.account_number, ' - ', c.account_name) as rule_account_name"),
      );

    const ruleMap = new Map<string, { ruleAccountId: number; ruleAccountName: string }>();
    for (const r of rules) {
      ruleMap.set(r.payee_pattern as string, {
        ruleAccountId: r.rule_account_id as number,
        ruleAccountName: r.rule_account_name as string,
      });
    }

    // Index category rows by payee
    const catByPayee = new Map<string, Array<{ accountId: number; accountNumber: string; accountName: string; count: number }>>();
    for (const c of catRows) {
      const p = c.payee as string;
      if (!catByPayee.has(p)) catByPayee.set(p, []);
      catByPayee.get(p)!.push({
        accountId: c.account_id as number,
        accountNumber: c.account_number as string,
        accountName: c.account_name as string,
        count: Number(c.cnt),
      });
    }

    // Also add payees from classification_rules that may not have transactions yet
    const ruleOnlyPayees = rules.filter(
      (r) => !txPayees.find((t) => t.payee === r.payee_pattern),
    );

    const result = [
      ...txPayees.map((t) => {
        const payee = t.payee as string;
        const rule = ruleMap.get(payee);
        const categories = (catByPayee.get(payee) ?? []).sort((a, b) => b.count - a.count);
        return {
          payee,
          totalTransactions: Number(t.total_transactions),
          lastUsed: t.last_used,
          hasRule: !!rule,
          ruleAccountId: rule?.ruleAccountId ?? null,
          ruleAccountName: rule?.ruleAccountName ?? null,
          categories,
        };
      }),
      ...ruleOnlyPayees.map((r) => ({
        payee: r.payee_pattern as string,
        totalTransactions: 0,
        lastUsed: null,
        hasRule: true,
        ruleAccountId: r.rule_account_id as number,
        ruleAccountName: r.rule_account_name as string,
        categories: [],
      })),
    ];

    res.json({ data: result, error: null, meta: { count: result.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/clients/:clientId/payees/search?q=X
payeesRouter.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  const q = String(req.query.q ?? '').trim();
  try {
    const txMatches = await db('bank_transactions')
      .where({ client_id: clientId })
      .whereNotNull('description')
      .whereRaw('LOWER(description) LIKE ?', [`${q.toLowerCase()}%`])
      .groupBy('description')
      .select(
        db.raw('description as payee'),
        db.raw('COUNT(*) as total_transactions'),
        db.raw('MAX(transaction_date) as last_used'),
      )
      .orderBy('last_used', 'desc')
      .limit(20);

    const ruleMatches = await db('classification_rules as r')
      .join('chart_of_accounts as c', 'r.account_id', 'c.id')
      .where('r.client_id', clientId)
      .whereRaw('LOWER(r.payee_pattern) LIKE ?', [`${q.toLowerCase()}%`])
      .select(
        'r.payee_pattern as payee',
        'r.account_id as rule_account_id',
        db.raw("CONCAT(c.account_number, ' - ', c.account_name) as rule_account_name"),
      )
      .limit(20);

    const ruleMap = new Map<string, { ruleAccountId: number; ruleAccountName: string }>();
    for (const r of ruleMatches) {
      ruleMap.set(r.payee as string, {
        ruleAccountId: r.rule_account_id as number,
        ruleAccountName: r.rule_account_name as string,
      });
    }

    // Merge, dedupe
    const seen = new Set<string>();
    const results: Array<{
      payee: string; totalTransactions: number; lastUsed: string | null;
      hasRule: boolean; ruleAccountId: number | null; ruleAccountName: string | null;
    }> = [];

    for (const t of txMatches) {
      const payee = t.payee as string;
      seen.add(payee);
      const rule = ruleMap.get(payee);
      results.push({
        payee,
        totalTransactions: Number(t.total_transactions),
        lastUsed: t.last_used as string | null,
        hasRule: !!rule,
        ruleAccountId: rule?.ruleAccountId ?? null,
        ruleAccountName: rule?.ruleAccountName ?? null,
      });
    }
    for (const r of ruleMatches) {
      const payee = r.payee as string;
      if (seen.has(payee)) continue;
      results.push({
        payee,
        totalTransactions: 0,
        lastUsed: null,
        hasRule: true,
        ruleAccountId: r.rule_account_id as number,
        ruleAccountName: r.rule_account_name as string,
      });
    }

    res.json({ data: results.slice(0, 20), error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/clients/:clientId/payees/:payee/categories
payeesRouter.get('/:payee/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  const payee = decodeURIComponent(req.params.payee);
  try {
    const rows = await db('bank_transactions as bt')
      .join('chart_of_accounts as c', 'bt.account_id', 'c.id')
      .where({ 'bt.client_id': clientId, 'bt.description': payee })
      .whereNotNull('bt.account_id')
      .groupBy('bt.account_id', 'c.account_number', 'c.account_name')
      .select(
        'bt.account_id as accountId',
        'c.account_number as accountNumber',
        'c.account_name as accountName',
        db.raw('COUNT(*) as count'),
      )
      .orderBy('count', 'desc');

    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
