"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJournalEntries = getJournalEntries;
exports.createJournalEntry = createJournalEntry;
const db_1 = require("../../db");
const periodGuard_1 = require("../../lib/periodGuard");
async function getJournalEntries(periodId, type) {
    let q = (0, db_1.db)('journal_entries').where({ period_id: periodId });
    if (type)
        q = q.where({ entry_type: type });
    const entries = await q.orderBy('entry_type').orderBy('entry_number');
    const entryIds = entries.map((e) => e.id);
    const lines = entryIds.length > 0
        ? await (0, db_1.db)('journal_entry_lines')
            .whereIn('journal_entry_id', entryIds)
            .join('chart_of_accounts', 'chart_of_accounts.id', 'journal_entry_lines.account_id')
            .select('journal_entry_lines.*', 'chart_of_accounts.account_number', 'chart_of_accounts.account_name')
        : [];
    const linesByEntry = {};
    for (const l of lines) {
        const jeId = l.journal_entry_id;
        (linesByEntry[jeId] = linesByEntry[jeId] || []).push({
            account_id: l.account_id,
            account_number: l.account_number,
            account_name: l.account_name,
            debit: Number(l.debit),
            credit: Number(l.credit),
        });
    }
    return entries.map((e) => ({
        ...e,
        lines: linesByEntry[e.id] ?? [],
    }));
}
async function createJournalEntry(data, userId) {
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
        return { error: `Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}` };
    }
    try {
        let result;
        await db_1.db.transaction(async (trx) => {
            await (0, periodGuard_1.assertPeriodUnlocked)(data.periodId, trx);
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
            await trx('journal_entry_lines').insert(data.lines.map((l) => ({
                journal_entry_id: entry.id,
                account_id: l.accountId,
                debit: l.debit,
                credit: l.credit,
            })));
            await (0, periodGuard_1.logAudit)({
                userId,
                periodId: data.periodId,
                entityType: 'journal_entry',
                entityId: entry.id,
                action: 'create',
                description: `Created ${data.entryType} AJE #${entryNumber} via MCP${data.description ? ': ' + data.description : ''}`,
            }, trx);
            result = { ...entry, lines: data.lines.map((l) => ({ account_id: l.accountId, account_number: '', account_name: '', debit: l.debit, credit: l.credit })) };
        });
        return { entry: result };
    }
    catch (err) {
        const e = err;
        if (e.code === 'PERIOD_LOCKED')
            return { error: e.message ?? 'Period is locked.' };
        return { error: err instanceof Error ? err.message : 'Unknown error' };
    }
}
//# sourceMappingURL=journalEntryService.js.map