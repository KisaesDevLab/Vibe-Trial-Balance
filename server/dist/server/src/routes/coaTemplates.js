"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coaTemplatesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.coaTemplatesRouter = (0, express_1.Router)();
exports.coaTemplatesRouter.use(auth_1.authMiddleware);
// ── Schema ──────────────────────────────────────────────────────────────────
const templateAccountSchema = zod_1.z.object({
    accountNumber: zod_1.z.string().min(1).max(20),
    accountName: zod_1.z.string().min(1).max(255),
    category: zod_1.z.enum(['assets', 'liabilities', 'equity', 'revenue', 'expenses']),
    subcategory: zod_1.z.string().max(50).optional(),
    normalBalance: zod_1.z.enum(['debit', 'credit']),
    taxLine: zod_1.z.string().max(50).optional().nullable(),
    unit: zod_1.z.string().max(100).optional().nullable(),
    workpaperRef: zod_1.z.string().max(50).optional(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    businessType: zod_1.z.string().max(50).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// ── Helpers ──────────────────────────────────────────────────────────────────
function requireAdmin(req, res) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        return false;
    }
    return true;
}
// ── Routes ───────────────────────────────────────────────────────────────────
// GET /api/v1/coa-templates — list all templates
exports.coaTemplatesRouter.get('/', async (_req, res) => {
    try {
        const templates = await (0, db_1.db)('coa_templates')
            .orderBy([{ column: 'is_system', order: 'desc' }, { column: 'name', order: 'asc' }]);
        res.json({ data: templates, error: null, meta: { count: templates.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/coa-templates/:id — get template with accounts
exports.coaTemplatesRouter.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
        return;
    }
    try {
        const template = await (0, db_1.db)('coa_templates').where({ id }).first();
        if (!template) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        const accounts = await (0, db_1.db)('coa_template_accounts')
            .where({ template_id: id })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'account_number', order: 'asc' }]);
        res.json({ data: { ...template, accounts }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/coa-templates — create custom template
exports.coaTemplatesRouter.post('/', async (req, res) => {
    const result = templateSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { name, description, businessType, isActive } = result.data;
    try {
        const [template] = await (0, db_1.db)('coa_templates').insert({
            name,
            description: description ?? null,
            business_type: businessType ?? 'custom',
            is_system: false,
            is_active: isActive ?? true,
            account_count: 0,
            created_by: req.user?.userId ?? null,
        }).returning('*');
        res.status(201).json({ data: template, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PUT /api/v1/coa-templates/:id — update template (admin, can't modify system templates)
exports.coaTemplatesRouter.put('/:id', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
        return;
    }
    const result = templateSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        const existing = await (0, db_1.db)('coa_templates').where({ id }).first();
        if (!existing) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        if (existing.is_system) {
            res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'System templates cannot be modified' } });
            return;
        }
        const updates = { updated_at: db_1.db.fn.now() };
        const d = result.data;
        if (d.name !== undefined)
            updates.name = d.name;
        if (d.description !== undefined)
            updates.description = d.description;
        if (d.businessType !== undefined)
            updates.business_type = d.businessType;
        if (d.isActive !== undefined)
            updates.is_active = d.isActive;
        const [updated] = await (0, db_1.db)('coa_templates').where({ id }).update(updates).returning('*');
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/coa-templates/:id — delete (admin only, can't delete system templates)
exports.coaTemplatesRouter.delete('/:id', async (req, res) => {
    if (!requireAdmin(req, res))
        return;
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
        return;
    }
    try {
        const existing = await (0, db_1.db)('coa_templates').where({ id }).first();
        if (!existing) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        if (existing.is_system) {
            res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'System templates cannot be deleted' } });
            return;
        }
        await (0, db_1.db)('coa_templates').where({ id }).delete();
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/coa-templates/:id/accounts — add account to template
exports.coaTemplatesRouter.post('/:id/accounts', async (req, res) => {
    const templateId = Number(req.params.id);
    if (isNaN(templateId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
        return;
    }
    const result = templateAccountSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { accountNumber, accountName, category, subcategory, normalBalance, taxLine, unit, workpaperRef, sortOrder, isActive } = result.data;
    try {
        const template = await (0, db_1.db)('coa_templates').where({ id: templateId }).first();
        if (!template) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        const [account] = await (0, db_1.db)('coa_template_accounts').insert({
            template_id: templateId,
            account_number: accountNumber,
            account_name: accountName,
            category,
            subcategory: subcategory ?? null,
            normal_balance: normalBalance,
            tax_line: taxLine ?? null,
            unit: unit ?? null,
            workpaper_ref: workpaperRef ?? null,
            sort_order: sortOrder ?? 0,
            is_active: isActive ?? true,
        }).returning('*');
        // Update account_count
        const count = await (0, db_1.db)('coa_template_accounts').where({ template_id: templateId }).count('id as cnt').first();
        await (0, db_1.db)('coa_templates').where({ id: templateId }).update({ account_count: Number(count?.cnt ?? 0) });
        res.status(201).json({ data: account, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('unique') || message.includes('duplicate')) {
            res.status(409).json({ data: null, error: { code: 'DUPLICATE', message: 'Account number already exists in this template' } });
            return;
        }
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PUT /api/v1/coa-templates/accounts/:accountId — update template account
exports.coaTemplatesRouter.put('/accounts/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (isNaN(accountId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
        return;
    }
    const result = templateAccountSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const updates = {};
    const d = result.data;
    if (d.accountNumber !== undefined)
        updates.account_number = d.accountNumber;
    if (d.accountName !== undefined)
        updates.account_name = d.accountName;
    if (d.category !== undefined)
        updates.category = d.category;
    if (d.subcategory !== undefined)
        updates.subcategory = d.subcategory;
    if (d.normalBalance !== undefined)
        updates.normal_balance = d.normalBalance;
    if (d.taxLine !== undefined)
        updates.tax_line = d.taxLine;
    if (d.unit !== undefined)
        updates.unit = d.unit;
    if (d.workpaperRef !== undefined)
        updates.workpaper_ref = d.workpaperRef;
    if (d.sortOrder !== undefined)
        updates.sort_order = d.sortOrder;
    if (d.isActive !== undefined)
        updates.is_active = d.isActive;
    if (Object.keys(updates).length === 0) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
        return;
    }
    try {
        const [updated] = await (0, db_1.db)('coa_template_accounts').where({ id: accountId }).update(updates).returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/coa-templates/accounts/:accountId — remove account from template
exports.coaTemplatesRouter.delete('/accounts/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (isNaN(accountId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid account ID' } });
        return;
    }
    try {
        const account = await (0, db_1.db)('coa_template_accounts').where({ id: accountId }).first();
        if (!account) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Account not found' } });
            return;
        }
        const templateId = account.template_id;
        await (0, db_1.db)('coa_template_accounts').where({ id: accountId }).delete();
        // Update account_count
        const count = await (0, db_1.db)('coa_template_accounts').where({ template_id: templateId }).count('id as cnt').first();
        await (0, db_1.db)('coa_templates').where({ id: templateId }).update({ account_count: Number(count?.cnt ?? 0) });
        res.json({ data: { id: accountId }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/coa-templates/from-client/:clientId — create template from client's COA
exports.coaTemplatesRouter.post('/from-client/:clientId', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const bodySchema = zod_1.z.object({
        name: zod_1.z.string().min(1).max(255),
        description: zod_1.z.string().optional(),
        businessType: zod_1.z.string().max(50).optional(),
    });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { name, description, businessType } = result.data;
    try {
        const client = await (0, db_1.db)('clients').where({ id: clientId }).first();
        if (!client) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        const sourceAccounts = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'account_number', order: 'asc' }]);
        let template;
        await db_1.db.transaction(async (trx) => {
            const [t] = await trx('coa_templates').insert({
                name,
                description: description ?? `Created from ${client.name}`,
                business_type: businessType ?? 'custom',
                is_system: false,
                is_active: true,
                account_count: sourceAccounts.length,
                created_by: req.user?.userId ?? null,
                created_from_client_id: clientId,
            }).returning('*');
            template = t;
            if (sourceAccounts.length > 0) {
                await trx('coa_template_accounts').insert(sourceAccounts.map((a, i) => ({
                    template_id: t.id,
                    account_number: a.account_number,
                    account_name: a.account_name,
                    category: a.category,
                    subcategory: a.subcategory ?? null,
                    normal_balance: a.normal_balance,
                    tax_line: a.tax_line ?? null,
                    unit: a.unit ?? null,
                    workpaper_ref: a.workpaper_ref ?? null,
                    sort_order: a.sort_order ?? i * 10,
                    is_active: true,
                })));
            }
        });
        res.status(201).json({ data: template, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/coa-templates/:id/apply/:clientId — apply template to client's COA
exports.coaTemplatesRouter.post('/:id/apply/:clientId', async (req, res) => {
    const templateId = Number(req.params.id);
    const clientId = Number(req.params.clientId);
    if (isNaN(templateId) || isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const bodySchema = zod_1.z.object({ mode: zod_1.z.enum(['merge', 'replace']) });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { mode } = result.data;
    try {
        const template = await (0, db_1.db)('coa_templates').where({ id: templateId }).first();
        if (!template) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        const client = await (0, db_1.db)('clients').where({ id: clientId }).first();
        if (!client) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        const templateAccounts = await (0, db_1.db)('coa_template_accounts')
            .where({ template_id: templateId, is_active: true })
            .orderBy([{ column: 'sort_order', order: 'asc' }]);
        if (mode === 'replace') {
            // Check for TB data — any trial_balance_entries linked to this client
            const periods = await (0, db_1.db)('periods').where({ client_id: clientId }).select('id');
            const periodIds = periods.map((p) => p.id);
            if (periodIds.length > 0) {
                const tbCount = await (0, db_1.db)('trial_balance_entries')
                    .whereIn('period_id', periodIds)
                    .count('id as cnt')
                    .first();
                if (Number(tbCount?.cnt ?? 0) > 0) {
                    res.status(400).json({
                        data: null,
                        error: {
                            code: 'HAS_TB_DATA',
                            message: 'Cannot replace COA: this client has trial balance data. Use merge mode instead.',
                        },
                    });
                    return;
                }
            }
        }
        let added = 0;
        let skipped = 0;
        await db_1.db.transaction(async (trx) => {
            if (mode === 'replace') {
                await trx('chart_of_accounts').where({ client_id: clientId }).delete();
            }
            const existingAccounts = await trx('chart_of_accounts')
                .where({ client_id: clientId })
                .select('account_number');
            const existingNums = new Set(existingAccounts.map((a) => a.account_number));
            for (const ta of templateAccounts) {
                if (mode === 'merge' && existingNums.has(ta.account_number)) {
                    skipped++;
                    continue;
                }
                await trx('chart_of_accounts').insert({
                    client_id: clientId,
                    account_number: ta.account_number,
                    account_name: ta.account_name,
                    category: ta.category,
                    subcategory: ta.subcategory ?? null,
                    normal_balance: ta.normal_balance,
                    tax_line: ta.tax_line ?? null,
                    unit: ta.unit ?? null,
                    workpaper_ref: ta.workpaper_ref ?? null,
                    sort_order: ta.sort_order ?? 0,
                    is_active: true,
                });
                added++;
            }
        });
        res.json({ data: { added, skipped, total: templateAccounts.length }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/coa-templates/:id/export — export template as CSV
exports.coaTemplatesRouter.get('/:id/export', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid template ID' } });
        return;
    }
    try {
        const template = await (0, db_1.db)('coa_templates').where({ id }).first();
        if (!template) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            return;
        }
        const accounts = await (0, db_1.db)('coa_template_accounts')
            .where({ template_id: id })
            .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'account_number', order: 'asc' }]);
        const header = 'account_number,account_name,category,subcategory,normal_balance,tax_line,unit,workpaper_ref,sort_order';
        const rows = accounts.map((a) => [
            a.account_number,
            `"${(a.account_name ?? '').replace(/"/g, '""')}"`,
            a.category,
            a.subcategory ?? '',
            a.normal_balance,
            a.tax_line ?? '',
            a.unit ?? '',
            a.workpaper_ref ?? '',
            a.sort_order,
        ].join(','));
        const csv = [header, ...rows].join('\n');
        const filename = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/coa-templates/import/preview — parse CSV, return preview rows
exports.coaTemplatesRouter.post('/import/preview', async (req, res) => {
    const bodySchema = zod_1.z.object({ csv: zod_1.z.string().min(1) });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { csv } = result.data;
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
        res.status(400).json({ data: null, error: { code: 'INVALID_CSV', message: 'CSV must have a header row and at least one data row' } });
        return;
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const REQUIRED = ['account_number', 'account_name', 'category'];
    const missing = REQUIRED.filter((r) => !header.includes(r));
    if (missing.length > 0) {
        res.status(400).json({ data: null, error: { code: 'INVALID_CSV', message: `Missing required columns: ${missing.join(', ')}` } });
        return;
    }
    const VALID_CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
    const DEFAULT_BALANCE = {
        assets: 'debit', expenses: 'debit',
        liabilities: 'credit', equity: 'credit', revenue: 'credit',
    };
    const idx = (col) => header.indexOf(col);
    function parseRow(line) {
        const result = [];
        let inQuote = false;
        let cur = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuote && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else
                    inQuote = !inQuote;
            }
            else if (ch === ',' && !inQuote) {
                result.push(cur);
                cur = '';
            }
            else {
                cur += ch;
            }
        }
        result.push(cur);
        return result;
    }
    const preview = lines.slice(1).map((line, i) => {
        const cols = parseRow(line);
        const accountNumber = cols[idx('account_number')]?.trim() ?? '';
        const accountName = cols[idx('account_name')]?.trim() ?? '';
        const category = cols[idx('category')]?.trim() ?? '';
        const rawNormalBalance = idx('normal_balance') >= 0 ? cols[idx('normal_balance')]?.trim() ?? '' : '';
        const normalBalance = rawNormalBalance || DEFAULT_BALANCE[category] || '';
        const subcategory = idx('subcategory') >= 0 ? cols[idx('subcategory')]?.trim() ?? '' : '';
        const taxLine = idx('tax_line') >= 0 ? cols[idx('tax_line')]?.trim() ?? '' : '';
        const unit = idx('unit') >= 0 ? cols[idx('unit')]?.trim() ?? '' : '';
        const workpaperRef = idx('workpaper_ref') >= 0 ? cols[idx('workpaper_ref')]?.trim() ?? '' : '';
        const sortOrderRaw = idx('sort_order') >= 0 ? cols[idx('sort_order')]?.trim() : String(i * 10);
        const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : i * 10;
        const errors = [];
        if (!accountNumber)
            errors.push('account_number required');
        if (!accountName)
            errors.push('account_name required');
        if (!VALID_CATEGORIES.includes(category))
            errors.push('invalid category');
        if (rawNormalBalance && !['debit', 'credit'].includes(rawNormalBalance))
            errors.push('invalid normal_balance');
        return {
            account_number: accountNumber,
            account_name: accountName,
            category,
            subcategory,
            normal_balance: normalBalance,
            tax_line: taxLine,
            unit,
            workpaper_ref: workpaperRef,
            sort_order: isNaN(sortOrder) ? i * 10 : sortOrder,
            status: errors.length > 0 ? 'error' : 'new',
            error: errors.length > 0 ? errors.join('; ') : undefined,
        };
    });
    res.json({ data: preview, error: null });
});
// POST /api/v1/coa-templates/import — confirm CSV import into template
exports.coaTemplatesRouter.post('/import', async (req, res) => {
    const bodySchema = zod_1.z.object({
        csv: zod_1.z.string().min(1),
        templateId: zod_1.z.number().int().optional(),
        templateName: zod_1.z.string().min(1).max(255).optional(),
        description: zod_1.z.string().optional(),
        businessType: zod_1.z.string().max(50).optional(),
    });
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { csv, templateId, templateName, description, businessType } = result.data;
    if (!templateId && !templateName) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Must provide templateId or templateName' } });
        return;
    }
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
        res.status(400).json({ data: null, error: { code: 'INVALID_CSV', message: 'CSV must have a header row and at least one data row' } });
        return;
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (col) => header.indexOf(col);
    const DEFAULT_BALANCE_CONFIRM = {
        assets: 'debit', expenses: 'debit',
        liabilities: 'credit', equity: 'credit', revenue: 'credit',
    };
    function parseRow(line) {
        const res2 = [];
        let inQuote = false;
        let cur = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuote && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else
                    inQuote = !inQuote;
            }
            else if (ch === ',' && !inQuote) {
                res2.push(cur);
                cur = '';
            }
            else {
                cur += ch;
            }
        }
        res2.push(cur);
        return res2;
    }
    const rows = lines.slice(1).map((line, i) => {
        const cols = parseRow(line);
        const sortOrderRaw = idx('sort_order') >= 0 ? cols[idx('sort_order')]?.trim() : undefined;
        const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : i * 10;
        const category = cols[idx('category')]?.trim() ?? '';
        const rawNormalBalance = idx('normal_balance') >= 0 ? cols[idx('normal_balance')]?.trim() ?? '' : '';
        const normalBalance = rawNormalBalance || DEFAULT_BALANCE_CONFIRM[category] || 'debit';
        return {
            account_number: cols[idx('account_number')]?.trim() ?? '',
            account_name: cols[idx('account_name')]?.trim() ?? '',
            category,
            subcategory: idx('subcategory') >= 0 ? cols[idx('subcategory')]?.trim() ?? null : null,
            normal_balance: normalBalance,
            tax_line: idx('tax_line') >= 0 ? cols[idx('tax_line')]?.trim() || null : null,
            unit: idx('unit') >= 0 ? cols[idx('unit')]?.trim() || null : null,
            workpaper_ref: idx('workpaper_ref') >= 0 ? cols[idx('workpaper_ref')]?.trim() ?? null : null,
            sort_order: isNaN(sortOrder) ? i * 10 : sortOrder,
        };
    }).filter((r) => r.account_number && r.account_name && r.category && r.normal_balance);
    try {
        let resolvedTemplateId;
        if (templateId) {
            const tpl = await (0, db_1.db)('coa_templates').where({ id: templateId }).first();
            if (!tpl) {
                res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
                return;
            }
            if (tpl.is_system) {
                res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot import into system templates' } });
                return;
            }
            resolvedTemplateId = templateId;
        }
        else {
            const [tpl] = await (0, db_1.db)('coa_templates').insert({
                name: templateName,
                description: description ?? null,
                business_type: businessType ?? 'custom',
                is_system: false,
                is_active: true,
                account_count: 0,
                created_by: req.user?.userId ?? null,
            }).returning('*');
            resolvedTemplateId = tpl.id;
        }
        let imported = 0;
        await db_1.db.transaction(async (trx) => {
            for (const row of rows) {
                const existing = await trx('coa_template_accounts')
                    .where({ template_id: resolvedTemplateId, account_number: row.account_number })
                    .first();
                if (existing) {
                    await trx('coa_template_accounts').where({ id: existing.id }).update({
                        account_name: row.account_name,
                        category: row.category,
                        subcategory: row.subcategory,
                        normal_balance: row.normal_balance,
                        workpaper_ref: row.workpaper_ref,
                        sort_order: row.sort_order,
                    });
                }
                else {
                    await trx('coa_template_accounts').insert({ ...row, template_id: resolvedTemplateId });
                }
                imported++;
            }
            const count = await trx('coa_template_accounts').where({ template_id: resolvedTemplateId }).count('id as cnt').first();
            await trx('coa_templates').where({ id: resolvedTemplateId }).update({ account_count: Number(count?.cnt ?? 0) });
        });
        res.json({ data: { imported, templateId: resolvedTemplateId }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=coaTemplates.js.map