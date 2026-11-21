// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.
/**
 * Q122 (owner 2026-11-21): a pulled period carries its client's prior period,
 * so the desktop has something to compare with (variance notes). The prior
 * period comes as a reference period (an empty `periods` row marked
 * `is_reference`, as for a variance note's comparison period) and its
 * adjusted balances ride in `manifest.sync.priorPeriod`, not as trial balance
 * rows: the archive carries one period's data (SQ7), and its stamp and
 * send-back stay exactly as they were.
 *
 * "Prior" is the one the rest of the app means (`priorYearRange`): the
 * client's period, not a reference one, that ends the day before this one
 * starts.
 */
import type { Knex } from 'knex';
import { priorYearRange } from '../qbo/priorRange';
import { calendarDate } from './periodStamp';

const ymd = (v: unknown): string => (v instanceof Date ? calendarDate(v) : String(v).slice(0, 10));

export interface PriorPeriodRow {
  id: number;
  sync_uid: string;
  period_name: string;
  start_date: string;
  end_date: string;
}

/** The period's prior period, or null when the client has none. */
export async function priorPeriodOf(q: Knex | Knex.Transaction, periodId: number): Promise<PriorPeriodRow | null> {
  const period = await q('periods').where({ id: periodId }).first('client_id', 'start_date', 'end_date');
  if (!period) return null;
  const rows = (await q('periods').where({ client_id: period.client_id, is_reference: false }).whereNot({ id: periodId })
    .select('id', 'sync_uid', 'period_name', 'start_date', 'end_date')) as Array<Record<string, unknown>>;
  const candidates = rows.map((r) => ({
    id: Number(r.id), sync_uid: String(r.sync_uid), period_name: String(r.period_name ?? ''),
    start_date: ymd(r.start_date), end_date: ymd(r.end_date),
  }));
  const { priorPeriodId } = priorYearRange(ymd(period.start_date), ymd(period.end_date), candidates);
  return candidates.find((c) => c.id === priorPeriodId) ?? null;
}

/** What `manifest.sync.priorPeriod` carries: whole cents as text, by account uid. */
export interface PriorPeriodManifest {
  periodUid: string;
  periodName: string;
  startDate: string;
  endDate: string;
  balances: Array<{ accountUid: string; bookDebit: string; bookCredit: string; taxDebit: string; taxCredit: string }>;
}

/** The prior period and its adjusted balances (every active account it has a row for), or null. */
export async function priorPeriodManifest(q: Knex | Knex.Transaction, periodId: number): Promise<PriorPeriodManifest | null> {
  const prior = await priorPeriodOf(q, periodId);
  if (!prior) return null;
  const rows = (await q('v_adjusted_trial_balance as v').join('chart_of_accounts as a', 'a.id', 'v.account_id')
    .where('v.period_id', prior.id).where('a.is_active', true)
    .orderBy('a.account_number')
    .select('a.sync_uid', 'v.book_adjusted_debit', 'v.book_adjusted_credit', 'v.tax_adjusted_debit', 'v.tax_adjusted_credit')) as Array<Record<string, unknown>>;
  const cents = (v: unknown): string => String(v ?? 0);
  return {
    periodUid: prior.sync_uid,
    periodName: prior.period_name,
    startDate: prior.start_date,
    endDate: prior.end_date,
    balances: rows.map((r) => ({
      accountUid: String(r.sync_uid),
      bookDebit: cents(r.book_adjusted_debit), bookCredit: cents(r.book_adjusted_credit),
      taxDebit: cents(r.tax_adjusted_debit), taxCredit: cents(r.tax_adjusted_credit),
    })),
  };
}
