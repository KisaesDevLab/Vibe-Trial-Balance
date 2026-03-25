"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.m1ItemRouter = exports.m1CollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.m1CollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.m1CollectionRouter.use(auth_1.authMiddleware);
exports.m1ItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.m1ItemRouter.use(auth_1.authMiddleware);
const m1Schema = zod_1.z.object({
    description: zod_1.z.string().min(1).max(500),
    category: zod_1.z.string().max(100).optional().nullable(),
    bookAmount: zod_1.z.number().int(),
    taxAmount: zod_1.z.number().int(),
    sortOrder: zod_1.z.number().int().optional(),
    notes: zod_1.z.string().optional().nullable(),
});
function parseRow(r) {
    return {
        ...r,
        book_amount: Number(r.book_amount ?? 0),
        tax_amount: Number(r.tax_amount ?? 0),
    };
}
// GET /api/v1/periods/:periodId/m1-adjustments
exports.m1CollectionRouter.get('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('m1_adjustments')
            .where({ period_id: periodId })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'id', order: 'asc' }]);
        res.json({ data: rows.map(r => parseRow(r)), error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/periods/:periodId/m1-adjustments
exports.m1CollectionRouter.post('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const result = m1Schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    try {
        const [row] = await (0, db_1.db)('m1_adjustments').insert({
            period_id: periodId,
            description: d.description,
            category: d.category ?? null,
            book_amount: d.bookAmount,
            tax_amount: d.taxAmount,
            sort_order: d.sortOrder ?? 0,
            notes: d.notes ?? null,
            created_by: req.user.userId,
        }).returning('*');
        res.status(201).json({ data: parseRow(row), error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PATCH /api/v1/m1-adjustments/:id
exports.m1ItemRouter.patch('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = m1Schema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    const updates = { updated_at: db_1.db.fn.now() };
    if (d.description !== undefined)
        updates.description = d.description;
    if (d.category !== undefined)
        updates.category = d.category;
    if (d.bookAmount !== undefined)
        updates.book_amount = d.bookAmount;
    if (d.taxAmount !== undefined)
        updates.tax_amount = d.taxAmount;
    if (d.sortOrder !== undefined)
        updates.sort_order = d.sortOrder;
    if (d.notes !== undefined)
        updates.notes = d.notes;
    try {
        const [updated] = await (0, db_1.db)('m1_adjustments').where({ id }).update(updates).returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Adjustment not found' } });
            return;
        }
        res.json({ data: parseRow(updated), error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// DELETE /api/v1/m1-adjustments/:id
exports.m1ItemRouter.delete('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('m1_adjustments').where({ id }).delete();
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Adjustment not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=taxWorkpapers.js.map