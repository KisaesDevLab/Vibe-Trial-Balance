import { db } from '../../db';

export interface COAAccount {
  id: number;
  client_id: number;
  account_number: string;
  account_name: string;
  category: string;
  subcategory: string | null;
  normal_balance: string;
  tax_line: string | null;
  tax_code_id: number | null;
  tax_code?: string | null;
  is_active: boolean;
  unit: string | null;
}

export interface COAFilters {
  category?: string;
  unmapped?: boolean;
  search?: string;
}

export async function getChartOfAccounts(clientId: number, filters?: COAFilters): Promise<COAAccount[]> {
  let q = db('chart_of_accounts as coa')
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

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    client_id: r.client_id as number,
    account_number: r.account_number as string,
    account_name: r.account_name as string,
    category: r.category as string,
    subcategory: r.subcategory as string | null,
    normal_balance: r.normal_balance as string,
    tax_line: r.tax_line as string | null,
    tax_code_id: r.tax_code_id as number | null,
    tax_code: r.tax_code_string as string | null,
    is_active: r.is_active as boolean,
    unit: r.unit as string | null,
  }));
}
