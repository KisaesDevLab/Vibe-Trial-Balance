"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.unitsRouter = (0, express_1.Router)({ mergeParams: true });
exports.unitsRouter.use(auth_1.authMiddleware);
// ─── helpers ──────────────────────────────────────────────────────────────────
function applyStrategy(accountNumber, strategy, value) {
    if (strategy === 'prefix')
        return value + accountNumber;
    if (strategy === 'suffix')
        return accountNumber + value;
    return accountNumber; // 'same'
}
// ─── GET /api/v1/clients/:clientId/units ─────────────────────────────────────
// Returns distinct units with per-category account counts, plus an unassigned row.
exports.unitsRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .select('unit', 'category')
            .orderBy('unit', 'asc');
        // Group by unit
        const unitMap = new Map();
        for (const r of rows) {
            const key = r.unit ?? null;
            if (!unitMap.has(key))
                unitMap.set(key, { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0 });
            const counts = unitMap.get(key);
            if (r.category in counts)
                counts[r.category]++;
        }
        const data = [...unitMap.entries()]
            .sort((a, b) => {
            if (a[0] === null)
                return 1; // unassigned last
            if (b[0] === null)
                return -1;
            return a[0].localeCompare(b[0]);
        })
            .map(([unit, counts]) => ({
            unit,
            total: Object.values(counts).reduce((s, n) => s + n, 0),
            ...counts,
        }));
        res.json({ data, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── GET /api/v1/clients/:clientId/units/:unit/accounts ──────────────────────
// Accounts for a specific unit (or "unassigned" for null)
exports.unitsRouter.get('/:unit/accounts', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const unitParam = req.params.unit === '__unassigned__' ? null : req.params.unit;
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const q = (0, db_1.db)('chart_of_accounts').where({ client_id: clientId, is_active: true });
        if (unitParam === null)
            q.whereNull('unit');
        else
            q.where({ unit: unitParam });
        const accounts = await q.orderBy('account_number', 'asc');
        res.json({ data: accounts, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/rename ─────────────────────────────
exports.unitsRouter.post('/rename', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({ from: zod_1.z.string().min(1), to: zod_1.z.string().min(1).max(100) });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    try {
        const count = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, unit: parsed.data.from })
            .update({ unit: parsed.data.to, updated_at: db_1.db.fn.now() });
        res.json({ data: { updated: count }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/merge ──────────────────────────────
exports.unitsRouter.post('/merge', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({ from: zod_1.z.string().min(1), into: zod_1.z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    try {
        const count = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, unit: parsed.data.from })
            .update({ unit: parsed.data.into, updated_at: db_1.db.fn.now() });
        res.json({ data: { updated: count }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/clear ──────────────────────────────
exports.unitsRouter.post('/clear', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({ unit: zod_1.z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    try {
        const count = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, unit: parsed.data.unit })
            .update({ unit: null, updated_at: db_1.db.fn.now() });
        res.json({ data: { updated: count }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/bulk-assign ────────────────────────
// Assign a list of account IDs to a unit (or null to unassign)
exports.unitsRouter.post('/bulk-assign', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({
        accountIds: zod_1.z.array(zod_1.z.number().int()).min(1),
        unit: zod_1.z.string().max(100).nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    try {
        const count = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId })
            .whereIn('id', parsed.data.accountIds)
            .update({ unit: parsed.data.unit, updated_at: db_1.db.fn.now() });
        res.json({ data: { updated: count }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/clone ──────────────────────────────
// Create a new unit by copying accounts from an existing unit.
// Returns a preview (dry run) when dryRun=true.
exports.unitsRouter.post('/clone', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({
        sourceUnit: zod_1.z.string().min(1),
        newUnit: zod_1.z.string().min(1).max(100),
        strategy: zod_1.z.enum(['prefix', 'suffix', 'same']),
        strategyValue: zod_1.z.string().max(20).default(''),
        dryRun: zod_1.z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    const { sourceUnit, newUnit, strategy, strategyValue, dryRun } = parsed.data;
    try {
        // Fetch source accounts
        const sourceAccounts = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, unit: sourceUnit, is_active: true })
            .orderBy('account_number', 'asc');
        if (sourceAccounts.length === 0) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: `No accounts found for unit "${sourceUnit}"` } });
            return;
        }
        // Build preview rows
        const preview = sourceAccounts.map((a) => ({
            sourceNumber: a.account_number,
            newNumber: applyStrategy(a.account_number, strategy, strategyValue),
            accountName: a.account_name,
            category: a.category,
        }));
        // Check for duplicate account numbers
        const newNumbers = preview.map((p) => p.newNumber);
        const existingRows = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .whereIn('account_number', newNumbers)
            .select('account_number');
        const duplicates = existingRows.map((r) => r.account_number);
        if (dryRun || duplicates.length > 0) {
            res.json({
                data: {
                    preview: preview.map((p) => ({ ...p, duplicate: duplicates.includes(p.newNumber) })),
                    duplicateCount: duplicates.length,
                    wouldInsert: sourceAccounts.length - duplicates.length,
                },
                error: null,
            });
            return;
        }
        // Insert new accounts
        const inserts = sourceAccounts.map((a) => ({
            client_id: clientId,
            account_number: applyStrategy(a.account_number, strategy, strategyValue),
            account_name: a.account_name,
            category: a.category,
            subcategory: a.subcategory,
            normal_balance: a.normal_balance,
            tax_line: a.tax_line,
            tax_code_id: a.tax_code_id,
            workpaper_ref: a.workpaper_ref,
            unit: newUnit,
            is_active: true,
        }));
        await (0, db_1.db)('chart_of_accounts').insert(inserts);
        res.status(201).json({ data: { inserted: inserts.length }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ─── POST /api/v1/clients/:clientId/units/clone-selected ─────────────────────
// Create a new unit by copying a user-selected list of accounts (by ID).
// Returns a preview (dry run) when dryRun=true.
exports.unitsRouter.post('/clone-selected', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const schema = zod_1.z.object({
        accountIds: zod_1.z.array(zod_1.z.number().int()).min(1),
        newUnit: zod_1.z.string().min(1).max(100),
        strategy: zod_1.z.enum(['prefix', 'suffix', 'same']),
        strategyValue: zod_1.z.string().max(20).default(''),
        dryRun: zod_1.z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (isNaN(clientId) || !parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.success ? 'Invalid client ID' : parsed.error.message } });
        return;
    }
    const { accountIds, newUnit, strategy, strategyValue, dryRun } = parsed.data;
    try {
        const sourceAccounts = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .whereIn('id', accountIds)
            .orderBy('account_number', 'asc');
        if (sourceAccounts.length === 0) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No matching accounts found' } });
            return;
        }
        const preview = sourceAccounts.map((a) => ({
            sourceNumber: a.account_number,
            newNumber: applyStrategy(a.account_number, strategy, strategyValue),
            accountName: a.account_name,
            category: a.category,
        }));
        const newNumbers = preview.map((p) => p.newNumber);
        const existingRows = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .whereIn('account_number', newNumbers)
            .select('account_number');
        const duplicates = existingRows.map((r) => r.account_number);
        if (dryRun || duplicates.length > 0) {
            res.json({
                data: {
                    preview: preview.map((p) => ({ ...p, duplicate: duplicates.includes(p.newNumber) })),
                    duplicateCount: duplicates.length,
                    wouldInsert: sourceAccounts.length - duplicates.length,
                },
                error: null,
            });
            return;
        }
        const inserts = sourceAccounts.map((a) => ({
            client_id: clientId,
            account_number: applyStrategy(a.account_number, strategy, strategyValue),
            account_name: a.account_name,
            category: a.category,
            subcategory: a.subcategory,
            normal_balance: a.normal_balance,
            tax_line: a.tax_line,
            tax_code_id: a.tax_code_id,
            workpaper_ref: a.workpaper_ref,
            unit: newUnit,
            is_active: true,
        }));
        await (0, db_1.db)('chart_of_accounts').insert(inserts);
        res.status(201).json({ data: { inserted: inserts.length }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
//# sourceMappingURL=units.js.map