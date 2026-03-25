"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrialBalance = getTrialBalance;
exports.upsertTrialBalance = upsertTrialBalance;
const db_1 = require("../../db");
const periodGuard_1 = require("../../lib/periodGuard");
function parseBigInt(v) {
    if (v === null || v === undefined)
        return 0;
    return Number(v);
}
async function getTrialBalance(periodId, category) {
    let q = (0, db_1.db)('v_adjusted_trial_balance')
        .where({ period_id: periodId, is_active: true });
    if (category)
        q = q.where({ category });
    const rows = await q.orderBy('account_number', 'asc');
    const mapped = rows.map((r) => ({
        account_id: r.account_id,
        account_number: r.account_number,
        account_name: r.account_name,
        category: r.category,
        normal_balance: r.normal_balance,
        unadjusted_debit_dollars: (parseBigInt(r.unadjusted_debit) / 100).toFixed(2),
        unadjusted_credit_dollars: (parseBigInt(r.unadjusted_credit) / 100).toFixed(2),
        book_adjusted_debit_dollars: (parseBigInt(r.book_adjusted_debit) / 100).toFixed(2),
        book_adjusted_credit_dollars: (parseBigInt(r.book_adjusted_credit) / 100).toFixed(2),
        tax_adjusted_debit_dollars: (parseBigInt(r.tax_adjusted_debit) / 100).toFixed(2),
        tax_adjusted_credit_dollars: (parseBigInt(r.tax_adjusted_credit) / 100).toFixed(2),
        tax_line: r.tax_line,
    }));
    const totalUnadjDr = rows.reduce((s, r) => s + parseBigInt(r.unadjusted_debit), 0);
    const totalUnadjCr = rows.reduce((s, r) => s + parseBigInt(r.unadjusted_credit), 0);
    const totalBkDr = rows.reduce((s, r) => s + parseBigInt(r.book_adjusted_debit), 0);
    const totalBkCr = rows.reduce((s, r) => s + parseBigInt(r.book_adjusted_credit), 0);
    const diff = Math.abs(totalBkDr - totalBkCr);
    return {
        rows: mapped,
        totals: {
            unadjusted_debit_dollars: (totalUnadjDr / 100).toFixed(2),
            unadjusted_credit_dollars: (totalUnadjCr / 100).toFixed(2),
            book_adjusted_debit_dollars: (totalBkDr / 100).toFixed(2),
            book_adjusted_credit_dollars: (totalBkCr / 100).toFixed(2),
            is_balanced: diff === 0,
            out_of_balance_dollars: (diff / 100).toFixed(2),
        },
    };
}
async function upsertTrialBalance(periodId, accountId, debitCents, creditCents, userId) {
    try {
        await (0, periodGuard_1.assertPeriodUnlocked)(periodId);
        await (0, db_1.db)('trial_balance')
            .insert({
            period_id: periodId,
            account_id: accountId,
            unadjusted_debit: debitCents,
            unadjusted_credit: creditCents,
            updated_by: userId,
            updated_at: db_1.db.fn.now(),
        })
            .onConflict(['period_id', 'account_id'])
            .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);
        return { success: true };
    }
    catch (err) {
        const e = err;
        if (e.code === 'PERIOD_LOCKED')
            return { success: false, error: e.message };
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}
//# sourceMappingURL=trialBalanceService.js.map