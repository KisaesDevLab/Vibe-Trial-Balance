"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationItemRouter = exports.reconciliationCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
// ── Collection: /api/v1/clients/:clientId/reconciliations ────────────────────
exports.reconciliationCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.reconciliationCollectionRouter.use(auth_1.authMiddleware);
const createSchema = zod_1.z.object({
    sourceAccountId: zod_1.z.number().int().positive(),
    periodId: zod_1.z.number().int().positive().optional(),
    statementDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    statementEndingBalance: zod_1.z.number().int(), // cents, can be negative (overdraft)
    beginningBookBalance: zod_1.z.number().int().optional(),
    notes: zod_1.z.string().optional(),
});
// GET /api/v1/clients/:clientId/reconciliations
exports.reconciliationCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('bank_reconciliations as r')
            .join('chart_of_accounts as coa', 'coa.id', 'r.source_account_id')
            .leftJoin('app_users as u', 'u.id', 'r.completed_by')
            .where('r.client_id', clientId)
            .select('r.id', 'r.client_id', 'r.source_account_id', 'r.period_id', 'r.statement_date', 'r.statement_ending_balance', 'r.beginning_book_balance', 'r.status', 'r.notes', 'r.created_by', 'r.completed_by', 'r.completed_at', 'r.created_at', 'coa.account_number', 'coa.account_name', 'u.display_name as completed_by_name')
            .orderBy('r.statement_date', 'desc');
        const result = rows.map((r) => ({
            ...r,
            statement_ending_balance: Number(r.statement_ending_balance),
            beginning_book_balance: Number(r.beginning_book_balance),
        }));
        res.json({ data: result, error: null, meta: { count: result.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/clients/:clientId/reconciliations
exports.reconciliationCollectionRouter.post('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = createSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { sourceAccountId, periodId, statementDate, statementEndingBalance, beginningBookBalance, notes } = result.data;
    try {
        const [rec] = await (0, db_1.db)('bank_reconciliations').insert({
            client_id: clientId,
            source_account_id: sourceAccountId,
            period_id: periodId ?? null,
            statement_date: statementDate,
            statement_ending_balance: statementEndingBalance,
            beginning_book_balance: beginningBookBalance ?? 0,
            status: 'open',
            notes: notes ?? null,
            created_by: req.user.userId,
        }).returning('*');
        res.status(201).json({ data: { ...rec, statement_ending_balance: Number(rec.statement_ending_balance), beginning_book_balance: Number(rec.beginning_book_balance) }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── Item: /api/v1/reconciliations/:id ────────────────────────────────────────
exports.reconciliationItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.reconciliationItemRouter.use(auth_1.authMiddleware);
// GET /api/v1/reconciliations/:id  — reconciliation detail + cleared txns + all txns for account
exports.reconciliationItemRouter.get('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const rec = await (0, db_1.db)('bank_reconciliations as r')
            .join('chart_of_accounts as coa', 'coa.id', 'r.source_account_id')
            .where('r.id', id)
            .first('r.*', 'coa.account_number', 'coa.account_name');
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Reconciliation not found' } });
            return;
        }
        // All transactions for this source account on or before statement date
        const txns = await (0, db_1.db)('bank_transactions')
            .where({ client_id: rec.client_id, source_account_id: rec.source_account_id })
            .where('transaction_date', '<=', rec.statement_date)
            .orderBy('transaction_date', 'asc')
            .select('id', 'transaction_date', 'description', 'amount', 'check_number', 'classification_status');
        // Which are cleared in THIS reconciliation
        const clearedIds = await (0, db_1.db)('reconciliation_items')
            .where({ reconciliation_id: id })
            .pluck('transaction_id');
        const clearedSet = new Set(clearedIds.map(Number));
        const transactions = txns.map((t) => ({
            ...t,
            amount: Number(t.amount),
            is_cleared: clearedSet.has(Number(t.id)),
        }));
        res.json({
            data: {
                reconciliation: {
                    ...rec,
                    statement_ending_balance: Number(rec.statement_ending_balance),
                    beginning_book_balance: Number(rec.beginning_book_balance),
                },
                transactions,
            },
            error: null,
        });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PATCH /api/v1/reconciliations/:id  — update statement balance / notes
const patchSchema = zod_1.z.object({
    statementEndingBalance: zod_1.z.number().int().optional(),
    beginningBookBalance: zod_1.z.number().int().optional(),
    notes: zod_1.z.string().optional().nullable(),
});
exports.reconciliationItemRouter.patch('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = patchSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const updates = {};
    if (result.data.statementEndingBalance !== undefined)
        updates.statement_ending_balance = result.data.statementEndingBalance;
    if (result.data.beginningBookBalance !== undefined)
        updates.beginning_book_balance = result.data.beginningBookBalance;
    if (result.data.notes !== undefined)
        updates.notes = result.data.notes;
    try {
        const rec = await (0, db_1.db)('bank_reconciliations').where({ id }).first('status');
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Reconciliation not found' } });
            return;
        }
        if (rec.status === 'completed') {
            res.status(409).json({ data: null, error: { code: 'LOCKED', message: 'Reconciliation is completed' } });
            return;
        }
        const [updated] = await (0, db_1.db)('bank_reconciliations').where({ id }).update(updates).returning('*');
        res.json({ data: { ...updated, statement_ending_balance: Number(updated.statement_ending_balance), beginning_book_balance: Number(updated.beginning_book_balance) }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/reconciliations/:id/toggle-item  — clear or unclear a transaction
exports.reconciliationItemRouter.post('/toggle-item', async (req, res) => {
    const id = Number(req.params.id);
    const { transactionId } = req.body;
    if (isNaN(id) || !transactionId) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid IDs' } });
        return;
    }
    try {
        const rec = await (0, db_1.db)('bank_reconciliations').where({ id }).first('status');
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Reconciliation not found' } });
            return;
        }
        if (rec.status === 'completed') {
            res.status(409).json({ data: null, error: { code: 'LOCKED', message: 'Reconciliation is completed' } });
            return;
        }
        const existing = await (0, db_1.db)('reconciliation_items').where({ reconciliation_id: id, transaction_id: transactionId }).first('id');
        if (existing) {
            await (0, db_1.db)('reconciliation_items').where({ reconciliation_id: id, transaction_id: transactionId }).delete();
            res.json({ data: { cleared: false, transactionId }, error: null });
        }
        else {
            await (0, db_1.db)('reconciliation_items').insert({ reconciliation_id: id, transaction_id: transactionId });
            res.json({ data: { cleared: true, transactionId }, error: null });
        }
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/reconciliations/:id/complete
exports.reconciliationItemRouter.post('/complete', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const rec = await (0, db_1.db)('bank_reconciliations').where({ id }).first();
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Reconciliation not found' } });
            return;
        }
        if (rec.status === 'completed') {
            res.status(409).json({ data: null, error: { code: 'ALREADY_DONE', message: 'Already completed' } });
            return;
        }
        const [updated] = await (0, db_1.db)('bank_reconciliations')
            .where({ id })
            .update({ status: 'completed', completed_by: req.user.userId, completed_at: db_1.db.fn.now() })
            .returning('*');
        res.json({ data: { ...updated, statement_ending_balance: Number(updated.statement_ending_balance), beginning_book_balance: Number(updated.beginning_book_balance) }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/reconciliations/:id/reopen  (admin only)
exports.reconciliationItemRouter.post('/reopen', async (req, res) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Only admins can reopen reconciliations.' } });
        return;
    }
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const rec = await (0, db_1.db)('bank_reconciliations').where({ id }).first('id', 'status');
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } });
            return;
        }
        if (rec.status !== 'completed') {
            res.status(409).json({ data: null, error: { code: 'NOT_COMPLETED', message: 'Reconciliation is not completed' } });
            return;
        }
        const [updated] = await (0, db_1.db)('bank_reconciliations')
            .where({ id })
            .update({ status: 'open', completed_by: null, completed_at: null })
            .returning('*');
        res.json({ data: { ...updated, statement_ending_balance: Number(updated.statement_ending_balance), beginning_book_balance: Number(updated.beginning_book_balance) }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// DELETE /api/v1/reconciliations/:id
exports.reconciliationItemRouter.delete('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const rec = await (0, db_1.db)('bank_reconciliations').where({ id }).first('id', 'status');
        if (!rec) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } });
            return;
        }
        if (rec.status === 'completed') {
            res.status(409).json({ data: null, error: { code: 'LOCKED', message: 'Cannot delete a completed reconciliation' } });
            return;
        }
        await (0, db_1.db)('reconciliation_items').where({ reconciliation_id: id }).delete();
        await (0, db_1.db)('bank_reconciliations').where({ id }).delete();
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=reconciliations.js.map