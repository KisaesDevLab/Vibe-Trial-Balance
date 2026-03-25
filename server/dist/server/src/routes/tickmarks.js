"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tbTickmarkRouter = exports.tickmarkLibraryItemRouter = exports.tickmarkLibraryCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
// Tickmark library (per client)
exports.tickmarkLibraryCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.tickmarkLibraryCollectionRouter.use(auth_1.authMiddleware);
exports.tickmarkLibraryItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.tickmarkLibraryItemRouter.use(auth_1.authMiddleware);
// TB tickmark assignments (per period)
exports.tbTickmarkRouter = (0, express_1.Router)({ mergeParams: true });
exports.tbTickmarkRouter.use(auth_1.authMiddleware);
const COLORS = ['gray', 'blue', 'green', 'red', 'purple', 'amber'];
const librarySchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).max(10),
    description: zod_1.z.string().min(1).max(500),
    color: zod_1.z.enum(COLORS).optional().default('gray'),
    sortOrder: zod_1.z.number().int().optional(),
});
// GET /api/v1/clients/:clientId/tickmarks
exports.tickmarkLibraryCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('tickmark_library').where({ client_id: clientId })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'id', order: 'asc' }]);
        res.json({ data: rows, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/clients/:clientId/tickmarks
exports.tickmarkLibraryCollectionRouter.post('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = librarySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    try {
        const [row] = await (0, db_1.db)('tickmark_library').insert({
            client_id: clientId,
            symbol: d.symbol,
            description: d.description,
            color: d.color,
            sort_order: d.sortOrder ?? 0,
            created_by: req.user.userId,
        }).returning('*');
        res.status(201).json({ data: row, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PATCH /api/v1/tickmarks/:id
exports.tickmarkLibraryItemRouter.patch('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = librarySchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    const updates = {};
    if (d.symbol !== undefined)
        updates.symbol = d.symbol;
    if (d.description !== undefined)
        updates.description = d.description;
    if (d.color !== undefined)
        updates.color = d.color;
    if (d.sortOrder !== undefined)
        updates.sort_order = d.sortOrder;
    try {
        const [updated] = await (0, db_1.db)('tickmark_library').where({ id }).update(updates).returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tickmark not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// DELETE /api/v1/tickmarks/:id
exports.tickmarkLibraryItemRouter.delete('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('tickmark_library').where({ id }).delete();
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tickmark not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// GET /api/v1/periods/:periodId/tb-tickmarks
// Returns { [accountId]: TickmarkLibraryRow[] }
exports.tbTickmarkRouter.get('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('tb_tickmarks as tt')
            .join('tickmark_library as tl', 'tl.id', 'tt.tickmark_id')
            .where('tt.period_id', periodId)
            .select('tt.account_id', 'tl.id', 'tl.symbol', 'tl.description', 'tl.color', 'tl.sort_order');
        // Group by account_id
        const map = {};
        for (const r of rows) {
            const aid = r.account_id;
            if (!map[aid])
                map[aid] = [];
            map[aid].push({ id: r.id, symbol: r.symbol, description: r.description, color: r.color });
        }
        res.json({ data: map, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/periods/:periodId/tb-tickmarks/toggle
exports.tbTickmarkRouter.post('/toggle', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const bodySchema = zod_1.z.object({ accountId: zod_1.z.number().int(), tickmarkId: zod_1.z.number().int() });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { accountId, tickmarkId } = result.data;
    try {
        const existing = await (0, db_1.db)('tb_tickmarks').where({ period_id: periodId, account_id: accountId, tickmark_id: tickmarkId }).first('id');
        if (existing) {
            await (0, db_1.db)('tb_tickmarks').where({ id: existing.id }).delete();
            res.json({ data: { action: 'removed' }, error: null });
        }
        else {
            await (0, db_1.db)('tb_tickmarks').insert({ period_id: periodId, account_id: accountId, tickmark_id: tickmarkId, created_by: req.user.userId });
            res.json({ data: { action: 'assigned' }, error: null });
        }
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=tickmarks.js.map