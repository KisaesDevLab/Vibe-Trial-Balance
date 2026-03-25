"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.auditLogRouter = (0, express_1.Router)();
exports.auditLogRouter.use(auth_1.authMiddleware);
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
        return;
    }
    next();
}
// GET /api/v1/audit-log?page=1&limit=50&entity_type=&action=&from=&to=
exports.auditLogRouter.get('/', adminOnly, async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
    const offset = (page - 1) * limit;
    const { entity_type, action, from, to } = req.query;
    try {
        let query = (0, db_1.db)('audit_log')
            .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
            .select('audit_log.id', 'audit_log.user_id', 'audit_log.entity_type', 'audit_log.entity_id', 'audit_log.action', 'audit_log.description', 'audit_log.period_id', 'audit_log.created_at', 'app_users.display_name as username')
            .orderBy('audit_log.created_at', 'desc');
        let countQuery = (0, db_1.db)('audit_log').count('* as count');
        if (entity_type) {
            query = query.where('audit_log.entity_type', entity_type);
            countQuery = countQuery.where('entity_type', entity_type);
        }
        if (action) {
            query = query.where('audit_log.action', 'ilike', `%${action}%`);
            countQuery = countQuery.where('action', 'ilike', `%${action}%`);
        }
        if (from) {
            query = query.where('audit_log.created_at', '>=', from);
            countQuery = countQuery.where('created_at', '>=', from);
        }
        if (to) {
            query = query.where('audit_log.created_at', '<=', to);
            countQuery = countQuery.where('created_at', '<=', to);
        }
        const [rows, [{ count }]] = await Promise.all([
            query.limit(limit).offset(offset),
            countQuery,
        ]);
        res.json({
            data: rows,
            error: null,
            meta: { total: Number(count), page, limit },
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=auditLog.js.map