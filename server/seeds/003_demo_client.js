/**
 * Demo client with sample COA, period, and trial balance
 * Run with: npx knex seed:run --specific=003_demo_client.js
 */
exports.seed = async function (knex) {
  // Check if demo client already exists
  const existing = await knex('clients').where({ name: 'Demo Company LLC' }).first();
  if (existing) return;

  const [client] = await knex('clients').insert({
    name: 'Demo Company LLC',
    entity_type: '1120S',
    tax_year_end: '1231',
    is_active: true,
  }).returning('*');

  const accounts = [
    { account_number: '1000', account_name: 'Cash - Operating',         category: 'assets',      normal_balance: 'debit',  tax_line: null,      cash_flow_category: 'cash' },
    { account_number: '1100', account_name: 'Accounts Receivable',      category: 'assets',      normal_balance: 'debit',  tax_line: null,      cash_flow_category: 'operating' },
    { account_number: '1500', account_name: 'Property & Equipment',     category: 'assets',      normal_balance: 'debit',  tax_line: null,      cash_flow_category: 'investing' },
    { account_number: '2000', account_name: 'Accounts Payable',         category: 'liabilities', normal_balance: 'credit', tax_line: null,      cash_flow_category: 'operating' },
    { account_number: '2100', account_name: 'Accrued Liabilities',      category: 'liabilities', normal_balance: 'credit', tax_line: null,      cash_flow_category: 'operating' },
    { account_number: '2500', account_name: 'Notes Payable',            category: 'liabilities', normal_balance: 'credit', tax_line: null,      cash_flow_category: 'financing' },
    { account_number: '3000', account_name: 'Common Stock',             category: 'equity',      normal_balance: 'credit', tax_line: null,      cash_flow_category: null },
    { account_number: '3100', account_name: 'Retained Earnings',        category: 'equity',      normal_balance: 'credit', tax_line: null,      cash_flow_category: null },
    { account_number: '4000', account_name: 'Service Revenue',          category: 'revenue',     normal_balance: 'credit', tax_line: '1120S-1a', cash_flow_category: null },
    { account_number: '4100', account_name: 'Product Sales',            category: 'revenue',     normal_balance: 'credit', tax_line: '1120S-1c', cash_flow_category: null },
    { account_number: '5000', account_name: 'Cost of Goods Sold',       category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-2',  cash_flow_category: null },
    { account_number: '6000', account_name: 'Salaries & Wages',         category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-8',  cash_flow_category: null },
    { account_number: '6100', account_name: 'Rent Expense',             category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-12', cash_flow_category: null },
    { account_number: '6200', account_name: 'Depreciation Expense',     category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-14', cash_flow_category: 'non_cash' },
    { account_number: '6300', account_name: 'Professional Fees',        category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-19', cash_flow_category: null },
    { account_number: '6400', account_name: 'Utilities Expense',        category: 'expenses',    normal_balance: 'debit',  tax_line: '1120S-19', cash_flow_category: null },
  ];

  const insertedAccounts = await knex('chart_of_accounts')
    .insert(accounts.map(a => ({ ...a, client_id: client.id, is_active: true, subcategory: null })))
    .returning('*');

  const acctMap = new Map(insertedAccounts.map((a) => [a.account_number, a.id]));

  const [period] = await knex('periods').insert({
    client_id: client.id,
    period_name: 'FY 2024',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    is_current: true,
  }).returning('*');

  // Insert trial balance rows
  const tbData = [
    { account_number: '1000', unadj_dr: 15000000,  unadj_cr: 0,        py_dr: 12000000,  py_cr: 0 },
    { account_number: '1100', unadj_dr: 8500000,   unadj_cr: 0,        py_dr: 7200000,   py_cr: 0 },
    { account_number: '1500', unadj_dr: 25000000,  unadj_cr: 0,        py_dr: 22000000,  py_cr: 0 },
    { account_number: '2000', unadj_dr: 0,         unadj_cr: 4200000,  py_dr: 0,         py_cr: 3800000 },
    { account_number: '2100', unadj_dr: 0,         unadj_cr: 1500000,  py_dr: 0,         py_cr: 1200000 },
    { account_number: '2500', unadj_dr: 0,         unadj_cr: 10000000, py_dr: 0,         py_cr: 12000000 },
    { account_number: '3000', unadj_dr: 0,         unadj_cr: 5000000,  py_dr: 0,         py_cr: 5000000 },
    { account_number: '3100', unadj_dr: 0,         unadj_cr: 19800000, py_dr: 0,         py_cr: 15200000 },
    { account_number: '4000', unadj_dr: 0,         unadj_cr: 45000000, py_dr: 0,         py_cr: 38000000 },
    { account_number: '4100', unadj_dr: 0,         unadj_cr: 22000000, py_dr: 0,         py_cr: 18500000 },
    { account_number: '5000', unadj_dr: 28000000,  unadj_cr: 0,        py_dr: 23500000,  py_cr: 0 },
    { account_number: '6000', unadj_dr: 18000000,  unadj_cr: 0,        py_dr: 16000000,  py_cr: 0 },
    { account_number: '6100', unadj_dr: 4800000,   unadj_cr: 0,        py_dr: 4800000,   py_cr: 0 },
    { account_number: '6200', unadj_dr: 2500000,   unadj_cr: 0,        py_dr: 2200000,   py_cr: 0 },
    { account_number: '6300', unadj_dr: 1200000,   unadj_cr: 0,        py_dr: 950000,    py_cr: 0 },
    { account_number: '6400', unadj_dr: 500000,    unadj_cr: 0,        py_dr: 450000,    py_cr: 0 },
  ];

  await knex('trial_balance').insert(
    tbData.map(t => ({
      period_id: period.id,
      account_id: acctMap.get(t.account_number),
      unadjusted_debit: t.unadj_dr,
      unadjusted_credit: t.unadj_cr,
      prior_year_debit: t.py_dr,
      prior_year_credit: t.py_cr,
    }))
  );

  // Sample book AJE - depreciation
  const [je] = await knex('journal_entries').insert({
    period_id: period.id,
    entry_number: 1,
    entry_type: 'book',
    entry_date: '2024-12-31',
    description: 'Year-end depreciation adjustment',
    is_recurring: true,
  }).returning('*');

  await knex('journal_entry_lines').insert([
    { journal_entry_id: je.id, account_id: acctMap.get('6200'), debit: 500000, credit: 0 },
    { journal_entry_id: je.id, account_id: acctMap.get('1500'), debit: 0, credit: 500000 },
  ]);

  // Sample tickmarks
  await knex('tickmark_library').insert([
    { client_id: client.id, symbol: 'A', description: 'Agreed to bank statement', color: 'green', sort_order: 1 },
    { client_id: client.id, symbol: 'B', description: 'Agreed to prior year return', color: 'blue', sort_order: 2 },
    { client_id: client.id, symbol: 'T', description: 'Traced to supporting schedule', color: 'purple', sort_order: 3 },
    { client_id: client.id, symbol: '✓', description: 'Verified and agreed', color: 'gray', sort_order: 4 },
  ]);

  console.log('Demo client seeded: Demo Company LLC (1120S, FY 2024)');
};
