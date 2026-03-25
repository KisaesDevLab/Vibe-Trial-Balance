"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jeItemRouter = exports.jeCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const periodGuard_1 = require("../lib/periodGuard");
exports.jeCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.jeCollectionRouter.use(auth_1.authMiddleware);
exports.jeItemRouter = (0, express_1.Router)();
exports.jeItemRouter.use(auth_1.authMiddleware);
const lineSchema = zod_1.z.object({
    accountId: zod_1.z.number().int().positive(),
    debit: zod_1.z.number().int().min(0),
    credit: zod_1.z.number().int().min(0),
});
const jeSchema = zod_1.z.object({
    entryType: zod_1.z.enum(['book', 'tax']),
    entryDate: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    isRecurring: zod_1.z.boolean().optional(),
    lines: zod_1.z.array(lineSchema).min(2),
});
function parseBigIntLines(lines) {
    return lines.map((l) => ({
        ...l,
        debit: Number(l.debit),
        credit: Number(l.credit),
    }));
}
// GET /api/v1/periods/:periodId/journal-entries
exports.jeCollectionRouter.get('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : null;
    try {
        let q = (0, db_1.db)('journal_entries').where({ period_id: periodId });
        if (typeFilter)
            q = q.where({ entry_type: typeFilter });
        const entries = await q.orderBy('entry_type').orderBy('entry_number');
        const entryIds = entries.map((e) => e.id);
        const lines = entryIds.length > 0
            ? await (0, db_1.db)('journal_entry_lines')
                .whereIn('journal_entry_id', entryIds)
                .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
                .select('journal_entry_lines.*', 'chart_of_accounts.account_number', 'chart_of_accounts.account_name')
            : [];
        const linesByEntry = lines.reduce((acc, l) => {
            const jeId = l.journal_entry_id;
            (acc[jeId] = acc[jeId] || []).push({ ...l, debit: Number(l.debit), credit: Number(l.credit) });
            return acc;
        }, {});
        const result = entries.map((e) => ({
            ...e,
            lines: linesByEntry[e.id] ?? [],
        }));
        res.json({ data: result, error: null, meta: { count: result.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/journal-entries
exports.jeItemRouter.post('/', async (req, res) => {
    // periodId comes from body for POST
    const bodySchema = jeSchema.extend({ periodId: zod_1.z.number().int().positive() });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { periodId, entryType, entryDate, description, isRecurring, lines } = result.data;
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
        res.status(400).json({
            data: null,
            error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
        });
        return;
    }
    try {
        await db_1.db.transaction(async (trx) => {
            await (0, periodGuard_1.assertPeriodUnlocked)(periodId, trx);
            const lastEntry = await trx('journal_entries')
                .where({ period_id: periodId, entry_type: entryType })
                .max('entry_number as max')
                .first();
            const entryNumber = (lastEntry?.max ?? 0) + 1;
            const [entry] = await trx('journal_entries')
                .insert({
                period_id: periodId,
                entry_number: entryNumber,
                entry_type: entryType,
                entry_date: entryDate,
                description: description ?? null,
                is_recurring: isRecurring ?? false,
                created_by: req.user.userId,
            })
                .returning('*');
            await trx('journal_entry_lines').insert(lines.map((l) => ({
                journal_entry_id: entry.id,
                account_id: l.accountId,
                debit: l.debit,
                credit: l.credit,
            })));
            await (0, periodGuard_1.logAudit)({ userId: req.user.userId, periodId, entityType: 'journal_entry', entityId: entry.id, action: 'create', description: `Created ${entryType} AJE #${entryNumber}${description ? ': ' + description : ''}` }, trx);
            res.status(201).json({ data: { ...entry, lines }, error: null });
        });
    }
    catch (err) {
        const e = err;
        if (e.code === 'PERIOD_LOCKED') {
            res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked.' } });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/journal-entries/:id
exports.jeItemRouter.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const entry = await (0, db_1.db)('journal_entries').where({ id }).first();
        if (!entry) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
            return;
        }
        const lines = await (0, db_1.db)('journal_entry_lines')
            .where({ journal_entry_id: id })
            .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
            .select('journal_entry_lines.*', 'chart_of_accounts.account_number', 'chart_of_accounts.account_name');
        res.json({ data: { ...entry, lines: parseBigIntLines(lines) }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PUT /api/v1/journal-entries/:id/lines  (replace all lines + validate balance)
exports.jeItemRouter.put('/:id/lines', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = zod_1.z.object({ lines: zod_1.z.array(lineSchema).min(2) }).safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { lines } = result.data;
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
        res.status(400).json({
            data: null,
            error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
        });
        return;
    }
    try {
        await db_1.db.transaction(async (trx) => {
            await trx('journal_entry_lines').where({ journal_entry_id: id }).delete();
            await trx('journal_entry_lines').insert(lines.map((l) => ({
                journal_entry_id: id,
                account_id: l.accountId,
                debit: l.debit,
                credit: l.credit,
            })));
        });
        res.json({ data: { id, lines }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PATCH /api/v1/journal-entries/:id  (update header fields + optionally replace lines)
exports.jeItemRouter.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const existing = await (0, db_1.db)('journal_entries').where({ id }).first('entry_type');
        if (!existing) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
            return;
        }
        if (existing.entry_type === 'trans') {
            res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Trans entries are managed via Bank Transactions and cannot be edited directly.' } });
            return;
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
        return;
    }
    const patchSchema = zod_1.z.object({
        entryType: zod_1.z.enum(['book', 'tax']).optional(),
        entryDate: zod_1.z.string().optional(),
        description: zod_1.z.string().nullable().optional(),
        lines: zod_1.z.array(lineSchema).min(2).optional(),
    });
    const result = patchSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { entryType, entryDate, description, lines } = result.data;
    if (lines) {
        const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
        if (totalDebit !== totalCredit) {
            res.status(400).json({
                data: null,
                error: { code: 'UNBALANCED', message: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` },
            });
            return;
        }
    }
    try {
        const updatedEntry = await db_1.db.transaction(async (trx) => {
            const existing2 = await trx('journal_entries').where({ id }).first('period_id');
            if (existing2)
                await (0, periodGuard_1.assertPeriodUnlocked)(existing2.period_id, trx);
            const headerUpdates = { updated_at: trx.fn.now() };
            if (entryType !== undefined)
                headerUpdates.entry_type = entryType;
            if (entryDate !== undefined)
                headerUpdates.entry_date = entryDate;
            if (description !== undefined)
                headerUpdates.description = description;
            const [entry] = await trx('journal_entries').where({ id }).update(headerUpdates).returning('*');
            if (!entry)
                throw new Error('NOT_FOUND');
            if (lines) {
                await trx('journal_entry_lines').where({ journal_entry_id: id }).delete();
                await trx('journal_entry_lines').insert(lines.map((l) => ({ journal_entry_id: id, account_id: l.accountId, debit: l.debit, credit: l.credit })));
            }
            await (0, periodGuard_1.logAudit)({ userId: req.user.userId, periodId: entry.period_id, entityType: 'journal_entry', entityId: id, action: 'update', description: `Updated JE #${entry.entry_number}` }, trx);
            return entry;
        });
        res.json({ data: updatedEntry, error: null });
    }
    catch (err) {
        const e = err;
        if (e.code === 'PERIOD_LOCKED') {
            res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked.' } });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'NOT_FOUND') {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
        }
        else {
            res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
        }
    }
});
// DELETE /api/v1/journal-entries/:id
exports.jeItemRouter.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const existing = await (0, db_1.db)('journal_entries').where({ id }).first('entry_type', 'period_id', 'entry_number');
        if (!existing) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
            return;
        }
        if (existing.entry_type === 'trans') {
            res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Trans entries are managed via Bank Transactions and cannot be deleted directly.' } });
            return;
        }
        await (0, periodGuard_1.assertPeriodUnlocked)(existing.period_id);
        const [deleted] = await (0, db_1.db)('journal_entries').where({ id }).delete().returning('id');
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
            return;
        }
        await (0, periodGuard_1.logAudit)({ userId: req.user.userId, periodId: existing.period_id, entityType: 'journal_entry', entityId: id, action: 'delete', description: `Deleted ${existing.entry_type} JE #${existing.entry_number}` });
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        const e = err;
        if (e.code === 'PERIOD_LOCKED') {
            res.status(409).json({ data: null, error: { code: 'PERIOD_LOCKED', message: e.message ?? 'Period is locked.' } });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=journalEntries.js.map