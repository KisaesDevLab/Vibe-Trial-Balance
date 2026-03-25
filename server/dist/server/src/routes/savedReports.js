"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedReportItemRouter = exports.savedReportCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.savedReportCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.savedReportCollectionRouter.use(auth_1.authMiddleware);
exports.savedReportItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.savedReportItemRouter.use(auth_1.authMiddleware);
const sectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().min(1).max(200),
    accountIds: zod_1.z.array(zod_1.z.number().int().positive()),
    showSubtotal: zod_1.z.boolean().optional().default(true),
});
const reportConfigSchema = zod_1.z.object({
    sections: zod_1.z.array(sectionSchema),
    columns: zod_1.z.array(zod_1.z.enum(['book', 'tax', 'prior-year'])).min(1),
});
const reportSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    config: reportConfigSchema,
});
// GET /api/v1/clients/:clientId/saved-reports
exports.savedReportCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('saved_reports').where({ client_id: clientId }).orderBy('name', 'asc');
        res.json({ data: rows, error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// POST /api/v1/clients/:clientId/saved-reports
exports.savedReportCollectionRouter.post('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = reportSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        const [row] = await (0, db_1.db)('saved_reports').insert({
            client_id: clientId,
            name: result.data.name,
            config: JSON.stringify(result.data.config),
            created_by: req.user.userId,
        }).returning('*');
        res.status(201).json({ data: row, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PATCH /api/v1/saved-reports/:id
exports.savedReportItemRouter.patch('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = reportSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const updates = { updated_at: db_1.db.fn.now() };
    if (result.data.name !== undefined)
        updates.name = result.data.name;
    if (result.data.config !== undefined)
        updates.config = JSON.stringify(result.data.config);
    try {
        const [updated] = await (0, db_1.db)('saved_reports').where({ id }).update(updates).returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Report not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// DELETE /api/v1/saved-reports/:id
exports.savedReportItemRouter.delete('/', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('saved_reports').where({ id }).delete();
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Report not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=savedReports.js.map