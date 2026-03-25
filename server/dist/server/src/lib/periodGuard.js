"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPeriodUnlocked = assertPeriodUnlocked;
exports.logAudit = logAudit;
const db_1 = require("../db");
/** Throws a 409-coded error if the period is locked. Pass a transaction or the global db. */
async function assertPeriodUnlocked(periodId, trx) {
    const q = trx ?? db_1.db;
    const period = await q('periods').where({ id: periodId }).first('locked_at');
    if (period?.locked_at) {
        throw Object.assign(new Error('This period is locked and cannot be modified. Unlock it first.'), { code: 'PERIOD_LOCKED', status: 409 });
    }
}
/** Insert a row into audit_log. Fire-and-forget safe — errors are silently swallowed. */
async function logAudit(entry, trx) {
    const q = trx ?? db_1.db;
    try {
        await q('audit_log').insert({
            user_id: entry.userId ?? null,
            period_id: entry.periodId ?? null,
            entity_type: entry.entityType,
            entity_id: entry.entityId ?? null,
            action: entry.action,
            description: entry.description ?? null,
        });
    }
    catch {
        // Audit failures must never block the main operation
    }
}
//# sourceMappingURL=periodGuard.js.map