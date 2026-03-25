/**
 * Comprehensive demo: Summit Ridge Consulting LLC
 * S-Corp IT consulting & project management firm, FY 2024
 *
 * Includes: 50-account COA, unadjusted TB with PY, bank transactions (mix of
 * classified/unclassified), manual transaction entries, and book AJEs.
 * Tax codes are intentionally left unmapped for AI testing.
 */
exports.seed = async function (knex) {
  const existing = await knex('clients').where({ name: 'Summit Ridge Consulting LLC' }).first();
  if (existing) return;

  // ── Client ──────────────────────────────────────────────────────────────────
  const [client] = await knex('clients').insert({
    name: 'Summit Ridge Consulting LLC',
    entity_type: '1120S',
    activity_type: 'business',
    tax_year_end: '1231',
    is_active: true,
  }).returning('*');

  // ── Chart of Accounts ──────────────────────────────────────────────────────
  const accounts = [
    // Assets
    { account_number: '1000', account_name: 'Cash - Operating Checking',  category: 'assets',      subcategory: 'cash',              normal_balance: 'debit',  cash_flow_category: 'cash' },
    { account_number: '1010', account_name: 'Cash - Business Savings',    category: 'assets',      subcategory: 'cash',              normal_balance: 'debit',  cash_flow_category: 'cash' },
    { account_number: '1020', account_name: 'Petty Cash',                 category: 'assets',      subcategory: 'cash',              normal_balance: 'debit',  cash_flow_category: 'cash' },
    { account_number: '1100', account_name: 'Accounts Receivable',        category: 'assets',      subcategory: 'current',           normal_balance: 'debit',  cash_flow_category: 'operating' },
    { account_number: '1200', account_name: 'Employee Advances',          category: 'assets',      subcategory: 'current',           normal_balance: 'debit',  cash_flow_category: 'operating' },
    { account_number: '1300', account_name: 'Prepaid Insurance',          category: 'assets',      subcategory: 'current',           normal_balance: 'debit',  cash_flow_category: 'operating' },
    { account_number: '1310', account_name: 'Prepaid Rent',               category: 'assets',      subcategory: 'current',           normal_balance: 'debit',  cash_flow_category: 'operating' },
    { account_number: '1500', account_name: 'Furniture & Equipment',      category: 'assets',      subcategory: 'fixed',             normal_balance: 'debit',  cash_flow_category: 'investing' },
    { account_number: '1510', account_name: 'Computer Equipment',         category: 'assets',      subcategory: 'fixed',             normal_balance: 'debit',  cash_flow_category: 'investing' },
    { account_number: '1520', account_name: 'Vehicles',                   category: 'assets',      subcategory: 'fixed',             normal_balance: 'debit',  cash_flow_category: 'investing' },
    { account_number: '1550', account_name: 'Accum Depr - Furniture & Equip', category: 'assets',  subcategory: 'fixed',             normal_balance: 'credit', cash_flow_category: 'investing' },
    { account_number: '1560', account_name: 'Accum Depr - Computers',     category: 'assets',      subcategory: 'fixed',             normal_balance: 'credit', cash_flow_category: 'investing' },
    { account_number: '1570', account_name: 'Accum Depr - Vehicles',      category: 'assets',      subcategory: 'fixed',             normal_balance: 'credit', cash_flow_category: 'investing' },
    { account_number: '1600', account_name: 'Security Deposits',          category: 'assets',      subcategory: 'other',             normal_balance: 'debit',  cash_flow_category: 'investing' },
    // Liabilities
    { account_number: '2000', account_name: 'Accounts Payable',           category: 'liabilities', subcategory: 'current',           normal_balance: 'credit', cash_flow_category: 'operating' },
    { account_number: '2100', account_name: 'Credit Card Payable',        category: 'liabilities', subcategory: 'current',           normal_balance: 'credit', cash_flow_category: 'operating' },
    { account_number: '2200', account_name: 'Accrued Wages',              category: 'liabilities', subcategory: 'current',           normal_balance: 'credit', cash_flow_category: 'operating' },
    { account_number: '2210', account_name: 'Accrued Payroll Taxes',      category: 'liabilities', subcategory: 'current',           normal_balance: 'credit', cash_flow_category: 'operating' },
    { account_number: '2400', account_name: 'Current Portion - LTD',      category: 'liabilities', subcategory: 'current',           normal_balance: 'credit', cash_flow_category: 'financing' },
    { account_number: '2600', account_name: 'Vehicle Loan',               category: 'liabilities', subcategory: 'long-term',         normal_balance: 'credit', cash_flow_category: 'financing' },
    // Equity
    { account_number: '3000', account_name: 'Common Stock',               category: 'equity',      subcategory: null,                normal_balance: 'credit', cash_flow_category: null },
    { account_number: '3100', account_name: 'Additional Paid-In Capital', category: 'equity',      subcategory: null,                normal_balance: 'credit', cash_flow_category: null },
    { account_number: '3200', account_name: 'Retained Earnings',          category: 'equity',      subcategory: null,                normal_balance: 'credit', cash_flow_category: null },
    { account_number: '3300', account_name: 'Shareholder Distributions',  category: 'equity',      subcategory: null,                normal_balance: 'debit',  cash_flow_category: 'financing' },
    // Revenue
    { account_number: '4000', account_name: 'Consulting Revenue',         category: 'revenue',     subcategory: 'operating',         normal_balance: 'credit', cash_flow_category: null },
    { account_number: '4100', account_name: 'Project Revenue',            category: 'revenue',     subcategory: 'operating',         normal_balance: 'credit', cash_flow_category: null },
    { account_number: '4200', account_name: 'Retainer Revenue',           category: 'revenue',     subcategory: 'operating',         normal_balance: 'credit', cash_flow_category: null },
    { account_number: '4500', account_name: 'Interest Income',            category: 'revenue',     subcategory: 'other',             normal_balance: 'credit', cash_flow_category: null },
    { account_number: '4600', account_name: 'Other Income',               category: 'revenue',     subcategory: 'other',             normal_balance: 'credit', cash_flow_category: null },
    // Cost of Goods Sold
    { account_number: '5000', account_name: 'Contract Labor',             category: 'expenses',    subcategory: 'cost_of_sales',     normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '5100', account_name: 'Project Materials',          category: 'expenses',    subcategory: 'cost_of_sales',     normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '5200', account_name: 'Subcontractor Costs',        category: 'expenses',    subcategory: 'cost_of_sales',     normal_balance: 'debit',  cash_flow_category: null },
    // Operating Expenses
    { account_number: '6000', account_name: 'Salaries & Wages',           category: 'expenses',    subcategory: 'payroll',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6010', account_name: 'Payroll Taxes',              category: 'expenses',    subcategory: 'payroll',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6020', account_name: 'Employee Benefits',          category: 'expenses',    subcategory: 'payroll',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6030', account_name: 'Workers Compensation',       category: 'expenses',    subcategory: 'payroll',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6100', account_name: 'Rent Expense',               category: 'expenses',    subcategory: 'occupancy',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6110', account_name: 'Utilities',                  category: 'expenses',    subcategory: 'occupancy',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6120', account_name: 'Phone & Internet',           category: 'expenses',    subcategory: 'occupancy',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6200', account_name: 'Office Supplies',            category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6210', account_name: 'Computer & Software',        category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6220', account_name: 'Postage & Shipping',         category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6300', account_name: 'Insurance - General Liability', category: 'expenses', subcategory: 'insurance',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6310', account_name: 'Insurance - Professional Liability', category: 'expenses', subcategory: 'insurance',    normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6400', account_name: 'Advertising & Marketing',    category: 'expenses',    subcategory: 'marketing',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6410', account_name: 'Website & Hosting',          category: 'expenses',    subcategory: 'marketing',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6500', account_name: 'Travel',                     category: 'expenses',    subcategory: 'travel',            normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6510', account_name: 'Meals & Entertainment',      category: 'expenses',    subcategory: 'travel',            normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6520', account_name: 'Vehicle Expense',            category: 'expenses',    subcategory: 'travel',            normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6530', account_name: 'Fuel',                       category: 'expenses',    subcategory: 'travel',            normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6600', account_name: 'Professional Fees - Accounting', category: 'expenses', subcategory: 'professional',     normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6610', account_name: 'Professional Fees - Legal',  category: 'expenses',    subcategory: 'professional',      normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6700', account_name: 'Bank Service Charges',       category: 'expenses',    subcategory: 'financial',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6710', account_name: 'Interest Expense',           category: 'expenses',    subcategory: 'financial',         normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6800', account_name: 'Depreciation Expense',       category: 'expenses',    subcategory: 'non-cash',          normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6900', account_name: 'Licenses & Permits',         category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '6910', account_name: 'Continuing Education',       category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '7000', account_name: 'Miscellaneous Expense',      category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
    { account_number: '7100', account_name: 'Bad Debt Expense',           category: 'expenses',    subcategory: 'general',           normal_balance: 'debit',  cash_flow_category: null },
  ];

  const insertedAccounts = await knex('chart_of_accounts')
    .insert(accounts.map((a) => ({
      client_id: client.id,
      account_number: a.account_number,
      account_name: a.account_name,
      category: a.category,
      subcategory: a.subcategory,
      normal_balance: a.normal_balance,
      is_active: true,
      cash_flow_category: a.cash_flow_category,
      tax_line: null,
    })))
    .returning('*');

  const A = new Map(insertedAccounts.map((a) => [a.account_number, a.id]));

  // ── Period ─────────────────────────────────────────────────────────────────
  const [period] = await knex('periods').insert({
    client_id: client.id,
    period_name: 'FY 2024',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    is_current: true,
  }).returning('*');

  // ── Unadjusted Trial Balance ───────────────────────────────────────────────
  // All amounts in cents. TB balances: total debits = total credits.
  // Retained earnings (3200) is the plug to balance.
  //
  // Debit total:  103,115,817
  // Credit total (ex RE): 87,486,172
  // RE = 103,115,817 - 87,486,172 = 15,629,645

  const tbRows = [
    //                                        CY Debit      CY Credit    PY Debit      PY Credit
    { acct: '1000', unadj_dr: 8543217,   unadj_cr: 0,         py_dr: 7215000,   py_cr: 0 },
    { acct: '1010', unadj_dr: 2500000,   unadj_cr: 0,         py_dr: 1800000,   py_cr: 0 },
    { acct: '1020', unadj_dr: 50000,     unadj_cr: 0,         py_dr: 50000,     py_cr: 0 },
    { acct: '1100', unadj_dr: 6487500,   unadj_cr: 0,         py_dr: 5425000,   py_cr: 0 },
    { acct: '1200', unadj_dr: 150000,    unadj_cr: 0,         py_dr: 0,         py_cr: 0 },
    { acct: '1300', unadj_dr: 825000,    unadj_cr: 0,         py_dr: 750000,    py_cr: 0 },
    { acct: '1310', unadj_dr: 300000,    unadj_cr: 0,         py_dr: 300000,    py_cr: 0 },
    { acct: '1500', unadj_dr: 4500000,   unadj_cr: 0,         py_dr: 4500000,   py_cr: 0 },
    { acct: '1510', unadj_dr: 3200000,   unadj_cr: 0,         py_dr: 2400000,   py_cr: 0 },
    { acct: '1520', unadj_dr: 3850000,   unadj_cr: 0,         py_dr: 3850000,   py_cr: 0 },
    { acct: '1550', unadj_dr: 0,         unadj_cr: 1800000,   py_dr: 0,         py_cr: 1350000 },
    { acct: '1560', unadj_dr: 0,         unadj_cr: 2240000,   py_dr: 0,         py_cr: 1600000 },
    { acct: '1570', unadj_dr: 0,         unadj_cr: 1155000,   py_dr: 0,         py_cr: 770000 },
    { acct: '1600', unadj_dr: 300000,    unadj_cr: 0,         py_dr: 300000,    py_cr: 0 },
    { acct: '2000', unadj_dr: 0,         unadj_cr: 1287500,   py_dr: 0,         py_cr: 985000 },
    { acct: '2100', unadj_dr: 0,         unadj_cr: 843672,    py_dr: 0,         py_cr: 612000 },
    { acct: '2200', unadj_dr: 0,         unadj_cr: 0,         py_dr: 0,         py_cr: 0 },
    { acct: '2210', unadj_dr: 0,         unadj_cr: 0,         py_dr: 0,         py_cr: 0 },
    { acct: '2400', unadj_dr: 0,         unadj_cr: 480000,    py_dr: 0,         py_cr: 480000 },
    { acct: '2600', unadj_dr: 0,         unadj_cr: 2187500,   py_dr: 0,         py_cr: 2667500 },
    { acct: '3000', unadj_dr: 0,         unadj_cr: 100000,    py_dr: 0,         py_cr: 100000 },
    { acct: '3100', unadj_dr: 0,         unadj_cr: 5000000,   py_dr: 0,         py_cr: 5000000 },
    { acct: '3200', unadj_dr: 0,         unadj_cr: 15554645,  py_dr: 0,         py_cr: 11248000 },
    { acct: '3300', unadj_dr: 12000000,  unadj_cr: 0,         py_dr: 8500000,   py_cr: 0 },
    { acct: '4000', unadj_dr: 0,         unadj_cr: 48750000,  py_dr: 0,         py_cr: 42500000 },
    { acct: '4100', unadj_dr: 0,         unadj_cr: 19875000,  py_dr: 0,         py_cr: 16200000 },
    { acct: '4200', unadj_dr: 0,         unadj_cr: 3600000,   py_dr: 0,         py_cr: 3000000 },
    { acct: '4500', unadj_dr: 0,         unadj_cr: 42500,     py_dr: 0,         py_cr: 18500 },
    { acct: '4600', unadj_dr: 0,         unadj_cr: 125000,    py_dr: 0,         py_cr: 0 },
    { acct: '5000', unadj_dr: 8750000,   unadj_cr: 0,         py_dr: 7200000,   py_cr: 0 },
    { acct: '5100', unadj_dr: 3425000,   unadj_cr: 0,         py_dr: 2850000,   py_cr: 0 },
    { acct: '5200', unadj_dr: 6250000,   unadj_cr: 0,         py_dr: 5100000,   py_cr: 0 },
    { acct: '6000', unadj_dr: 28500000,  unadj_cr: 0,         py_dr: 24800000,  py_cr: 0 },
    { acct: '6010', unadj_dr: 2850000,   unadj_cr: 0,         py_dr: 2480000,   py_cr: 0 },
    { acct: '6020', unadj_dr: 1425000,   unadj_cr: 0,         py_dr: 1240000,   py_cr: 0 },
    { acct: '6030', unadj_dr: 285000,    unadj_cr: 0,         py_dr: 248000,    py_cr: 0 },
    { acct: '6100', unadj_dr: 3600000,   unadj_cr: 0,         py_dr: 3600000,   py_cr: 0 },
    { acct: '6110', unadj_dr: 485000,    unadj_cr: 0,         py_dr: 456000,    py_cr: 0 },
    { acct: '6120', unadj_dr: 384000,    unadj_cr: 0,         py_dr: 372000,    py_cr: 0 },
    { acct: '6200', unadj_dr: 287500,    unadj_cr: 0,         py_dr: 245000,    py_cr: 0 },
    { acct: '6210', unadj_dr: 612000,    unadj_cr: 0,         py_dr: 498000,    py_cr: 0 },
    { acct: '6220', unadj_dr: 42000,     unadj_cr: 0,         py_dr: 38000,     py_cr: 0 },
    { acct: '6300', unadj_dr: 485000,    unadj_cr: 0,         py_dr: 425000,    py_cr: 0 },
    { acct: '6310', unadj_dr: 375000,    unadj_cr: 0,         py_dr: 350000,    py_cr: 0 },
    { acct: '6400', unadj_dr: 225000,    unadj_cr: 0,         py_dr: 180000,    py_cr: 0 },
    { acct: '6410', unadj_dr: 189600,    unadj_cr: 0,         py_dr: 168000,    py_cr: 0 },
    { acct: '6500', unadj_dr: 487500,    unadj_cr: 0,         py_dr: 365000,    py_cr: 0 },
    { acct: '6510', unadj_dr: 312000,    unadj_cr: 0,         py_dr: 275000,    py_cr: 0 },
    { acct: '6520', unadj_dr: 195000,    unadj_cr: 0,         py_dr: 172000,    py_cr: 0 },
    { acct: '6530', unadj_dr: 287500,    unadj_cr: 0,         py_dr: 248000,    py_cr: 0 },
    { acct: '6600', unadj_dr: 350000,    unadj_cr: 0,         py_dr: 300000,    py_cr: 0 },
    { acct: '6610', unadj_dr: 125000,    unadj_cr: 0,         py_dr: 75000,     py_cr: 0 },
    { acct: '6700', unadj_dr: 48000,     unadj_cr: 0,         py_dr: 42000,     py_cr: 0 },
    { acct: '6710', unadj_dr: 187500,    unadj_cr: 0,         py_dr: 215000,    py_cr: 0 },
    { acct: '6800', unadj_dr: 0,         unadj_cr: 0,         py_dr: 0,         py_cr: 0 },
    { acct: '6900', unadj_dr: 95000,     unadj_cr: 0,         py_dr: 85000,     py_cr: 0 },
    { acct: '6910', unadj_dr: 45000,     unadj_cr: 0,         py_dr: 35000,     py_cr: 0 },
    { acct: '7000', unadj_dr: 32500,     unadj_cr: 0,         py_dr: 18000,     py_cr: 0 },
    { acct: '7100', unadj_dr: 0,         unadj_cr: 0,         py_dr: 0,         py_cr: 0 },
  ];

  await knex('trial_balance').insert(
    tbRows.filter((r) => r.unadj_dr > 0 || r.unadj_cr > 0 || r.py_dr > 0 || r.py_cr > 0)
      .map((r) => ({
        period_id: period.id,
        account_id: A.get(r.acct),
        unadjusted_debit: r.unadj_dr,
        unadjusted_credit: r.unadj_cr,
        prior_year_debit: r.py_dr,
        prior_year_credit: r.py_cr,
      })),
  );

  // ── Bank Transactions ──────────────────────────────────────────────────────
  // Mix of classified (confirmed), AI-suggested, and unclassified
  const adminUser = await knex('app_users').where({ username: 'admin' }).first('id');
  const adminId = adminUser?.id ?? null;

  const bankTxns = [
    // Confirmed/classified transactions
    { date: '2024-01-05', desc: 'ACH DEPOSIT - ACME CORP',                     amount:  1250000, acct: '4000', status: 'confirmed' },
    { date: '2024-01-15', desc: 'PAYROLL - ADP 01/15',                         amount: -2375000, acct: '6000', status: 'confirmed' },
    { date: '2024-01-15', desc: 'ADP TAX - FICA/FUTA 01/15',                   amount:  -237500, acct: '6010', status: 'confirmed' },
    { date: '2024-02-01', desc: 'SUMMIT OFFICE PARK - RENT FEB',               amount:  -300000, acct: '6100', status: 'confirmed' },
    { date: '2024-02-05', desc: 'ACH DEPOSIT - PINNACLE HEALTH',               amount:  1875000, acct: '4100', status: 'confirmed' },
    { date: '2024-02-12', desc: 'COMCAST BUSINESS 02/24',                       amount:   -18900, acct: '6120', status: 'confirmed' },
    { date: '2024-02-15', desc: 'PAYROLL - ADP 02/15',                         amount: -2375000, acct: '6000', status: 'confirmed' },
    { date: '2024-02-20', desc: 'SHELL OIL 02/18',                             amount:    -6500, acct: '6530', status: 'confirmed' },
    { date: '2024-03-01', desc: 'SUMMIT OFFICE PARK - RENT MAR',               amount:  -300000, acct: '6100', status: 'confirmed' },
    { date: '2024-03-08', desc: 'WIRE - GLOBALTECH SOLUTIONS',                 amount:  3250000, acct: '4000', status: 'confirmed' },
    { date: '2024-03-15', desc: 'PAYROLL - ADP 03/15',                         amount: -2375000, acct: '6000', status: 'confirmed' },
    { date: '2024-03-22', desc: 'DELTA AIR 03/20 ATL-SFO',                     amount:   -48750, acct: '6500', status: 'confirmed' },
    { date: '2024-04-01', desc: 'SUMMIT OFFICE PARK - RENT APR',               amount:  -300000, acct: '6100', status: 'confirmed' },
    { date: '2024-04-10', desc: 'CHECK #1042 - HARRIS & PARTNERS LLP',         amount:  -350000, acct: '6600', status: 'confirmed', check: '1042' },
    // AI-suggested (not yet confirmed)
    { date: '2024-04-15', desc: 'PAYROLL - ADP 04/15',                         amount: -2375000, acct: '6000', status: 'suggested', ai_acct: '6000', ai_conf: 0.95 },
    { date: '2024-04-22', desc: 'AMAZON BUSINESS - OFFICE',                    amount:   -12475, acct: null,   status: 'suggested', ai_acct: '6200', ai_conf: 0.82 },
    { date: '2024-05-01', desc: 'SUMMIT OFFICE PARK - RENT MAY',               amount:  -300000, acct: null,   status: 'suggested', ai_acct: '6100', ai_conf: 0.97 },
    { date: '2024-05-03', desc: 'ACH DEPOSIT - MERIDIAN SYSTEMS',              amount:  2100000, acct: null,   status: 'suggested', ai_acct: '4000', ai_conf: 0.88 },
    { date: '2024-05-10', desc: 'CHASE VISA PAYMENT 05/24',                    amount:  -843672, acct: null,   status: 'suggested', ai_acct: '2100', ai_conf: 0.91 },
    // Unclassified (AI hasn't run or no match)
    { date: '2024-05-15', desc: 'PAYROLL - ADP 05/15',                         amount: -2375000, acct: null,   status: 'unclassified' },
    { date: '2024-05-18', desc: 'UBER TRIP 05/17 AIRPORT',                     amount:    -4825, acct: null,   status: 'unclassified' },
    { date: '2024-05-22', desc: 'DEPOSIT',                                     amount:   875000, acct: null,   status: 'unclassified' },
    { date: '2024-06-01', desc: 'SUMMIT OFFICE PARK - RENT JUN',               amount:  -300000, acct: null,   status: 'unclassified' },
    { date: '2024-06-05', desc: 'STAPLES #1284',                               amount:    -8950, acct: null,   status: 'unclassified' },
    { date: '2024-06-10', desc: 'ACH DEPOSIT - REGIONAL MEDICAL GRP',          amount:  1650000, acct: null,   status: 'unclassified' },
    { date: '2024-06-12', desc: 'XFINITY MOBILE 06/24',                        amount:   -14500, acct: null,   status: 'unclassified' },
    { date: '2024-06-15', desc: 'PAYROLL - ADP 06/15',                         amount: -2375000, acct: null,   status: 'unclassified' },
    { date: '2024-06-18', desc: 'BP #4592 FUEL',                               amount:    -7250, acct: null,   status: 'unclassified' },
    { date: '2024-06-22', desc: 'MARRIOTT DOWNTOWN SFO 06/20',                 amount:   -28900, acct: null,   status: 'unclassified' },
    { date: '2024-06-25', desc: 'GOOGLE WORKSPACE JUNE',                       amount:   -14400, acct: null,   status: 'unclassified' },
    { date: '2024-06-28', desc: 'CHECK #1048 - JENKINS SUBCONTRACTING',        amount:  -425000, acct: null,   status: 'unclassified', check: '1048' },
    { date: '2024-06-30', desc: 'MONTHLY SERVICE CHARGE',                      amount:    -3500, acct: null,   status: 'unclassified' },
  ];

  for (const tx of bankTxns) {
    await knex('bank_transactions').insert({
      client_id: client.id,
      period_id: period.id,
      transaction_date: tx.date,
      description: tx.desc,
      amount: tx.amount,
      check_number: tx.check || null,
      account_id: tx.acct ? A.get(tx.acct) : null,
      ai_suggested_account_id: tx.ai_acct ? A.get(tx.ai_acct) : null,
      ai_confidence: tx.ai_conf || null,
      classification_status: tx.status,
      classified_by: tx.status === 'confirmed' ? adminId : null,
      entry_source: 'import',
    });
  }

  // ── Manual Transaction Entries ─────────────────────────────────────────────
  const manualTxns = [
    { date: '2024-01-10', desc: 'Office Depot - printer paper & toner',        amount:   -15625, acct: '6200' },
    { date: '2024-01-25', desc: 'Client dinner - Acme project kickoff',        amount:   -18500, acct: '6510' },
    { date: '2024-02-08', desc: 'Parking - courthouse for deposition',         amount:    -2500, acct: '6500' },
    { date: '2024-02-14', desc: 'Adobe Creative Cloud annual',                 amount:   -65988, acct: '6210' },
    { date: '2024-03-05', desc: 'USPS Priority Mail - client docs',            amount:    -1285, acct: '6220' },
    { date: '2024-03-18', desc: 'LinkedIn Premium annual',                     amount:   -35988, acct: '6400' },
    { date: '2024-04-02', desc: 'State business license renewal',              amount:    -9500, acct: '6900' },
    { date: '2024-04-25', desc: 'CPA CPE seminar registration',                amount:   -45000, acct: '6910' },
    { date: '2024-05-08', desc: 'Vistaprint - business cards',                 amount:    -4995, acct: '6400' },
    { date: '2024-05-20', desc: 'FedEx overnight - contract to client',        amount:    -3275, acct: '6220' },
  ];

  for (const tx of manualTxns) {
    await knex('bank_transactions').insert({
      client_id: client.id,
      period_id: period.id,
      transaction_date: tx.date,
      description: tx.desc,
      amount: tx.amount,
      account_id: A.get(tx.acct),
      classification_status: 'confirmed',
      classified_by: adminId,
      entry_source: 'manual',
    });
  }

  // ── Book Adjusting Journal Entries ─────────────────────────────────────────
  const ajes = [
    {
      entry_number: 1, type: 'book', date: '2024-12-31',
      description: 'Annual depreciation — F&E $4,500, computers $6,400, vehicles $7,700',
      lines: [
        { acct: '6800', debit: 1860000, credit: 0 },         // Depreciation Expense $18,600
        { acct: '1550', debit: 0,       credit: 450000 },    // Accum Depr F&E $4,500
        { acct: '1560', debit: 0,       credit: 640000 },    // Accum Depr Computers $6,400
        { acct: '1570', debit: 0,       credit: 770000 },    // Accum Depr Vehicles $7,700
      ],
    },
    {
      entry_number: 2, type: 'book', date: '2024-12-31',
      description: 'Accrue 2 weeks wages earned but unpaid at year end',
      lines: [
        { acct: '6000', debit: 1425000, credit: 0 },         // Salaries $14,250
        { acct: '2200', debit: 0,       credit: 1425000 },   // Accrued Wages $14,250
      ],
    },
    {
      entry_number: 3, type: 'book', date: '2024-12-31',
      description: 'Accrue payroll taxes on accrued wages (10%)',
      lines: [
        { acct: '6010', debit: 142500, credit: 0 },          // Payroll Taxes $1,425
        { acct: '2210', debit: 0,      credit: 142500 },     // Accrued Payroll Taxes $1,425
      ],
    },
    {
      entry_number: 4, type: 'book', date: '2024-12-31',
      description: 'Amortize prepaid insurance — 4 months remaining of 12-month policy',
      lines: [
        { acct: '6300', debit: 275000, credit: 0 },          // Insurance GL $2,750
        { acct: '1300', debit: 0,      credit: 275000 },     // Prepaid Insurance $2,750
      ],
    },
    {
      entry_number: 5, type: 'book', date: '2024-12-31',
      description: 'Write off uncollectible invoice — former client Apex Digital',
      lines: [
        { acct: '7100', debit: 325000, credit: 0 },          // Bad Debt $3,250
        { acct: '1100', debit: 0,      credit: 325000 },     // AR $3,250
      ],
    },
  ];

  for (const aje of ajes) {
    const [je] = await knex('journal_entries').insert({
      period_id: period.id,
      entry_number: aje.entry_number,
      entry_type: aje.type,
      entry_date: aje.date,
      description: aje.description,
      created_by: adminId,
    }).returning('*');

    await knex('journal_entry_lines').insert(
      aje.lines.map((line) => ({
        journal_entry_id: je.id,
        account_id: A.get(line.acct),
        debit: line.debit,
        credit: line.credit,
      })),
    );
  }

  console.log(`Comprehensive demo seeded: ${client.name} (${client.entity_type}, FY 2024)`);
  console.log(`  ${accounts.length} accounts, ${tbRows.length} TB rows, ${bankTxns.length + manualTxns.length} bank txns, ${ajes.length} AJEs`);
};
