"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.periodItemRouter = exports.periodCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const periodGuard_1 = require("../lib/periodGuard");
exports.periodCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.periodCollectionRouter.use(auth_1.authMiddleware);
exports.periodItemRouter = (0, express_1.Router)();
exports.periodItemRouter.use(auth_1.authMiddleware);
const periodSchema = zod_1.z.object({
    periodName: zod_1.z.string().min(1).max(100),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    isCurrent: zod_1.z.boolean().optional(),
});
// GET /api/v1/clients/:clientId/periods
exports.periodCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const periods = await (0, db_1.db)('periods')
            .where({ client_id: clientId })
            .orderBy('end_date', 'desc');
        res.json({ data: periods, error: null, meta: { count: periods.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/periods
exports.periodCollectionRouter.post('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = periodSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { periodName, startDate, endDate, isCurrent } = result.data;
    try {
        await db_1.db.transaction(async (trx) => {
            if (isCurrent) {
                await trx('periods').where({ client_id: clientId }).update({ is_current: false });
            }
            const [period] = await trx('periods')
                .insert({
                client_id: clientId,
                period_name: periodName,
                start_date: startDate ?? null,
                end_date: endDate ?? null,
                is_current: isCurrent ?? false,
            })
                .returning('*');
            res.status(201).json({ data: period, error: null });
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PATCH /api/v1/periods/:id
exports.periodItemRouter.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const result = periodSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    try {
        await db_1.db.transaction(async (trx) => {
            if (d.isCurrent === true) {
                const period = await trx('periods').where({ id }).first('client_id');
                if (period) {
                    await trx('periods').where({ client_id: period.client_id }).update({ is_current: false });
                }
            }
            const updates = {};
            if (d.periodName !== undefined)
                updates.period_name = d.periodName;
            if (d.startDate !== undefined)
                updates.start_date = d.startDate;
            if (d.endDate !== undefined)
                updates.end_date = d.endDate;
            if (d.isCurrent !== undefined)
                updates.is_current = d.isCurrent;
            const [updated] = await trx('periods').where({ id }).update(updates).returning('*');
            if (!updated) {
                res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
                return;
            }
            res.json({ data: updated, error: null });
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/periods/:id/lock
exports.periodItemRouter.post('/:id/lock', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        // Check TB is balanced before allowing lock
        const tbRows = await (0, db_1.db)('v_adjusted_trial_balance').where({ period_id: id });
        if (tbRows.length > 0) {
            const bkDr = tbRows.reduce((s, r) => s + Number(r.book_adjusted_debit), 0);
            const bkCr = tbRows.reduce((s, r) => s + Number(r.book_adjusted_credit), 0);
            if (Math.abs(bkDr - bkCr) > 0) {
                const diff = (Math.abs(bkDr - bkCr) / 100).toFixed(2);
                res.status(409).json({ data: null, error: { code: 'TB_OUT_OF_BALANCE', message: `Trial balance is out of balance by $${diff}. Resolve before locking.` } });
                return;
            }
        }
        const [updated] = await (0, db_1.db)('periods')
            .where({ id })
            .update({ locked_at: db_1.db.fn.now(), locked_by: req.user.userId })
            .returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        await (0, periodGuard_1.logAudit)({ userId: req.user.userId, periodId: id, entityType: 'period', entityId: id, action: 'lock', description: `Locked period "${updated.period_name}"` });
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/periods/:id/unlock  (admin only)
exports.periodItemRouter.post('/:id/unlock', async (req, res) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Only admins can unlock periods.' } });
        return;
    }
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const [updated] = await (0, db_1.db)('periods')
            .where({ id })
            .update({ locked_at: null, locked_by: null })
            .returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        await (0, periodGuard_1.logAudit)({ userId: req.user.userId, periodId: id, entityType: 'period', entityId: id, action: 'unlock', description: `Unlocked period "${updated.period_name}"` });
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/periods/:id
exports.periodItemRouter.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const [deleted] = await (0, db_1.db)('periods').where({ id }).delete().returning('id');
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=periods.js.map