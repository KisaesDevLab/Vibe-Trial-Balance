// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The firm's Statement Writer library: letterhead, accountant's report
 * letters, style presets and portable layout templates.
 *
 * One library for the whole installation (this app is single-tenant). It is
 * seeded lazily — on the first read, not by a migration — because the seed
 * data lives in the engine (`FS_BUILTIN_STYLES`) and in this file, and a
 * migration that imported TypeScript could not run under the JS-only
 * migration rule. Seeding is idempotent, keyed by `builtin_key`.
 */

import type { Knex } from 'knex';
import { db } from '../../db';
import {
  FS_BUILTIN_STYLES, FS_DEFAULT_STYLE, fsStyleSchema, fsTemplateLayoutSchema, sanitizeFsLetterHtml,
  type FsLayout, type FsLetterhead, type FsStyle,
} from './engine';
import { imageInfoFromDataUri } from './imageSize';

export class FsError extends Error {
  constructor(public code: string, public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

type Q = Knex | Knex.Transaction;

// ─── Seed data ───────────────────────────────────────────────────────────

// AICPA wording (SSARS 21), as seeded in Vibe MyBooks. {{variables}} are
// resolved per statement set (lib/fs/fsReports.ts resolveLetter).
const SEED_LETTERS: ReadonlyArray<{ key: string; name: string; letterType: 'compilation' | 'preparation'; bodyHtml: string }> = [
  {
    key: 'compilation_arc80',
    name: "Accountant's Compilation Report (AR-C 80)",
    letterType: 'compilation',
    bodyHtml:
      '<p>Management is responsible for the accompanying financial statements of {{client_name}}, which comprise the {{financial_statement_titles}} as of {{as_of_date}} and for the {{period_description}}, and the related notes to the financial statements in accordance with {{basis_of_accounting}}. I (We) have performed a compilation engagement in accordance with Statements on Standards for Accounting and Review Services promulgated by the Accounting and Review Services Committee of the AICPA. I (We) did not audit or review the financial statements nor was (were) I (we) required to perform any procedures to verify the accuracy or completeness of the information provided by management. Accordingly, I (we) do not express an opinion, a conclusion, nor provide any assurance on these financial statements.</p>'
      + '<p>{{accountant_signature}}<br>{{firm_city_state}}<br>{{letter_date}}</p>',
  },
  {
    key: 'preparation_arc70',
    name: 'Preparation of Financial Statements (AR-C 70)',
    letterType: 'preparation',
    bodyHtml:
      '<p>The accompanying financial statements of {{client_name}} as of {{as_of_date}} and for the {{period_description}} were prepared in accordance with {{basis_of_accounting}}.</p>'
      + '<p><strong>No assurance is provided on these financial statements.</strong></p>',
  },
];

let seeded = false;

/** Idempotent. Safe to call on every library read; does its work once per process. */
export async function ensureFsLibrarySeeded(q: Q = db): Promise<void> {
  if (seeded) return;

  const haveLetters = new Set((await q('fs_letters').whereNotNull('builtin_key').pluck('builtin_key')) as string[]);
  const anyDefaultLetter = !!(await q('fs_letters').where({ is_default: true }).first('id'));
  let sort = 0;
  for (const l of SEED_LETTERS) {
    if (!haveLetters.has(l.key)) {
      await q('fs_letters')
        .insert({
          name: l.name, letter_type: l.letterType, title: null, body_html: l.bodyHtml,
          is_active: true, is_default: !anyDefaultLetter && sort === 0, builtin_key: l.key, sort_order: sort,
        })
        .onConflict()
        .ignore();
    }
    sort += 1;
  }

  const havePresets = new Set((await q('fs_style_presets').whereNotNull('builtin_key').pluck('builtin_key')) as string[]);
  const anyDefaultPreset = !!(await q('fs_style_presets').where({ is_default: true }).first('id'));
  sort = 0;
  for (const p of FS_BUILTIN_STYLES) {
    if (!havePresets.has(p.key)) {
      await q('fs_style_presets')
        .insert({
          name: p.name, style_json: JSON.stringify(p.style), builtin_key: p.key,
          is_default: !anyDefaultPreset && sort === 0, sort_order: sort,
        })
        .onConflict()
        .ignore();
    }
    sort += 1;
  }

  // The letterhead starts from Settings → Firm identity, which the firm has
  // very likely already filled in for the other PDFs.
  if (!(await q('fs_firm_profile').first('id'))) {
    const rows = (await q('settings').whereIn('key', ['firm_name', 'firm_address', 'firm_email']).select('key', 'value')) as Array<{ key: string; value: string | null }>;
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
    const address = (s.firm_address ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    await q('fs_firm_profile')
      .insert({
        display_name: s.firm_name || null,
        address_line1: address[0] ?? null,
        address_line2: address.slice(1).join(', ') || null,
        email: s.firm_email || null,
        accountant_signature: s.firm_name || null,
      })
      .onConflict()
      .ignore();
  }
  seeded = true;
}

/** For tests and for a restore that replaced the library tables. */
export function resetFsLibrarySeedFlag(): void {
  seeded = false;
}

// ─── Row → API shapes ────────────────────────────────────────────────────

// Rows come back untyped from knex.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

export function letterheadApi(row: Row | undefined | null) {
  return {
    displayName: row?.display_name ?? null,
    addressLine1: row?.address_line1 ?? null,
    addressLine2: row?.address_line2 ?? null,
    city: row?.city ?? null,
    state: row?.state ?? null,
    postalCode: row?.postal_code ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    website: row?.website ?? null,
    logoDataUri: row?.logo_data_uri ?? null,
    accountantSignature: row?.accountant_signature ?? null,
    letterheadAlign: row?.letterhead_align ?? 'left',
    letterheadContent: row?.letterhead_content ?? 'both',
    logoSize: row?.logo_size ?? 'small',
    updatedAt: iso(row?.updated_at),
  };
}

/** The renderer's letterhead (adds the logo's aspect ratio, read from the image header). */
export function letterheadOf(row: Row | undefined | null): FsLetterhead | null {
  if (!row) return null;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.find((x) => x === v) ?? fallback);
  const info = imageInfoFromDataUri(row.logo_data_uri);
  return {
    displayName: row.display_name, addressLine1: row.address_line1, addressLine2: row.address_line2,
    city: row.city, state: row.state, postalCode: row.postal_code, phone: row.phone, email: row.email,
    website: row.website, logoDataUri: row.logo_data_uri,
    letterheadAlign: pick(row.letterhead_align, ['left', 'center', 'right'] as const, 'left'),
    letterheadContent: pick(row.letterhead_content, ['both', 'logo', 'text'] as const, 'both'),
    logoSize: pick(row.logo_size, ['small', 'medium', 'content_width', 'full_bleed'] as const, 'small'),
    logoAspect: info && info.width ? info.height / info.width : null,
  };
}

export const letterApi = (r: Row) => ({
  id: r.id as number, name: r.name as string, letterType: r.letter_type as 'compilation' | 'preparation',
  title: (r.title ?? null) as string | null, bodyHtml: r.body_html as string,
  isActive: !!r.is_active, isDefault: !!r.is_default, builtin: !!r.builtin_key, updatedAt: iso(r.updated_at),
});

export const presetApi = (r: Row) => ({
  id: r.id as number, name: r.name as string, style: r.style_json as FsStyle,
  isDefault: !!r.is_default, builtin: !!r.builtin_key, updatedAt: iso(r.updated_at),
});

export const templateApi = (r: Row) => ({
  id: r.id as number, name: r.name as string, description: (r.description ?? null) as string | null,
  entityKind: r.entity_kind as string, layout: r.layout_json as FsLayout,
  isDefault: !!r.is_default, updatedAt: iso(r.updated_at),
});

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getLetterheadRow(q: Q = db): Promise<Row | null> {
  return (await q('fs_firm_profile').first()) ?? null;
}

export async function getLibrary(q: Q = db) {
  await ensureFsLibrarySeeded(q);
  const [profile, letters, presets, templates] = await Promise.all([
    getLetterheadRow(q),
    q('fs_letters').where({ is_active: true }).orderBy([{ column: 'sort_order' }, { column: 'name' }]),
    q('fs_style_presets').orderBy([{ column: 'sort_order' }, { column: 'name' }]),
    q('fs_layout_templates').orderBy([{ column: 'sort_order' }, { column: 'name' }]),
  ]);
  return {
    letterhead: letterheadApi(profile),
    letters: (letters as Row[]).map(letterApi),
    presets: (presets as Row[]).map(presetApi),
    templates: (templates as Row[]).map(templateApi),
  };
}

export async function getLetterRow(id: number, q: Q = db): Promise<Row | null> {
  return (await q('fs_letters').where({ id }).first()) ?? null;
}

export async function getDefaultLetterRow(q: Q = db): Promise<Row | null> {
  await ensureFsLibrarySeeded(q);
  return (await q('fs_letters').where({ is_active: true, is_default: true }).first())
    ?? (await q('fs_letters').where({ is_active: true }).orderBy('sort_order').first())
    ?? null;
}

export async function getDefaultStyle(q: Q = db): Promise<{ style: FsStyle; presetId: number | null }> {
  await ensureFsLibrarySeeded(q);
  const row = (await q('fs_style_presets').where({ is_default: true }).first())
    ?? (await q('fs_style_presets').orderBy('sort_order').first());
  const parsed = row ? fsStyleSchema.safeParse(row.style_json) : null;
  return parsed?.success ? { style: parsed.data, presetId: row.id } : { style: FS_DEFAULT_STYLE, presetId: null };
}

export async function getPresetStyle(id: number, q: Q = db): Promise<FsStyle> {
  const row = await q('fs_style_presets').where({ id }).first();
  if (!row) throw new FsError('NOT_FOUND', 404, 'Style preset not found.');
  return fsStyleSchema.parse(row.style_json);
}

export async function getTemplateLayout(id: number, q: Q = db): Promise<FsLayout> {
  const row = await q('fs_layout_templates').where({ id }).first();
  if (!row) throw new FsError('NOT_FOUND', 404, 'Layout template not found.');
  return fsTemplateLayoutSchema.parse(row.layout_json);
}

// ─── Writes (admin only — gated at the route) ────────────────────────────

/** Clear the current default of a table inside the caller's transaction, so the partial unique index never trips. */
async function clearDefault(trx: Knex.Transaction, table: string, exceptId?: number): Promise<void> {
  const qb = trx(table).where({ is_default: true });
  if (exceptId) qb.whereNot({ id: exceptId });
  await qb.update({ is_default: false });
}

export interface LetterheadInput {
  displayName?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null;
  state?: string | null; postalCode?: string | null; phone?: string | null; email?: string | null; website?: string | null;
  logoDataUri?: string | null; accountantSignature?: string | null;
  letterheadAlign?: string; letterheadContent?: string; logoSize?: string;
}

export async function saveLetterhead(input: LetterheadInput, userId: number | null): Promise<Row> {
  await ensureFsLibrarySeeded();
  const map: Array<[keyof LetterheadInput, string]> = [
    ['displayName', 'display_name'], ['addressLine1', 'address_line1'], ['addressLine2', 'address_line2'], ['city', 'city'],
    ['state', 'state'], ['postalCode', 'postal_code'], ['phone', 'phone'], ['email', 'email'], ['website', 'website'],
    ['logoDataUri', 'logo_data_uri'], ['accountantSignature', 'accountant_signature'],
    ['letterheadAlign', 'letterhead_align'], ['letterheadContent', 'letterhead_content'], ['logoSize', 'logo_size'],
  ];
  const patch: Row = { updated_by: userId, updated_at: db.fn.now() };
  for (const [k, col] of map) {
    if (input[k] === undefined) continue;
    patch[col] = typeof input[k] === 'string' && (input[k] as string).trim() === '' ? null : input[k];
  }
  if (input.logoDataUri && !imageInfoFromDataUri(input.logoDataUri)) {
    throw new FsError('VALIDATION_ERROR', 400, 'The logo could not be read. Use a PNG or JPEG image.');
  }
  const existing = await db('fs_firm_profile').first('id');
  const [row] = existing
    ? await db('fs_firm_profile').where({ id: existing.id }).update(patch).returning('*')
    : await db('fs_firm_profile').insert(patch).returning('*');
  return row;
}

export interface LetterInput { name: string; letterType: string; title?: string | null; bodyHtml: string; isDefault?: boolean; isActive?: boolean }

export async function createLetter(input: LetterInput, userId: number | null): Promise<Row> {
  return db.transaction(async (trx) => {
    if (input.isDefault) await clearDefault(trx, 'fs_letters');
    const [row] = await trx('fs_letters').insert({
      name: input.name, letter_type: input.letterType, title: input.title?.trim() || null,
      body_html: sanitizeFsLetterHtml(input.bodyHtml), is_default: !!input.isDefault, is_active: true, created_by: userId,
    }).returning('*');
    return row;
  });
}

export async function updateLetter(id: number, input: Partial<LetterInput>): Promise<Row> {
  return db.transaction(async (trx) => {
    const before = await trx('fs_letters').where({ id }).first();
    if (!before) throw new FsError('NOT_FOUND', 404, 'Letter not found.');
    if (input.isDefault) await clearDefault(trx, 'fs_letters', id);
    const [row] = await trx('fs_letters').where({ id }).update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.letterType !== undefined ? { letter_type: input.letterType } : {}),
      ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
      ...(input.bodyHtml !== undefined ? { body_html: sanitizeFsLetterHtml(input.bodyHtml) } : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      updated_at: trx.fn.now(),
    }).returning('*');
    return row;
  });
}

/**
 * Letters are deactivated, never deleted: a finalized version froze its own
 * copy of the wording, but a draft still points at the letter by id, and a
 * vanished row would silently swap its report for the default one.
 */
export async function deactivateLetter(id: number): Promise<void> {
  const n = await db('fs_letters').where({ id }).update({ is_active: false, is_default: false, updated_at: db.fn.now() });
  if (!n) throw new FsError('NOT_FOUND', 404, 'Letter not found.');
}

export async function createPreset(input: { name: string; style: FsStyle; isDefault?: boolean }, userId: number | null): Promise<Row> {
  return db.transaction(async (trx) => {
    if (input.isDefault) await clearDefault(trx, 'fs_style_presets');
    const [row] = await trx('fs_style_presets').insert({
      name: input.name, style_json: JSON.stringify(input.style), is_default: !!input.isDefault, created_by: userId, sort_order: 100,
    }).returning('*');
    return row;
  });
}

export async function updatePreset(id: number, input: { name?: string; style?: FsStyle; isDefault?: boolean }): Promise<Row> {
  return db.transaction(async (trx) => {
    const before = await trx('fs_style_presets').where({ id }).first();
    if (!before) throw new FsError('NOT_FOUND', 404, 'Style preset not found.');
    if (input.isDefault) await clearDefault(trx, 'fs_style_presets', id);
    const [row] = await trx('fs_style_presets').where({ id }).update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.style !== undefined ? { style_json: JSON.stringify(input.style) } : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
      updated_at: trx.fn.now(),
    }).returning('*');
    return row;
  });
}

export async function deletePreset(id: number): Promise<void> {
  const row = await db('fs_style_presets').where({ id }).first();
  if (!row) throw new FsError('NOT_FOUND', 404, 'Style preset not found.');
  // A deleted built-in would be re-seeded on the next start, so say no instead.
  if (row.builtin_key) throw new FsError('FS_BUILTIN', 409, 'The built-in styles cannot be deleted. Save your own copy and make that the default.');
  await db('fs_style_presets').where({ id }).delete();
}

export interface TemplateInput { name: string; description?: string | null; entityKind: string; layout: FsLayout; isDefault?: boolean }

export async function createTemplate(input: TemplateInput, userId: number | null): Promise<Row> {
  return db.transaction(async (trx) => {
    if (input.isDefault) await clearDefault(trx, 'fs_layout_templates');
    const [row] = await trx('fs_layout_templates').insert({
      name: input.name, description: input.description ?? null, entity_kind: input.entityKind,
      layout_json: JSON.stringify(fsTemplateLayoutSchema.parse(input.layout)), is_default: !!input.isDefault, created_by: userId,
    }).returning('*');
    return row;
  });
}

export async function updateTemplate(id: number, input: Partial<TemplateInput>): Promise<Row> {
  return db.transaction(async (trx) => {
    const before = await trx('fs_layout_templates').where({ id }).first();
    if (!before) throw new FsError('NOT_FOUND', 404, 'Layout template not found.');
    if (input.isDefault) await clearDefault(trx, 'fs_layout_templates', id);
    const [row] = await trx('fs_layout_templates').where({ id }).update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.entityKind !== undefined ? { entity_kind: input.entityKind } : {}),
      ...(input.layout !== undefined ? { layout_json: JSON.stringify(fsTemplateLayoutSchema.parse(input.layout)) } : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
      updated_at: trx.fn.now(),
    }).returning('*');
    return row;
  });
}

export async function deleteTemplate(id: number): Promise<void> {
  // fs_client_layouts.source_template_id is SET NULL: a client layout made
  // from a template is a copy, and keeps working without it.
  const n = await db('fs_layout_templates').where({ id }).delete();
  if (!n) throw new FsError('NOT_FOUND', 404, 'Layout template not found.');
}
