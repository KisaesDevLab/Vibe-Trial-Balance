"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.varianceNotesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.varianceNotesRouter = (0, express_1.Router)({ mergeParams: true });
exports.varianceNotesRouter.use(auth_1.authMiddleware);
// GET /api/v1/periods/:periodId/variance-notes
exports.varianceNotesRouter.get('/', async (req, res) => {
    const periodId = Number(req.params.periodId);
    if (isNaN(periodId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('variance_notes').where({ period_id: periodId }).orderBy('account_id');
        res.json({ data: rows, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PUT /api/v1/periods/:periodId/variance-notes/:accountId
exports.varianceNotesRouter.put('/:accountId', async (req, res) => {
    const periodId = Number(req.params.periodId);
    const accountId = Number(req.params.accountId);
    if (isNaN(periodId) || isNaN(accountId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const schema = zod_1.z.object({ note: zod_1.z.string().max(2000) });
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        if (!result.data.note.trim()) {
            await (0, db_1.db)('variance_notes').where({ period_id: periodId, account_id: accountId }).delete();
            res.json({ data: { deleted: true }, error: null });
            return;
        }
        const [row] = await (0, db_1.db)('variance_notes')
            .insert({ period_id: periodId, account_id: accountId, compare_period_id: 0, note: result.data.note.trim(), created_by: req.user.userId })
            .onConflict(['period_id', 'account_id', 'compare_period_id'])
            .merge({ note: result.data.note.trim() })
            .returning('*');
        res.json({ data: row, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=varianceNotes.js.map