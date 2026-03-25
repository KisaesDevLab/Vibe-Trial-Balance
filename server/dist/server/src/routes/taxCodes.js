"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxCodesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.taxCodesRouter = router;
router.use(auth_1.authMiddleware);
// ── Schemas ──────────────────────────────────────────────────────────────────
const RETURN_FORMS = ['1040', '1065', '1120', '1120S', 'common'];
const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'];
const TAX_SOFTWARES = ['ultratax', 'cch', 'lacerte', 'gosystem', 'generic'];
const mapSchema = zod_1.z.object({
    taxSoftware: zod_1.z.enum(TAX_SOFTWARES),
    softwareCode: zod_1.z.string().optional(),
    softwareDescription: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const taxCodeSchema = zod_1.z.object({
    returnForm: zod_1.z.enum(RETURN_FORMS),
    activityType: zod_1.z.enum(ACTIVITY_TYPES),
    taxCode: zod_1.z.string().min(1).max(50),
    description: zod_1.z.string().min(1),
    sortOrder: zod_1.z.number().int().optional(),
    isSystem: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
    isM1Adjustment: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
    maps: zod_1.z.array(mapSchema).optional(),
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function toRow(d) {
    return {
        return_form: d.returnForm,
        activity_type: d.activityType,
        tax_code: d.taxCode,
        description: d.description,
        sort_order: d.sortOrder ?? 0,
        is_system: d.isSystem ?? false,
        is_active: d.isActive ?? true,
        is_m1_adjustment: d.isM1Adjustment ?? false,
        notes: d.notes ?? null,
    };
}
async function upsertMaps(taxCodeId, maps) {
    for (const m of maps) {
        const existing = await (0, db_1.db)('tax_code_software_maps')
            .where({ tax_code_id: taxCodeId, tax_software: m.taxSoftware })
            .first('id');
        if (existing) {
            await (0, db_1.db)('tax_code_software_maps').where({ id: existing.id }).update({
                software_code: m.softwareCode ?? null,
                software_description: m.softwareDescription ?? null,
                notes: m.notes ?? null,
                is_active: true,
            });
        }
        else {
            await (0, db_1.db)('tax_code_software_maps').insert({
                tax_code_id: taxCodeId,
                tax_software: m.taxSoftware,
                software_code: m.softwareCode ?? null,
                software_description: m.softwareDescription ?? null,
                notes: m.notes ?? null,
                is_active: true,
            });
        }
    }
}
async function fetchWithMaps(id) {
    const code = await (0, db_1.db)('tax_codes').where({ id }).first();
    if (!code)
        return null;
    const maps = await (0, db_1.db)('tax_code_software_maps')
        .where({ tax_code_id: id, is_active: true })
        .orderBy('tax_software');
    return { ...code, maps };
}
// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { returnForm, activityType, taxSoftware, search, includeInactive } = req.query;
        let query = (0, db_1.db)('tax_codes as tc').select('tc.*');
        if (taxSoftware && TAX_SOFTWARES.includes(taxSoftware)) {
            query = query
                .leftJoin('tax_code_software_maps as tcsm', function () {
                this.on('tcsm.tax_code_id', '=', 'tc.id')
                    .andOn(db_1.db.raw('tcsm.tax_software = ?', [taxSoftware]))
                    .andOn(db_1.db.raw('tcsm.is_active = true'));
            })
                .select('tcsm.software_code');
        }
        if (returnForm)
            query = query.where('tc.return_form', returnForm);
        if (activityType)
            query = query.where('tc.activity_type', activityType);
        if (!includeInactive || includeInactive === 'false')
            query = query.where('tc.is_active', true);
        if (search) {
            query = query.where(function () {
                this.whereILike('tc.tax_code', `%${search}%`)
                    .orWhereILike('tc.description', `%${search}%`);
            });
        }
        query = query.orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);
        const rows = await query;
        res.json({ data: rows, error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── GET /available ────────────────────────────────────────────────────────────
router.get('/available', async (req, res) => {
    try {
        const clientId = Number(req.query.clientId);
        if (isNaN(clientId) || !req.query.clientId) {
            res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId is required' } });
            return;
        }
        const client = await (0, db_1.db)('clients').where({ id: clientId }).first('entity_type', 'activity_type', 'default_tax_software');
        if (!client) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
            return;
        }
        const { returnForm: rfOverride, activityType: atOverride, taxSoftware: tsOverride } = req.query;
        const resolvedActivityType = atOverride ?? client.activity_type ?? 'business';
        const resolvedSoftware = tsOverride ?? client.default_tax_software ?? 'ultratax';
        // Map entity_type → return_form if no override
        let resolvedReturnForm = rfOverride;
        if (!resolvedReturnForm) {
            const entityMap = {
                '1040_C': '1040',
                '1065': '1065',
                '1120': '1120',
                '1120S': '1120S',
            };
            resolvedReturnForm = entityMap[client.entity_type] ?? 'common';
        }
        const rows = await (0, db_1.db)('tax_codes as tc')
            .leftJoin('tax_code_software_maps as tcsm', function () {
            this.on('tcsm.tax_code_id', '=', 'tc.id')
                .andOn(db_1.db.raw('tcsm.tax_software = ?', [resolvedSoftware]))
                .andOn(db_1.db.raw('tcsm.is_active = true'));
        })
            .select('tc.*', 'tcsm.software_code')
            .where('tc.is_active', true)
            .where(function () {
            this.where('tc.return_form', resolvedReturnForm).orWhere('tc.return_form', 'common');
        })
            .where(function () {
            this.where('tc.activity_type', resolvedActivityType).orWhere('tc.activity_type', 'common');
        })
            .orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);
        res.json({ data: rows, error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── GET /export ───────────────────────────────────────────────────────────────
router.get('/export', async (req, res) => {
    try {
        const { returnForm, activityType, taxSoftware, search, includeInactive } = req.query;
        // Fetch all matching codes
        let query = (0, db_1.db)('tax_codes as tc').select('tc.*');
        if (returnForm)
            query = query.where('tc.return_form', returnForm);
        if (activityType)
            query = query.where('tc.activity_type', activityType);
        if (!includeInactive || includeInactive === 'false')
            query = query.where('tc.is_active', true);
        if (search) {
            query = query.where(function () {
                this.whereILike('tc.tax_code', `%${search}%`)
                    .orWhereILike('tc.description', `%${search}%`);
            });
        }
        query = query.orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);
        const codes = await query;
        // Fetch all software maps for these codes
        const codeIds = codes.map((c) => c.id);
        const softwareMaps = {};
        if (codeIds.length > 0) {
            const maps = await (0, db_1.db)('tax_code_software_maps')
                .whereIn('tax_code_id', codeIds)
                .where('is_active', true)
                .select('tax_code_id', 'tax_software', 'software_code');
            for (const m of maps) {
                if (!softwareMaps[m.tax_code_id])
                    softwareMaps[m.tax_code_id] = {};
                softwareMaps[m.tax_code_id][m.tax_software] = m.software_code ?? '';
            }
        }
        const escapeCell = (v) => {
            if (v === null || v === undefined)
                return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        const headers = [
            'return_form', 'activity_type', 'tax_code', 'description', 'sort_order', 'is_m1_adjustment', 'notes',
            'ultratax_code', 'cch_code', 'lacerte_code', 'gosystem_code', 'generic_code',
        ];
        const csvRows = [headers.join(',')];
        for (const c of codes) {
            const sm = softwareMaps[c.id] ?? {};
            const row = [
                escapeCell(c.return_form),
                escapeCell(c.activity_type),
                escapeCell(c.tax_code),
                escapeCell(c.description),
                escapeCell(c.sort_order),
                escapeCell(c.is_m1_adjustment ? 'true' : 'false'),
                escapeCell(c.notes),
                escapeCell(sm['ultratax'] ?? ''),
                escapeCell(sm['cch'] ?? ''),
                escapeCell(sm['lacerte'] ?? ''),
                escapeCell(sm['gosystem'] ?? ''),
                escapeCell(sm['generic'] ?? ''),
            ];
            csvRows.push(row.join(','));
        }
        const suffix = taxSoftware ? `-${taxSoftware}` : '';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="tax-codes${suffix}.csv"`);
        res.send(csvRows.join('\n'));
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
        return;
    }
    try {
        const row = await fetchWithMaps(id);
        if (!row) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
            return;
        }
        res.json({ data: row, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── POST /import/preview ──────────────────────────────────────────────────────
router.post('/import/preview', async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv || typeof csv !== 'string') {
            res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'csv string required in body' } });
            return;
        }
        const rows = parseCsvToRows(csv);
        res.json({ data: rows, error: null, meta: { count: rows.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── POST /import ──────────────────────────────────────────────────────────────
router.post('/import', async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv || typeof csv !== 'string') {
            res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'csv string required in body' } });
            return;
        }
        const rows = parseCsvToRows(csv);
        const result = await applyUpsertRows(rows);
        res.json({ data: result, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── POST /bulk ────────────────────────────────────────────────────────────────
router.post('/bulk', async (req, res) => {
    try {
        const bulkSchema = zod_1.z.array(taxCodeSchema.extend({ id: zod_1.z.number().int().optional() }));
        const result = bulkSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
            return;
        }
        const inserted = [];
        const updated = [];
        for (const item of result.data) {
            const row = toRow(item);
            if (item.id) {
                await (0, db_1.db)('tax_codes').where({ id: item.id }).update({ ...row, updated_at: db_1.db.fn.now() });
                if (item.maps)
                    await upsertMaps(item.id, item.maps);
                updated.push(item.id);
            }
            else {
                const [newRow] = await (0, db_1.db)('tax_codes').insert(row).returning('id');
                if (item.maps)
                    await upsertMaps(newRow.id, item.maps);
                inserted.push(newRow.id);
            }
        }
        res.json({ data: { inserted: inserted.length, updated: updated.length, insertedIds: inserted, updatedIds: updated }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── POST / ────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const result = taxCodeSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        const [newRow] = await (0, db_1.db)('tax_codes').insert(toRow(result.data)).returning('*');
        if (result.data.maps && result.data.maps.length > 0) {
            await upsertMaps(newRow.id, result.data.maps);
        }
        const full = await fetchWithMaps(newRow.id);
        res.status(201).json({ data: full, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
        return;
    }
    const result = taxCodeSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        const [updated] = await (0, db_1.db)('tax_codes')
            .where({ id })
            .update({ ...toRow(result.data), updated_at: db_1.db.fn.now() })
            .returning('id');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
            return;
        }
        if (result.data.maps !== undefined) {
            await upsertMaps(id, result.data.maps);
        }
        const full = await fetchWithMaps(id);
        res.json({ data: full, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
        return;
    }
    try {
        // Check if any COA rows reference this tax code
        const refCount = await (0, db_1.db)('chart_of_accounts').where({ tax_code_id: id }).count('id as count').first();
        const count = Number(refCount?.count ?? 0);
        if (count > 0) {
            res.status(409).json({
                data: null,
                error: {
                    code: 'CONFLICT',
                    message: `Cannot deactivate: ${count} chart of accounts row(s) reference this tax code`,
                    meta: { referenceCount: count },
                },
            });
            return;
        }
        const [updated] = await (0, db_1.db)('tax_codes')
            .where({ id })
            .update({ is_active: false, updated_at: db_1.db.fn.now() })
            .returning('id');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
            return;
        }
        res.json({ data: { id }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── GET /:id/mappings ─────────────────────────────────────────────────────────
router.get('/:id/mappings', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
        return;
    }
    try {
        const maps = await (0, db_1.db)('tax_code_software_maps')
            .where({ tax_code_id: id })
            .orderBy('tax_software');
        res.json({ data: maps, error: null, meta: { count: maps.length } });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── POST /:id/mappings ────────────────────────────────────────────────────────
router.post('/:id/mappings', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
        return;
    }
    const result = mapSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        const code = await (0, db_1.db)('tax_codes').where({ id }).first('id');
        if (!code) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
            return;
        }
        const d = result.data;
        const [row] = await (0, db_1.db)('tax_code_software_maps').insert({
            tax_code_id: id,
            tax_software: d.taxSoftware,
            software_code: d.softwareCode ?? null,
            software_description: d.softwareDescription ?? null,
            notes: d.notes ?? null,
            is_active: true,
        }).returning('*');
        res.status(201).json({ data: row, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── PUT /mappings/:mapId ──────────────────────────────────────────────────────
router.put('/mappings/:mapId', async (req, res) => {
    const mapId = Number(req.params.mapId);
    if (isNaN(mapId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid mapping ID' } });
        return;
    }
    const result = mapSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const d = result.data;
    const updates = {};
    if (d.taxSoftware !== undefined)
        updates.tax_software = d.taxSoftware;
    if (d.softwareCode !== undefined)
        updates.software_code = d.softwareCode;
    if (d.softwareDescription !== undefined)
        updates.software_description = d.softwareDescription;
    if (d.notes !== undefined)
        updates.notes = d.notes;
    try {
        const [updated] = await (0, db_1.db)('tax_code_software_maps')
            .where({ id: mapId })
            .update(updates)
            .returning('*');
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Mapping not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// ── DELETE /mappings/:mapId ───────────────────────────────────────────────────
router.delete('/mappings/:mapId', async (req, res) => {
    const mapId = Number(req.params.mapId);
    if (isNaN(mapId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid mapping ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('tax_code_software_maps').where({ id: mapId }).delete();
        if (!deleted) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Mapping not found' } });
            return;
        }
        res.json({ data: { id: mapId }, error: null });
    }
    catch (err) {
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
function parseCsvToRows(csv) {
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2)
        return [];
    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx]?.trim() ?? ''; });
        const maps = [];
        for (const sw of ['ultratax', 'cch', 'lacerte', 'gosystem', 'generic']) {
            const key = `${sw}_code`;
            if (obj[key])
                maps.push({ tax_software: sw, software_code: obj[key] });
        }
        results.push({
            return_form: obj['return_form'] ?? '',
            activity_type: obj['activity_type'] ?? 'business',
            tax_code: obj['tax_code'] ?? '',
            description: obj['description'] ?? '',
            sort_order: obj['sort_order'] ? Number(obj['sort_order']) : undefined,
            is_m1_adjustment: obj['is_m1_adjustment'] === 'true' || obj['is_m1_adjustment'] === '1',
            notes: obj['notes'] || undefined,
            maps,
        });
    }
    return results;
}
function splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        }
        else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}
async function applyUpsertRows(rows) {
    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
        if (!r.tax_code || !r.return_form)
            continue;
        const existing = await (0, db_1.db)('tax_codes')
            .where({ tax_code: r.tax_code, return_form: r.return_form, activity_type: r.activity_type })
            .first('id');
        const rowData = {
            return_form: r.return_form,
            activity_type: r.activity_type,
            tax_code: r.tax_code,
            description: r.description,
            sort_order: r.sort_order ?? 0,
            is_m1_adjustment: r.is_m1_adjustment,
            notes: r.notes ?? null,
        };
        let codeId;
        if (existing) {
            await (0, db_1.db)('tax_codes').where({ id: existing.id }).update({ ...rowData, updated_at: db_1.db.fn.now() });
            codeId = existing.id;
            updated++;
        }
        else {
            const [newRow] = await (0, db_1.db)('tax_codes').insert({ ...rowData, is_active: true, is_system: false }).returning('id');
            codeId = newRow.id;
            inserted++;
        }
        // Upsert software maps
        for (const m of r.maps) {
            const existingMap = await (0, db_1.db)('tax_code_software_maps')
                .where({ tax_code_id: codeId, tax_software: m.tax_software })
                .first('id');
            if (existingMap) {
                await (0, db_1.db)('tax_code_software_maps').where({ id: existingMap.id }).update({
                    software_code: m.software_code,
                    is_active: true,
                });
            }
            else {
                await (0, db_1.db)('tax_code_software_maps').insert({
                    tax_code_id: codeId,
                    tax_software: m.tax_software,
                    software_code: m.software_code,
                    is_active: true,
                });
            }
        }
    }
    return { inserted, updated };
}
//# sourceMappingURL=taxCodes.js.map