// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Grouping trial-balance rows by lead sheet, for the financial statements.
// Mirrors server/src/lib/leadSheetGrouping.ts — keep the two in sync, the same
// way lib/accounting.ts is kept in sync.
//
// This groups WITHIN a statement section, never across one. A lead sheet may
// span categories — "Due to/from" holds both receivable and payable accounts —
// and the statements sign by category (categoryNet), so a group that crossed
// a section boundary would add figures measured on opposite scales. That is
// exactly the defect the lead schedules themselves had. Section first, lead
// sheet second: every row in a group then shares one sign convention.

/** The columns grouping needs; `v_adjusted_trial_balance` already exposes them. */
export interface LeadSheetGroupableRow {
  lead_sheet_id?: number | null;
  lead_sheet_code?: string | null;
  lead_sheet_name?: string | null;
  lead_sheet_sort?: number | null;
  account_number?: string | null;
}

export interface LeadSheetGroup<T> {
  /** null is the trailing bucket of accounts with no lead sheet. */
  id: number | null;
  /** "A — Cash", or "Unassigned" for the trailing bucket. */
  label: string;
  rows: T[];
}

/** Account numbers sort naturally: 1000 before 10100, not lexically. */
function byAccountNumber(a: LeadSheetGroupableRow, b: LeadSheetGroupableRow): number {
  return String(a.account_number ?? '').localeCompare(String(b.account_number ?? ''), undefined, { numeric: true });
}

/**
 * True when at least one row carries a lead sheet.
 *
 * The grouped view is offered only when the chart of accounts is actually
 * mapped: on an unmapped client every account would fall into one "Unassigned"
 * heap, which is the flat statement plus a meaningless header.
 */
export function hasLeadSheetMapping(rows: LeadSheetGroupableRow[]): boolean {
  return rows.some((r) => r.lead_sheet_id != null);
}

/**
 * Rows in lead sheet order, unassigned accounts last.
 *
 * Ordering follows the lead sheet's own `sort_order` then its code, so the
 * statement reads in the same order as the Lead Sheets screen and the binder.
 * Returns a single unlabelled group when nothing in `rows` is mapped, so a
 * caller can render it exactly like the flat statement.
 */
export function groupByLeadSheet<T extends LeadSheetGroupableRow>(rows: T[]): LeadSheetGroup<T>[] {
  if (!hasLeadSheetMapping(rows)) {
    return rows.length === 0 ? [] : [{ id: null, label: '', rows: [...rows].sort(byAccountNumber) }];
  }

  const groups = new Map<string, LeadSheetGroup<T> & { sort: number; code: string }>();
  for (const r of rows) {
    const id = r.lead_sheet_id ?? null;
    const key = id === null ? '~unassigned' : String(id);
    if (!groups.has(key)) {
      const code = (r.lead_sheet_code ?? '').trim();
      const name = (r.lead_sheet_name ?? '').trim();
      groups.set(key, {
        id,
        label: id === null ? 'Unassigned' : [code, name].filter(Boolean).join(' — ') || 'Lead sheet',
        rows: [],
        sort: r.lead_sheet_sort ?? 0,
        code,
      });
    }
    groups.get(key)!.rows.push(r);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (a.id === null) return 1;   // unassigned always last
    if (b.id === null) return -1;
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });

  return ordered.map((g) => ({ id: g.id, label: g.label, rows: g.rows.sort(byAccountNumber) }));
}
