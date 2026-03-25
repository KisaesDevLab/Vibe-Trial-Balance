"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeriods = getPeriods;
exports.getPeriod = getPeriod;
exports.lockPeriod = lockPeriod;
exports.unlockPeriod = unlockPeriod;
const db_1 = require("../../db");
const periodGuard_1 = require("../../lib/periodGuard");
async function getPeriods(clientId) {
    return (0, db_1.db)('periods').where({ client_id: clientId }).orderBy('end_date', 'desc');
}
async function getPeriod(id) {
    return (0, db_1.db)('periods').where({ id }).first('*');
}
async function lockPeriod(id, userId) {
    // Check TB balanced
    const tbRows = await (0, db_1.db)('v_adjusted_trial_balance').where({ period_id: id });
    if (tbRows.length > 0) {
        const bkDr = tbRows.reduce((s, r) => s + Number(r.book_adjusted_debit), 0);
        const bkCr = tbRows.reduce((s, r) => s + Number(r.book_adjusted_credit), 0);
        if (Math.abs(bkDr - bkCr) > 0) {
            const diff = (Math.abs(bkDr - bkCr) / 100).toFixed(2);
            return { period: {}, error: `Trial balance is out of balance by $${diff}. Resolve before locking.` };
        }
    }
    const [updated] = await (0, db_1.db)('periods')
        .where({ id })
        .update({ locked_at: db_1.db.fn.now(), locked_by: userId })
        .returning('*');
    if (!updated)
        return { period: {}, error: 'Period not found' };
    await (0, periodGuard_1.logAudit)({ userId, periodId: id, entityType: 'period', entityId: id, action: 'lock', description: `Locked period "${updated.period_name}" via MCP` });
    return { period: updated };
}
async function unlockPeriod(id, userId) {
    const [updated] = await (0, db_1.db)('periods')
        .where({ id })
        .update({ locked_at: null, locked_by: null })
        .returning('*');
    if (!updated)
        return { period: {}, error: 'Period not found' };
    await (0, periodGuard_1.logAudit)({ userId, periodId: id, entityType: 'period', entityId: id, action: 'unlock', description: `Unlocked period "${updated.period_name}" via MCP` });
    return { period: updated };
}
//# sourceMappingURL=periodService.js.map