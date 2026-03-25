"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClients = getClients;
exports.getClient = getClient;
exports.getClientDashboard = getClientDashboard;
const db_1 = require("../../db");
async function getClients() {
    return (0, db_1.db)('clients').select('*').orderBy('name');
}
async function getClient(id) {
    return (0, db_1.db)('clients').where({ id }).first('*');
}
async function getClientDashboard(periodId) {
    const period = await (0, db_1.db)('periods')
        .leftJoin('app_users as locker', 'locker.id', 'periods.locked_by')
        .leftJoin('clients', 'clients.id', 'periods.client_id')
        .where('periods.id', periodId)
        .first('periods.*', 'locker.display_name as locked_by_name', 'clients.name as client_name');
    if (!period)
        return null;
    const jeCounts = await (0, db_1.db)('journal_entries')
        .where({ period_id: periodId })
        .groupBy('entry_type')
        .select('entry_type')
        .count('* as count');
    const jeByType = {};
    for (const r of jeCounts)
        jeByType[r.entry_type] = Number(r.count);
    const btCounts = await (0, db_1.db)('bank_transactions')
        .where({ client_id: period.client_id, period_id: periodId })
        .groupBy('classification_status')
        .select('classification_status')
        .count('* as count');
    const btByStatus = {};
    for (const r of btCounts)
        btByStatus[r.classification_status] = Number(r.count);
    const tbCheck = await (0, db_1.db)('v_adjusted_trial_balance')
        .where({ period_id: periodId })
        .sum('book_adjusted_debit as total_debit')
        .sum('book_adjusted_credit as total_credit')
        .first();
    const totalDebit = Number(tbCheck?.total_debit ?? 0);
    const totalCredit = Number(tbCheck?.total_credit ?? 0);
    const auditLog = await (0, db_1.db)('audit_log')
        .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
        .where('audit_log.period_id', periodId)
        .orderBy('audit_log.created_at', 'desc')
        .limit(10)
        .select('audit_log.id', 'audit_log.entity_type', 'audit_log.action', 'audit_log.description', 'audit_log.created_at', 'app_users.display_name as user_name');
    return {
        period: period,
        stats: {
            je: { book: jeByType['book'] ?? 0, tax: jeByType['tax'] ?? 0, trans: jeByType['trans'] ?? 0 },
            bank_transactions: {
                unclassified: btByStatus['unclassified'] ?? 0,
                classified: btByStatus['classified'] ?? 0,
                confirmed: btByStatus['confirmed'] ?? 0,
                manual: btByStatus['manual'] ?? 0,
            },
            trial_balance: {
                total_debit: totalDebit,
                total_credit: totalCredit,
                is_balanced: totalDebit === totalCredit,
                total_debit_dollars: (totalDebit / 100).toFixed(2),
                total_credit_dollars: (totalCredit / 100).toFixed(2),
            },
        },
        recent_audit: auditLog,
    };
}
//# sourceMappingURL=clientService.js.map