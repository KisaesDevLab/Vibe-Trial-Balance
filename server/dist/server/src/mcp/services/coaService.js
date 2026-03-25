"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChartOfAccounts = getChartOfAccounts;
const db_1 = require("../../db");
async function getChartOfAccounts(clientId, filters) {
    let q = (0, db_1.db)('chart_of_accounts as coa')
        .leftJoin('tax_codes as tc', 'tc.id', 'coa.tax_code_id')
        .where({ 'coa.client_id': clientId, 'coa.is_active': true })
        .select('coa.*', 'tc.tax_code as tax_code_string');
    if (filters?.category) {
        q = q.where('coa.category', filters.category);
    }
    if (filters?.unmapped) {
        q = q.whereNull('coa.tax_code_id');
    }
    if (filters?.search) {
        const term = `%${filters.search.toLowerCase()}%`;
        q = q.where((builder) => {
            builder.whereRaw('LOWER(coa.account_name) LIKE ?', [term])
                .orWhereRaw('LOWER(coa.account_number) LIKE ?', [term]);
        });
    }
    const rows = await q.orderBy('coa.account_number', 'asc');
    return rows.map((r) => ({
        id: r.id,
        client_id: r.client_id,
        account_number: r.account_number,
        account_name: r.account_name,
        category: r.category,
        subcategory: r.subcategory,
        normal_balance: r.normal_balance,
        tax_line: r.tax_line,
        tax_code_id: r.tax_code_id,
        tax_code: r.tax_code_string,
        is_active: r.is_active,
        unit: r.unit,
    }));
}
//# sourceMappingURL=coaService.js.map