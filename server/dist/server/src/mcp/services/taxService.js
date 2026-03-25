"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaxMappingStatus = getTaxMappingStatus;
exports.confirmTaxAssignments = confirmTaxAssignments;
const db_1 = require("../../db");
async function getTaxMappingStatus(clientId) {
    const client = await (0, db_1.db)('clients').where({ id: clientId }).first('id', 'name', 'entity_type');
    if (!client)
        return null;
    const accounts = await (0, db_1.db)('chart_of_accounts')
        .where({ client_id: clientId, is_active: true })
        .select('id', 'account_number', 'account_name', 'category', 'tax_code_id');
    const total = accounts.length;
    const mapped = accounts.filter((a) => a.tax_code_id !== null).length;
    const unmapped = total - mapped;
    const unmappedList = accounts
        .filter((a) => a.tax_code_id === null)
        .map((a) => ({
        id: a.id,
        account_number: a.account_number,
        account_name: a.account_name,
        category: a.category,
    }));
    return {
        clientId,
        clientName: client.name,
        entityType: client.entity_type ?? 'unknown',
        totalAccounts: total,
        mappedAccounts: mapped,
        unmappedAccounts: unmapped,
        mappingPercent: total > 0 ? Math.round((mapped / total) * 100) : 0,
        unmappedList,
    };
}
async function confirmTaxAssignments(assignments, userId) {
    const results = [];
    await db_1.db.transaction(async (trx) => {
        for (const assignment of assignments) {
            const { accountId, taxCodeId, source, confidence } = assignment;
            if (!accountId || isNaN(accountId)) {
                results.push({ accountId: accountId ?? 0, success: false, error: 'Invalid accountId' });
                continue;
            }
            const updates = {
                tax_code_id: taxCodeId ?? null,
                tax_line_source: source ?? 'manual',
                tax_line_confidence: confidence != null ? confidence : null,
                updated_at: trx.fn.now(),
            };
            if (taxCodeId != null) {
                const tc = await trx('tax_codes').where({ id: taxCodeId }).first('tax_code');
                updates.tax_line = tc?.tax_code ?? null;
            }
            else {
                updates.tax_line = null;
            }
            const [updated] = await trx('chart_of_accounts')
                .where({ id: accountId })
                .update(updates)
                .returning('id');
            if (updated) {
                results.push({ accountId, success: true });
            }
            else {
                results.push({ accountId, success: false, error: 'Account not found' });
            }
        }
    });
    const successCount = results.filter((r) => r.success).length;
    // Log to audit
    try {
        await (0, db_1.db)('audit_log').insert({
            user_id: userId,
            period_id: null,
            entity_type: 'mcp_tool',
            entity_id: null,
            action: 'confirm_tax_assignments',
            description: `MCP confirmed ${successCount} tax code assignments`,
        });
    }
    catch { /* audit failures never block */ }
    return { updated: successCount, failed: results.length - successCount, results };
}
//# sourceMappingURL=taxService.js.map