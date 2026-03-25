"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engagementSummaryRouter = exports.engagementItemRouter = exports.engagementCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.engagementCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.engagementCollectionRouter.use(auth_1.authMiddleware);
exports.engagementItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.engagementItemRouter.use(auth_1.authMiddleware);
exports.engagementSummaryRouter = (0, express_1.Router)({ mergeParams: true });
exports.engagementSummaryRouter.use(auth_1.authMiddleware);
const STATUS_VALUES = ['open', 'in_progress', 'review', 'completed', 'n_a'];
const taskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().optional().nullable(),
    category: zod_1.z.string().max(100).optional().nullable(),
    status: zod_1.z.enum(STATUS_VALUES).optional(),
    assigneeId: zod_1.z.number().int().positive().optional().nullable(),
    sortOrder: zod_1.z.number().int().optional(),
    notes: zod_1.z.string().optional().nullable(),
});
function parseRow(r) {
    return r;
}
// GET /api/v1/periods/:periodId/engagement-tasks
exports.engagementCollectionRouter.get('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('engagement_tasks as t')
            .leftJoin('app_users as a', 'a.id', 't.assignee_id')
            .leftJoin('app_users as cb', 'cb.id', 't.completed_by')
            .where('t.period_id', periodId)
            .orderBy([{ column: 't.sort_order', order: 'asc' }, { column: 't.id', order: 'asc' }])
            .select('t.*', 'a.display_name as assignee_name', 'cb.display_name as completed_by_name');
        res.json({ data: rows.map(r => parseRow(r)), error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/periods/:periodId/engagement-tasks
exports.engagementCollectionRouter.post('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const result = taskSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    try {
        const [row] = await (0, db_1.db)('engagement_tasks').insert({
            period_id: periodId,
            title: d.title,
            description: d.description ?? null,
            category: d.category ?? null,
            status: d.status ?? 'open',
            assignee_id: d.assigneeId ?? null,
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
// PATCH /api/v1/engagement-tasks/:id
exports.engagementItemRouter.patch('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = taskSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    const updates = { updated_at: db_1.db.fn.now() };
    if (d.title !== undefined)
        updates.title = d.title;
    if (d.description !== undefined)
        updates.description = d.description;
    if (d.category !== undefined)
        updates.category = d.category;
    if (d.sortOrder !== undefined)
        updates.sort_order = d.sortOrder;
    if (d.notes !== undefined)
        updates.notes = d.notes;
    if (d.assigneeId !== undefined)
        updates.assignee_id = d.assigneeId;
    if (d.status !== undefined) {
        updates.status = d.status;
        if (d.status === 'completed') {
            updates.completed_by = req.user.userId;
            updates.completed_at = db_1.db.fn.now();
        }
        else {
            updates.completed_by = null;
            updates.completed_at = null;
        }
    }
    try {
        const [updated] = await (0, db_1.db)('engagement_tasks').where({ id }).update(updates).returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Task not found' } });
            return;
        }
        res.json({ data: parseRow(updated), error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// DELETE /api/v1/engagement-tasks/:id
exports.engagementItemRouter.delete('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('engagement_tasks').where({ id }).delete();
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Task not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// GET /api/v1/engagement-summary
// Returns all open/in_progress/review tasks across all periods & clients, with client+period info
exports.engagementSummaryRouter.get('/', async (req, res) => {
    try {
        const rows = await (0, db_1.db)('engagement_tasks as t')
            .join('periods as p', 'p.id', 't.period_id')
            .join('clients as c', 'c.id', 'p.client_id')
            .leftJoin('app_users as a', 'a.id', 't.assignee_id')
            .whereNotIn('t.status', ['completed', 'n_a'])
            .orderBy([
            { column: 'c.name', order: 'asc' },
            { column: 'p.id', order: 'desc' },
            { column: 't.sort_order', order: 'asc' },
            { column: 't.id', order: 'asc' },
        ])
            .select('t.id', 't.title', 't.category', 't.status', 't.notes', 't.period_id', 't.assignee_id', 'p.period_name', 'p.end_date', 'c.id as client_id', 'c.name as client_name', 'a.display_name as assignee_name');
        res.json({ data: rows, error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=engagement.js.map