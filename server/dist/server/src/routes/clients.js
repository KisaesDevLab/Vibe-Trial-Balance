"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    entityType: zod_1.z.enum(['1065', '1120', '1120S', '1040_C']),
    taxYearEnd: zod_1.z.string().max(4).optional(),
    defaultTaxSoftware: zod_1.z.enum(['ultratax', 'cch', 'lacerte', 'drake']).optional(),
    taxId: zod_1.z.string().max(20).optional().nullable(),
    activityType: zod_1.z.string().max(20).optional().default('business'),
});
router.get('/', async (_req, res) => {
    try {
        const clients = await (0, db_1.db)('clients').where({ is_active: true }).orderBy('name');
        res.json({ data: clients, error: null, meta: { count: clients.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
router.post('/', async (req, res) => {
    const result = clientSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            data: null,
            error: { code: 'VALIDATION_ERROR', message: result.error.message },
        });
        return;
    }
    const { name, entityType, taxYearEnd, defaultTaxSoftware, taxId, activityType } = result.data;
    try {
        const [client] = await (0, db_1.db)('clients')
            .insert({
            name,
            entity_type: entityType,
            tax_year_end: taxYearEnd ?? '1231',
            default_tax_software: defaultTaxSoftware ?? 'ultratax',
            tax_id: taxId ?? null,
            activity_type: activityType ?? 'business',
            is_active: true,
        })
            .returning('*');
        res.status(201).json({ data: client, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const client = await (0, db_1.db)('clients').where({ id }).first();
        if (!client) {
            res
                .status(404)
                .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        res.json({ data: client, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = clientSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            data: null,
            error: { code: 'VALIDATION_ERROR', message: result.error.message },
        });
        return;
    }
    const updates = { updated_at: db_1.db.fn.now() };
    if (result.data.name !== undefined)
        updates.name = result.data.name;
    if (result.data.entityType !== undefined)
        updates.entity_type = result.data.entityType;
    if (result.data.taxYearEnd !== undefined)
        updates.tax_year_end = result.data.taxYearEnd;
    if (result.data.defaultTaxSoftware !== undefined)
        updates.default_tax_software = result.data.defaultTaxSoftware;
    if (result.data.taxId !== undefined)
        updates.tax_id = result.data.taxId;
    if (result.data.activityType !== undefined)
        updates.activity_type = result.data.activityType;
    try {
        const [updated] = await (0, db_1.db)('clients').where({ id }).update(updates).returning('*');
        if (!updated) {
            res
                .status(404)
                .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const [updated] = await (0, db_1.db)('clients')
            .where({ id })
            .update({ is_active: false, updated_at: db_1.db.fn.now() })
            .returning('id');
        if (!updated) {
            res
                .status(404)
                .json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
exports.default = router;
//# sourceMappingURL=clients.js.map