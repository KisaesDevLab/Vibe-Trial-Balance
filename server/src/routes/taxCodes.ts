// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';
import { logAudit } from '../lib/periodGuard';
import { previewLegacyTaxCodes, purgeLegacyTaxCodes } from '../lib/legacyTaxCodes';

const router = Router();
router.use(authMiddleware);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return false;
  }
  return true;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const RETURN_FORMS = ['1040', '1065', '1120', '1120S', 'common'] as const;
const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'] as const;
const TAX_SOFTWARES = ['ultratax', 'cch', 'lacerte', 'gosystem', 'generic'] as const;

const mapSchema = z.object({
  taxSoftware: z.enum(TAX_SOFTWARES),
  softwareCode: z.string().optional(),
  softwareDescription: z.string().optional(),
  exportAccountNumber: z.string().optional(),
  exportDescription: z.string().optional(),
  notes: z.string().optional(),
});

const taxCodeSchema = z.object({
  returnForm: z.enum(RETURN_FORMS),
  activityType: z.enum(ACTIVITY_TYPES),
  // System tax codes are numeric (UltraTax-style); alpha codes were legacy duplicates.
  taxCode: z.string().regex(/^[0-9]+$/, 'Tax code must be numeric').max(50),
  description: z.string().min(1),
  sortOrder: z.number().int().optional(),
  isSystem: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isM1Adjustment: z.boolean().optional(),
  notes: z.string().optional(),
  maps: z.array(mapSchema).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRow(d: z.infer<typeof taxCodeSchema>) {
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

async function upsertMaps(taxCodeId: number, maps: z.infer<typeof mapSchema>[]) {
  for (const m of maps) {
    const existing = await db('tax_code_software_maps')
      .where({ tax_code_id: taxCodeId, tax_software: m.taxSoftware })
      .first('id');
    if (existing) {
      await db('tax_code_software_maps').where({ id: existing.id }).update({
        software_code: m.softwareCode ?? null,
        software_description: m.softwareDescription ?? null,
        export_account_number: m.exportAccountNumber ?? null,
        export_description: m.exportDescription ?? null,
        notes: m.notes ?? null,
        is_active: true,
      });
    } else {
      await db('tax_code_software_maps').insert({
        tax_code_id: taxCodeId,
        tax_software: m.taxSoftware,
        software_code: m.softwareCode ?? null,
        software_description: m.softwareDescription ?? null,
        export_account_number: m.exportAccountNumber ?? null,
        export_description: m.exportDescription ?? null,
        notes: m.notes ?? null,
        is_active: true,
      });
    }
  }
}

async function fetchWithMaps(id: number) {
  const code = await db('tax_codes').where({ id }).first();
  if (!code) return null;
  const maps = await db('tax_code_software_maps')
    .where({ tax_code_id: id, is_active: true })
    .orderBy('tax_software');
  return { ...code, maps };
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { returnForm, activityType, taxSoftware, search, includeInactive } = req.query as Record<string, string | undefined>;

    let query = db('tax_codes as tc').select('tc.*');

    if (taxSoftware && TAX_SOFTWARES.includes(taxSoftware as typeof TAX_SOFTWARES[number])) {
      query = query
        .leftJoin('tax_code_software_maps as tcsm', function () {
          this.on('tcsm.tax_code_id', '=', 'tc.id')
            .andOn(db.raw('tcsm.tax_software = ?', [taxSoftware]))
            .andOn(db.raw('tcsm.is_active = true'));
        })
        .select('tcsm.software_code');
    }

    if (returnForm) query = query.where('tc.return_form', returnForm);
    if (activityType) query = query.where('tc.activity_type', activityType);
    if (!includeInactive || includeInactive === 'false') query = query.where('tc.is_active', true);
    if (search) {
      query = query.where(function () {
        this.whereILike('tc.tax_code', `%${search}%`)
          .orWhereILike('tc.description', `%${search}%`);
      });
    }

    query = query.orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);

    const rows = await query;
    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── GET /available ────────────────────────────────────────────────────────────

router.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clientId = Number(req.query.clientId);
    if (isNaN(clientId) || !req.query.clientId) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'clientId is required' } });
      return;
    }

    const client = await db('clients').where({ id: clientId }).first('entity_type', 'activity_type', 'default_tax_software');
    if (!client) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }

    const { returnForm: rfOverride, activityType: atOverride, taxSoftware: tsOverride } = req.query as Record<string, string | undefined>;

    const resolvedActivityType = atOverride ?? client.activity_type ?? 'business';
    const resolvedSoftware: string = tsOverride ?? client.default_tax_software ?? 'ultratax';

    // Map entity_type → return_form if no override
    let resolvedReturnForm = rfOverride;
    if (!resolvedReturnForm) {
      const entityMap: Record<string, string> = {
        '1040_C': '1040',
        '1065': '1065',
        '1120': '1120',
        '1120S': '1120S',
      };
      resolvedReturnForm = entityMap[client.entity_type] ?? 'common';
    }

    const rows = await db('tax_codes as tc')
      .leftJoin('tax_code_software_maps as tcsm', function () {
        this.on('tcsm.tax_code_id', '=', 'tc.id')
          .andOn(db.raw('tcsm.tax_software = ?', [resolvedSoftware]))
          .andOn(db.raw('tcsm.is_active = true'));
      })
      .select('tc.*', 'tcsm.software_code')
      .where('tc.is_active', true)
      .where(function () {
        this.where(function () {
          this.where('tc.return_form', resolvedReturnForm).where('tc.activity_type', resolvedActivityType);
        }).orWhere(function () {
          this.where('tc.return_form', 'common').where('tc.activity_type', 'common');
        });
      })
      .orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);

    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── GET /export ───────────────────────────────────────────────────────────────

router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { returnForm, activityType, taxSoftware, search, includeInactive } = req.query as Record<string, string | undefined>;

    // Fetch all matching codes
    let query = db('tax_codes as tc').select('tc.*');
    if (returnForm) query = query.where('tc.return_form', returnForm);
    if (activityType) query = query.where('tc.activity_type', activityType);
    if (!includeInactive || includeInactive === 'false') query = query.where('tc.is_active', true);
    if (search) {
      query = query.where(function () {
        this.whereILike('tc.tax_code', `%${search}%`)
          .orWhereILike('tc.description', `%${search}%`);
      });
    }
    query = query.orderBy([{ column: 'tc.sort_order', order: 'asc' }, { column: 'tc.tax_code', order: 'asc' }]);
    const codes = await query;

    // Fetch all software maps for these codes
    const codeIds = codes.map((c: { id: number }) => c.id);
    const softwareMaps: Record<number, Record<string, string>> = {};
    if (codeIds.length > 0) {
      const maps = await db('tax_code_software_maps')
        .whereIn('tax_code_id', codeIds)
        .where('is_active', true)
        .select('tax_code_id', 'tax_software', 'software_code');
      for (const m of maps) {
        if (!softwareMaps[m.tax_code_id]) softwareMaps[m.tax_code_id] = {};
        softwareMaps[m.tax_code_id][m.tax_software] = m.software_code ?? '';
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tax Codes');
    ws.columns = [
      { header: 'return_form',      key: 'return_form',      width: 14 },
      { header: 'activity_type',    key: 'activity_type',    width: 14 },
      { header: 'tax_code',         key: 'tax_code',         width: 18 },
      { header: 'description',      key: 'description',      width: 40 },
      { header: 'sort_order',       key: 'sort_order',       width: 12 },
      { header: 'is_m1_adjustment', key: 'is_m1_adjustment', width: 16 },
      { header: 'notes',            key: 'notes',            width: 30 },
      { header: 'ultratax_code',    key: 'ultratax_code',    width: 14 },
      { header: 'cch_code',         key: 'cch_code',         width: 14 },
      { header: 'lacerte_code',     key: 'lacerte_code',     width: 14 },
      { header: 'gosystem_code',    key: 'gosystem_code',    width: 14 },
      { header: 'generic_code',     key: 'generic_code',     width: 14 },
    ];
    for (const c of codes) {
      const sm = softwareMaps[c.id] ?? {};
      ws.addRow({
        return_form:      c.return_form ?? '',
        activity_type:    c.activity_type ?? '',
        tax_code:         c.tax_code ?? '',
        description:      c.description ?? '',
        sort_order:       c.sort_order ?? 0,
        is_m1_adjustment: c.is_m1_adjustment ? 'true' : 'false',
        notes:            c.notes ?? '',
        ultratax_code:    sm['ultratax'] ?? '',
        cch_code:         sm['cch'] ?? '',
        lacerte_code:     sm['lacerte'] ?? '',
        gosystem_code:    sm['gosystem'] ?? '',
        generic_code:     sm['generic'] ?? '',
      });
    }
    const suffix = taxSoftware ? `-${taxSoftware}` : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="tax-codes${suffix}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
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
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── Legacy alpha tax codes (one-time cleanup, Settings page) ──────────────────
// System tax codes are numeric only; the old alpha canonical set is a duplicate
// left behind by deleted seed files. Migration 20260817000002 removes it on
// deploy; these endpoints let an admin do the same on demand. Both are no-ops
// once nothing alpha remains, so the Settings button naturally retires itself.

router.get('/legacy-alpha/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const preview = await previewLegacyTaxCodes(db);
    res.json({ data: preview, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

router.post('/legacy-alpha/purge', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await db.transaction(async (trx) => {
      const r = await purgeLegacyTaxCodes(trx);
      if (r.deletedCodes > 0) {
        await logAudit({
          userId: req.user!.userId,
          periodId: null,
          clientId: null,
          entityType: 'tax_code',
          action: 'purge_legacy_alpha',
          tableName: 'tax_codes',
          description:
            `Removed ${r.deletedCodes} legacy alpha system tax codes; ` +
            `accounts remapped ${r.accountsRemapped}, cleared ${r.accountsCleared}; ` +
            `template rows remapped ${r.templateRowsRemapped}, cleared ${r.templateRowsCleared}; ` +
            `consolidation rows remapped ${r.consolidationRowsRemapped}, deleted ${r.consolidationRowsDeleted}`,
        }, trx);
      }
      return r;
    });
    res.json({ data: result, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── POST /import/preview ──────────────────────────────────────────────────────

router.post('/import/preview', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { csv } = req.body as { csv?: string };
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'csv string required in body' } });
      return;
    }

    const rows = parseCsvToRows(csv);
    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── POST /import ──────────────────────────────────────────────────────────────

router.post('/import', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const { csv } = req.body as { csv?: string };
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'csv string required in body' } });
      return;
    }

    const rows = parseCsvToRows(csv);
    const result = await applyUpsertRows(rows);
    res.json({ data: result, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── POST /bulk ────────────────────────────────────────────────────────────────

router.post('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  try {
    const bulkSchema = z.array(taxCodeSchema.extend({ id: z.number().int().optional() }));
    const result = bulkSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
      return;
    }

    const inserted: number[] = [];
    const updated: number[] = [];

    for (const item of result.data) {
      const row = toRow(item);
      if (item.id) {
        await db('tax_codes').where({ id: item.id }).update({ ...row, updated_at: db.fn.now() });
        if (item.maps) await upsertMaps(item.id, item.maps);
        updated.push(item.id);
      } else {
        const [newRow] = await db('tax_codes').insert(row).returning('id');
        if (item.maps) await upsertMaps(newRow.id, item.maps);
        inserted.push(newRow.id);
      }
    }

    res.json({ data: { inserted: inserted.length, updated: updated.length, insertedIds: inserted, updatedIds: updated }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const result = taxCodeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }

  try {
    const [newRow] = await db('tax_codes').insert(toRow(result.data)).returning('*');
    if (result.data.maps && result.data.maps.length > 0) {
      await upsertMaps(newRow.id, result.data.maps);
    }
    const full = await fetchWithMaps(newRow.id);
    res.status(201).json({ data: full, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
    await db.transaction(async (trx) => {
      // Snapshot the existing tax_code string before overwriting so we can keep the
      // legacy chart_of_accounts.tax_line cache in sync.
      const prev = await trx('tax_codes').where({ id }).first('tax_code');
      if (!prev) {
        throw Object.assign(new Error('Tax code not found'), { code: 'NOT_FOUND' });
      }
      const newRow = toRow(result.data);
      await trx('tax_codes')
        .where({ id })
        .update({ ...newRow, updated_at: trx.fn.now() });

      // If the canonical tax_code string changed, cascade the rename into every
      // COA row that points at this tax code so legacy exports / reports (which
      // still read the denormalized string) don't display a stale code.
      const newCode = newRow.tax_code as string | undefined;
      if (newCode && newCode !== prev.tax_code) {
        await trx('chart_of_accounts')
          .where({ tax_code_id: id })
          .update({ tax_line: newCode, updated_at: trx.fn.now() });
      }
    });

    if (result.data.maps !== undefined) {
      await upsertMaps(id, result.data.maps);
    }
    const full = await fetchWithMaps(id);
    res.json({ data: full, error: null });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'NOT_FOUND') {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
      return;
    }
    sendServerError(res, err, 'taxCodes');
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
    return;
  }

  try {
    // Check if any COA rows reference this tax code
    const refCount = await db('chart_of_accounts').where({ tax_code_id: id }).count('id as count').first();
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

    const [updated] = await db('tax_codes')
      .where({ id })
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('id');
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
      return;
    }
    res.json({ data: { id }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── GET /:id/mappings ─────────────────────────────────────────────────────────

router.get('/:id/mappings', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid tax code ID' } });
    return;
  }
  try {
    const maps = await db('tax_code_software_maps')
      .where({ tax_code_id: id })
      .orderBy('tax_software');
    res.json({ data: maps, error: null, meta: { count: maps.length } });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── POST /:id/mappings ────────────────────────────────────────────────────────

router.post('/:id/mappings', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
    const code = await db('tax_codes').where({ id }).first('id');
    if (!code) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Tax code not found' } });
      return;
    }
    const d = result.data;
    const [row] = await db('tax_code_software_maps').insert({
      tax_code_id: id,
      tax_software: d.taxSoftware,
      software_code: d.softwareCode ?? null,
      software_description: d.softwareDescription ?? null,
      notes: d.notes ?? null,
      is_active: true,
    }).returning('*');
    res.status(201).json({ data: row, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── PUT /mappings/:mapId ──────────────────────────────────────────────────────

router.put('/mappings/:mapId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
  const updates: Record<string, unknown> = {};
  if (d.taxSoftware !== undefined) updates.tax_software = d.taxSoftware;
  if (d.softwareCode !== undefined) updates.software_code = d.softwareCode;
  if (d.softwareDescription !== undefined) updates.software_description = d.softwareDescription;
  if (d.notes !== undefined) updates.notes = d.notes;

  try {
    const [updated] = await db('tax_code_software_maps')
      .where({ id: mapId })
      .update(updates)
      .returning('*');
    if (!updated) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Mapping not found' } });
      return;
    }
    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── DELETE /mappings/:mapId ───────────────────────────────────────────────────

router.delete('/mappings/:mapId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const mapId = Number(req.params.mapId);
  if (isNaN(mapId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid mapping ID' } });
    return;
  }
  try {
    const deleted = await db('tax_code_software_maps').where({ id: mapId }).delete();
    if (!deleted) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Mapping not found' } });
      return;
    }
    res.json({ data: { id: mapId }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'taxCodes');
  }
});

// ── CSV parse helpers ─────────────────────────────────────────────────────────

interface CsvTaxCodeRow {
  return_form: string;
  activity_type: string;
  tax_code: string;
  description: string;
  sort_order?: number;
  is_m1_adjustment: boolean;
  notes?: string;
  maps: { tax_software: string; software_code: string }[];
}

function parseCsvToRows(csv: string): CsvTaxCodeRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const results: CsvTaxCodeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx]?.trim() ?? ''; });

    const maps: { tax_software: string; software_code: string }[] = [];
    for (const sw of ['ultratax', 'cch', 'lacerte', 'gosystem', 'generic']) {
      const key = `${sw}_code`;
      if (obj[key]) maps.push({ tax_software: sw, software_code: obj[key] });
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

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function applyUpsertRows(rows: CsvTaxCodeRow[]) {
  let inserted = 0;
  let updated = 0;
  let skippedNonNumeric = 0;

  for (const r of rows) {
    if (!r.tax_code || !r.return_form) continue;
    // Tax codes are numeric only — alpha codes were the legacy duplicate set.
    if (!/^[0-9]+$/.test(r.tax_code)) { skippedNonNumeric++; continue; }

    const existing = await db('tax_codes')
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

    let codeId: number;
    if (existing) {
      await db('tax_codes').where({ id: existing.id }).update({ ...rowData, updated_at: db.fn.now() });
      codeId = existing.id;
      updated++;
    } else {
      const [newRow] = await db('tax_codes').insert({ ...rowData, is_active: true, is_system: false }).returning('id');
      codeId = newRow.id;
      inserted++;
    }

    // Upsert software maps
    for (const m of r.maps) {
      const existingMap = await db('tax_code_software_maps')
        .where({ tax_code_id: codeId, tax_software: m.tax_software })
        .first('id');
      if (existingMap) {
        await db('tax_code_software_maps').where({ id: existingMap.id }).update({
          software_code: m.software_code,
          is_active: true,
        });
      } else {
        await db('tax_code_software_maps').insert({
          tax_code_id: codeId,
          tax_software: m.tax_software,
          software_code: m.software_code,
          is_active: true,
        });
      }
    }
  }

  return { inserted, updated, skippedNonNumeric };
}

export { router as taxCodesRouter };
