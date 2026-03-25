"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payeesRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.payeesRouter = (0, express_1.Router)({ mergeParams: true });
exports.payeesRouter.use(auth_1.authMiddleware);
// GET /api/v1/clients/:clientId/payees
// Returns known payees with category history, rule info, and usage counts.
// Sorted by last_used desc.
exports.payeesRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        // Distinct payees from bank_transactions
        const txPayees = await (0, db_1.db)('bank_transactions as bt')
            .where('bt.client_id', clientId)
            .whereNotNull('bt.description')
            .groupBy('bt.description')
            .select(db_1.db.raw('bt.description as payee'), db_1.db.raw('COUNT(*) as total_transactions'), db_1.db.raw('MAX(bt.transaction_date) as last_used'))
            .orderBy('last_used', 'desc')
            .limit(200);
        // Category breakdown per payee
        const catRows = await (0, db_1.db)('bank_transactions as bt')
            .join('chart_of_accounts as c', 'bt.account_id', 'c.id')
            .where('bt.client_id', clientId)
            .whereNotNull('bt.description')
            .whereNotNull('bt.account_id')
            .groupBy('bt.description', 'bt.account_id', 'c.account_number', 'c.account_name')
            .select(db_1.db.raw('bt.description as payee'), db_1.db.raw('bt.account_id'), db_1.db.raw('c.account_number'), db_1.db.raw('c.account_name'), db_1.db.raw('COUNT(*) as cnt'));
        // Classification rules
        const rules = await (0, db_1.db)('classification_rules as r')
            .join('chart_of_accounts as c', 'r.account_id', 'c.id')
            .where('r.client_id', clientId)
            .select('r.payee_pattern', 'r.account_id as rule_account_id', db_1.db.raw("CONCAT(c.account_number, ' - ', c.account_name) as rule_account_name"));
        const ruleMap = new Map();
        for (const r of rules) {
            ruleMap.set(r.payee_pattern, {
                ruleAccountId: r.rule_account_id,
                ruleAccountName: r.rule_account_name,
            });
        }
        // Index category rows by payee
        const catByPayee = new Map();
        for (const c of catRows) {
            const p = c.payee;
            if (!catByPayee.has(p))
                catByPayee.set(p, []);
            catByPayee.get(p).push({
                accountId: c.account_id,
                accountNumber: c.account_number,
                accountName: c.account_name,
                count: Number(c.cnt),
            });
        }
        // Also add payees from classification_rules that may not have transactions yet
        const ruleOnlyPayees = rules.filter((r) => !txPayees.find((t) => t.payee === r.payee_pattern));
        const result = [
            ...txPayees.map((t) => {
                const payee = t.payee;
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
                payee: r.payee_pattern,
                totalTransactions: 0,
                lastUsed: null,
                hasRule: true,
                ruleAccountId: r.rule_account_id,
                ruleAccountName: r.rule_account_name,
                categories: [],
            })),
        ];
        res.json({ data: result, error: null, meta: { count: result.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/clients/:clientId/payees/search?q=X
exports.payeesRouter.get('/search', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const q = String(req.query.q ?? '').trim();
    try {
        const txMatches = await (0, db_1.db)('bank_transactions')
            .where({ client_id: clientId })
            .whereNotNull('description')
            .whereRaw('LOWER(description) LIKE ?', [`${q.toLowerCase()}%`])
            .groupBy('description')
            .select(db_1.db.raw('description as payee'), db_1.db.raw('COUNT(*) as total_transactions'), db_1.db.raw('MAX(transaction_date) as last_used'))
            .orderBy('last_used', 'desc')
            .limit(20);
        const ruleMatches = await (0, db_1.db)('classification_rules as r')
            .join('chart_of_accounts as c', 'r.account_id', 'c.id')
            .where('r.client_id', clientId)
            .whereRaw('LOWER(r.payee_pattern) LIKE ?', [`${q.toLowerCase()}%`])
            .select('r.payee_pattern as payee', 'r.account_id as rule_account_id', db_1.db.raw("CONCAT(c.account_number, ' - ', c.account_name) as rule_account_name"))
            .limit(20);
        const ruleMap = new Map();
        for (const r of ruleMatches) {
            ruleMap.set(r.payee, {
                ruleAccountId: r.rule_account_id,
                ruleAccountName: r.rule_account_name,
            });
        }
        // Merge, dedupe
        const seen = new Set();
        const results = [];
        for (const t of txMatches) {
            const payee = t.payee;
            seen.add(payee);
            const rule = ruleMap.get(payee);
            results.push({
                payee,
                totalTransactions: Number(t.total_transactions),
                lastUsed: t.last_used,
                hasRule: !!rule,
                ruleAccountId: rule?.ruleAccountId ?? null,
                ruleAccountName: rule?.ruleAccountName ?? null,
            });
        }
        for (const r of ruleMatches) {
            const payee = r.payee;
            if (seen.has(payee))
                continue;
            results.push({
                payee,
                totalTransactions: 0,
                lastUsed: null,
                hasRule: true,
                ruleAccountId: r.rule_account_id,
                ruleAccountName: r.rule_account_name,
            });
        }
        res.json({ data: results.slice(0, 20), error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/clients/:clientId/payees/:payee/categories
exports.payeesRouter.get('/:payee/categories', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const payee = decodeURIComponent(req.params.payee);
    try {
        const rows = await (0, db_1.db)('bank_transactions as bt')
            .join('chart_of_accounts as c', 'bt.account_id', 'c.id')
            .where({ 'bt.client_id': clientId, 'bt.description': payee })
            .whereNotNull('bt.account_id')
            .groupBy('bt.account_id', 'c.account_number', 'c.account_name')
            .select('bt.account_id as accountId', 'c.account_number as accountNumber', 'c.account_name as accountName', db_1.db.raw('COUNT(*) as count'))
            .orderBy('count', 'desc');
        res.json({ data: rows, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=payees.js.map