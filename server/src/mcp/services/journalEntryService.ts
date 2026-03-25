import { db } from '../../db';
import { assertPeriodUnlocked, logAudit } from '../../lib/periodGuard';

export interface JELine {
  accountId: number;
  debit: number;
  credit: number;
}

export interface CreateJEInput {
  periodId: number;
  entryType: 'book' | 'tax';
  entryDate: string;
  description?: string;
  lines: JELine[];
}

export interface JournalEntry {
  id: number;
  period_id: number;
  entry_number: number;
  entry_type: string;
  entry_date: string;
  description: string | null;
  lines: Array<{ account_id: number; account_number: string; account_name: string; debit: number; credit: number }>;
}

export async function getJournalEntries(periodId: number, type?: string): Promise<JournalEntry[]> {
  let q = db('journal_entries').where({ period_id: periodId });
  if (type) q = q.where({ entry_type: type });
  const entries = await q.orderBy('entry_type').orderBy('entry_number');

  const entryIds = entries.map((e: { id: number }) => e.id);
  const lines = entryIds.length > 0
    ? await db('journal_entry_lines')
        .whereIn('journal_entry_id', entryIds)
        .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
        .select('journal_entry_lines.*', 'chart_of_accounts.account_number', 'chart_of_accounts.account_name')
    : [];

  const linesByEntry: Record<number, JournalEntry['lines']> = {};
  for (const l of lines as Record<string, unknown>[]) {
    const jeId = l.journal_entry_id as number;
    (linesByEntry[jeId] = linesByEntry[jeId] || []).push({
      account_id: l.account_id as number,
      account_number: l.account_number as string,
      account_name: l.account_name as string,
      debit: Number(l.debit),
      credit: Number(l.credit),
    });
  }

  return entries.map((e: Record<string, unknown>) => ({
    ...(e as object),
    lines: linesByEntry[e.id as number] ?? [],
  })) as JournalEntry[];
}

export async function createJournalEntry(data: CreateJEInput, userId: number): Promise<{ entry?: JournalEntry; error?: string }> {
  const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) {
    return { error: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` };
  }

  try {
    let result: JournalEntry | undefined;
    await db.transaction(async (trx) => {
      await assertPeriodUnlocked(data.periodId, trx);

      const lastEntry = await trx('journal_entries')
        .where({ period_id: data.periodId, entry_type: data.entryType })
        .max('entry_number as max')
        .first();
      const entryNumber = (lastEntry?.max ?? 0) + 1;

      const [entry] = await trx('journal_entries')
        .insert({
          period_id: data.periodId,
          entry_number: entryNumber,
          entry_type: data.entryType,
          entry_date: data.entryDate,
          description: data.description ?? null,
          is_recurring: false,
          created_by: userId,
        })
        .returning('*');

      await trx('journal_entry_lines').insert(
        data.lines.map((l) => ({
          journal_entry_id: entry.id,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      );

      await logAudit({
        userId,
        periodId: data.periodId,
        entityType: 'journal_entry',
        entityId: entry.id,
        action: 'create',
        description: `Created ${data.entryType} AJE #${entryNumber} via MCP${data.description ? ': ' + data.description : ''}`,
      }, trx);

      result = { ...entry, lines: data.lines.map((l) => ({ account_id: l.accountId, account_number: '', account_name: '', debit: l.debit, credit: l.credit })) } as JournalEntry;
    });
    return { entry: result };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'PERIOD_LOCKED') return { error: e.message ?? 'Period is locked.' };
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
