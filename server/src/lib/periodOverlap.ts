// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.
/**
 * Q127 (owner 2026-11-21): a client's periods do not overlap. Rolling the same
 * year forward twice used to make two FY 2026s (the web form, the API and
 * Claude's roll_forward_period tool alike). Creating, rolling forward and
 * re-dating a period now refuse dates that overlap another period of the
 * client with 409 PERIOD_OVERLAPS, naming it.
 *
 * - Reference periods (desktop sync) are not the client's periods to work in
 *   and do not count; a period without both dates cannot overlap.
 * - Periods that already overlap (data from before this rule) stay as they
 *   are: re-dating one is refused only for a period it does not already
 *   overlap, so a fix that narrows the clash is never blocked.
 * - Rolling forward from a locked period stays allowed (owner): it only reads
 *   the source.
 *
 * Called inside the write's transaction; one advisory lock per client orders
 * two concurrent writes, so both cannot pass the check.
 */
import type { Knex } from 'knex';
import { calendarDate } from './sync/periodStamp';

/** Advisory lock class for a client's period dates (42: merges, 44: new desktop clients). */
const PERIOD_DATES_LOCK = 45;

const ymd = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : calendarDate(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
};

interface OverlapRow { id: number; period_name: string | null; start_date: unknown; end_date: unknown }

/** Other non-reference periods of the client whose dates overlap [start, end]. */
async function overlapping(trx: Knex.Transaction, clientId: number, start: string, end: string, exceptId?: number): Promise<OverlapRow[]> {
  const q = trx('periods').where({ client_id: clientId, is_reference: false })
    .whereNotNull('start_date').whereNotNull('end_date')
    .where('start_date', '<=', end).where('end_date', '>=', start);
  if (exceptId !== undefined) q.whereNot({ id: exceptId });
  return (await q.orderBy('start_date').select('id', 'period_name', 'start_date', 'end_date')) as OverlapRow[];
}

export function overlapError(start: string, end: string, hit: OverlapRow): Error {
  const name = hit.period_name ? `"${hit.period_name}"` : 'another period';
  return Object.assign(
    new Error(`These dates (${start} to ${end}) overlap ${name} (${ymd(hit.start_date)} to ${ymd(hit.end_date)}) of this client. Choose dates that do not overlap it, or change that period first.`),
    { code: 'PERIOD_OVERLAPS', status: 409, expose: true, overlaps: { id: hit.id, periodName: hit.period_name } },
  );
}

/**
 * Refuses a period of `clientId` with these dates when they overlap another of
 * its periods. `self` is the period being re-dated (it does not clash with
 * itself), with its current dates: a period it overlaps already is let be.
 */
export async function assertNoPeriodOverlap(
  trx: Knex.Transaction,
  clientId: number,
  dates: { start: unknown; end: unknown },
  self?: { id: number; start: unknown; end: unknown },
): Promise<void> {
  const start = ymd(dates.start);
  const end = ymd(dates.end);
  if (!start || !end) return;
  await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [PERIOD_DATES_LOCK, clientId]);
  const hits = await overlapping(trx, clientId, start, end, self?.id);
  if (hits.length === 0) return;
  const wasStart = ymd(self?.start);
  const wasEnd = ymd(self?.end);
  const already = self && wasStart && wasEnd ? new Set((await overlapping(trx, clientId, wasStart, wasEnd, self.id)).map((h) => h.id)) : new Set<number>();
  const fresh = hits.find((h) => !already.has(h.id));
  if (fresh) throw overlapError(start, end, fresh);
}
