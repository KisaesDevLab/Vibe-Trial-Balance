"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollForwardRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const periodGuard_1 = require("../lib/periodGuard");
exports.rollForwardRouter = (0, express_1.Router)();
exports.rollForwardRouter.use(auth_1.authMiddleware);
// POST /api/v1/periods/:id/roll-forward
exports.rollForwardRouter.post('/', async (req, res) => {
    const sourceId = Number(req.params.id);
    if (isNaN(sourceId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid period ID' } });
        return;
    }
    const schema = zod_1.z.object({
        periodName: zod_1.z.string().min(1).max(100),
        startDate: zod_1.z.string().optional(),
        endDate: zod_1.z.string().optional(),
        isCurrent: zod_1.z.boolean().optional(),
        copyRecurringJEs: zod_1.z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
        return;
    }
    const { periodName, startDate, endDate, isCurrent, copyRecurringJEs } = parsed.data;
    try {
        const sourcePeriod = await (0, db_1.db)('periods').where({ id: sourceId }).first();
        if (!sourcePeriod) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Source period not found' } });
            return;
        }
        const newPeriod = await db_1.db.transaction(async (trx) => {
            // Clear current flag if needed
            if (isCurrent) {
                await trx('periods').where({ client_id: sourcePeriod.client_id }).update({ is_current: false });
            }
            // Create new period
            const [period] = await trx('periods').insert({
                client_id: sourcePeriod.client_id,
                period_name: periodName,
                start_date: startDate ?? null,
                end_date: endDate ?? null,
                is_current: isCurrent ?? false,
                rolled_forward_from: sourceId,
            }).returning('*');
            // Copy TB rows: book_adjusted balances become new unadjusted balances
            const tbRows = await trx('v_adjusted_trial_balance').where({ period_id: sourceId });
            if (tbRows.length > 0) {
                await trx('trial_balance').insert(tbRows.map((r) => ({
                    period_id: period.id,
                    account_id: r.account_id,
                    unadjusted_debit: Number(r.book_adjusted_debit),
                    unadjusted_credit: Number(r.book_adjusted_credit),
                    updated_by: req.user.userId,
                })));
            }
            // Copy tickmark assignments
            const tbTickmarks = await trx('tb_tickmarks').where({ period_id: sourceId });
            if (tbTickmarks.length > 0) {
                await trx('tb_tickmarks').insert(tbTickmarks.map((tm) => ({
                    period_id: period.id,
                    account_id: tm.account_id,
                    tickmark_id: tm.tickmark_id,
                    created_by: req.user.userId,
                })));
            }
            // Copy recurring JEs
            let jeCopied = 0;
            if (copyRecurringJEs) {
                const recurringJEs = await trx('journal_entries')
                    .where({ period_id: sourceId, is_recurring: true })
                    .whereIn('entry_type', ['book', 'tax']);
                for (const je of recurringJEs) {
                    const lines = await trx('journal_entry_lines').where({ journal_entry_id: je.id });
                    if (lines.length === 0)
                        continue;
                    const lastEntry = await trx('journal_entries')
                        .where({ period_id: period.id, entry_type: je.entry_type })
                        .max('entry_number as max').first();
                    const entryNumber = (lastEntry?.max ?? 0) + 1;
                    const jeDate = startDate ?? new Date().toISOString().slice(0, 10);
                    const [newJe] = await trx('journal_entries').insert({
                        period_id: period.id,
                        entry_number: entryNumber,
                        entry_type: je.entry_type,
                        entry_date: jeDate,
                        description: je.description,
                        is_recurring: true,
                        created_by: req.user.userId,
                    }).returning('*');
                    await trx('journal_entry_lines').insert(lines.map((l) => ({
                        journal_entry_id: newJe.id,
                        account_id: l.account_id,
                        debit: Number(l.debit),
                        credit: Number(l.credit),
                    })));
                    jeCopied++;
                }
            }
            await (0, periodGuard_1.logAudit)({
                userId: req.user.userId,
                periodId: period.id,
                entityType: 'period',
                entityId: period.id,
                action: 'create',
                description: `Rolled forward from "${sourcePeriod.period_name}" — ${tbRows.length} TB accounts, ${jeCopied} recurring JEs, ${tbTickmarks.length} tickmark assignments copied`,
            }, trx);
            return { period, tbCount: tbRows.length, jeCopied };
        });
        res.status(201).json({ data: newPeriod, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=rollForward.js.map