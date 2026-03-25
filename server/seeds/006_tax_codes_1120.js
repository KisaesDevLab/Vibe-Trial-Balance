/**
 * Seed: Tax codes for Form 1120 (C-Corporation) — all activity types
 * 1120S and 1040 are in seed 005. Common codes are in seed 005.
 */

const SW = {
  C_GROSS_RECEIPTS:         ['1120-1a',  '1120_GR',  '100', 'P1-GR'],
  C_RETURNS_ALLOWANCES:     ['1120-1b',  '1120_RA',  '101', 'P1-RA'],
  C_COST_OF_GOODS_SOLD:     ['1120-2',   '1120_CGS', '102', 'P1-CGS'],
  C_DIVIDENDS_RECEIVED:     ['1120-4',   '1120_DIV', '104', 'P1-DIV'],
  C_INTEREST_INCOME:        ['1120-5',   '1120_INT', '105', 'P1-INT'],
  C_GROSS_RENTS:            ['1120-6',   '1120_GRN', '106', 'P1-GRN'],
  C_GROSS_ROYALTIES:        ['1120-7',   '1120_ROY', '107', 'P1-ROY'],
  C_CAPITAL_GAIN_NET:       ['1120-8',   '1120_CG',  '108', 'P1-CG'],
  C_NET_GAIN_4797:          ['1120-9',   '1120_4797','109', 'P1-4797'],
  C_OTHER_INCOME:           ['1120-10',  '1120_OI',  '110', 'P1-OI'],
  C_COMPENSATION_OFFICERS:  ['1120-12',  '1120_CO',  '112', 'P1-CO'],
  C_SALARIES_WAGES:         ['1120-13',  '1120_SW',  '113', 'P1-SW'],
  C_REPAIRS_MAINTENANCE:    ['1120-14',  '1120_RM',  '114', 'P1-RM'],
  C_BAD_DEBTS:              ['1120-15',  '1120_BD',  '115', 'P1-BD'],
  C_RENTS:                  ['1120-16',  '1120_RNT', '116', 'P1-RNT'],
  C_TAXES_LICENSES:         ['1120-17',  '1120_TL',  '117', 'P1-TL'],
  C_INTEREST_EXP:           ['1120-18',  '1120_IE',  '118', 'P1-IE'],
  C_CHARITABLE_CONTRIB:     ['1120-19',  '1120_CC',  '119', 'P1-CC'],
  C_DEPRECIATION:           ['1120-20',  '1120_DEP', '120', 'P1-DEP'],
  C_DEPLETION:              ['1120-21',  '1120_DPL', '121', 'P1-DPL'],
  C_ADVERTISING:            ['1120-22',  '1120_ADV', '122', 'P1-ADV'],
  C_PENSION_PROFIT_SHARING: ['1120-23',  '1120_PEN', '123', 'P1-PEN'],
  C_EMPLOYEE_BENEFITS:      ['1120-24',  '1120_EB',  '124', 'P1-EB'],
  C_OTHER_DEDUCTIONS:       ['1120-26',  '1120_OD',  '126', 'P1-OD'],
  // Balance Sheet
  C_BS_CASH:                ['1120-L1',  '1120_L1',  '200', 'SL-1'],
  C_BS_TRADE_NOTES_AR:      ['1120-L2a', '1120_L2a', '201', 'SL-2A'],
  C_BS_INVENTORIES:         ['1120-L3',  '1120_L3',  '203', 'SL-3'],
  C_BS_US_GOVT_OBLIGATIONS: ['1120-L4',  '1120_L4',  '204', 'SL-4'],
  C_BS_TAX_EXEMPT_SEC:      ['1120-L5',  '1120_L5',  '205', 'SL-5'],
  C_BS_OTHER_CURRENT_ASSETS:['1120-L6',  '1120_L6',  '206', 'SL-6'],
  C_BS_LOANS_TO_SH:         ['1120-L7',  '1120_L7',  '207', 'SL-7'],
  C_BS_MORTGAGE_RE:         ['1120-L8',  '1120_L8',  '208', 'SL-8'],
  C_BS_OTHER_INVESTMENTS:   ['1120-L9',  '1120_L9',  '209', 'SL-9'],
  C_BS_BUILDINGS_LAND:      ['1120-L10a','1120_L10a','210', 'SL-10A'],
  C_BS_ACCUM_DEPRECIATION:  ['1120-L10b','1120_L10b','211', 'SL-10B'],
  C_BS_LAND:                ['1120-L12', '1120_L12', '214', 'SL-12'],
  C_BS_INTANGIBLE_ASSETS:   ['1120-L13a','1120_L13a','215', 'SL-13A'],
  C_BS_ACCUM_AMORTIZATION:  ['1120-L13b','1120_L13b','216', 'SL-13B'],
  C_BS_OTHER_ASSETS:        ['1120-L14', '1120_L14', '217', 'SL-14'],
  C_BS_ACCOUNTS_PAYABLE:    ['1120-L15', '1120_L15', '220', 'SL-15'],
  C_BS_NOTES_PAYABLE_LT1YR: ['1120-L16', '1120_L16', '221', 'SL-16'],
  C_BS_OTHER_CURRENT_LIAB:  ['1120-L17', '1120_L17', '222', 'SL-17'],
  C_BS_LOANS_FROM_SH:       ['1120-L18', '1120_L18', '223', 'SL-18'],
  C_BS_MORTGAGES_GT1YR:     ['1120-L19', '1120_L19', '224', 'SL-19'],
  C_BS_OTHER_LIABILITIES:   ['1120-L20', '1120_L20', '225', 'SL-20'],
  C_BS_CAPITAL_STOCK:       ['1120-L22', '1120_L22', '230', 'SL-22'],
  C_BS_APIC:                ['1120-L23', '1120_L23', '231', 'SL-23'],
  C_BS_RETAINED_EARNINGS:   ['1120-L24', '1120_L24', '232', 'SL-24'],
  C_BS_LESS_TREASURY_STOCK: ['1120-L26', '1120_L26', '234', 'SL-26'],
  // M-1
  C_M1_NET_INCOME_BOOKS:    ['1120-M1-1','1120_M1_1','250', 'M1-1'],
  C_M1_FEDERAL_INCOME_TAX:  ['1120-M1-2','1120_M1_2','251', 'M1-2'],
  C_M1_EXCESS_CAP_LOSS:     ['1120-M1-3','1120_M1_3','252', 'M1-3'],
  C_M1_INC_RTN_NOT_BOOKS:   ['1120-M1-4','1120_M1_4','253', 'M1-4'],
  C_M1_EXP_BOOKS_NOT_RTN:   ['1120-M1-5','1120_M1_5','254', 'M1-5'],
  C_M1_INC_BOOKS_NOT_RTN:   ['1120-M1-7','1120_M1_7','255', 'M1-7'],
  C_M1_DED_RTN_NOT_BOOKS:   ['1120-M1-8','1120_M1_8','256', 'M1-8'],
  // M-2
  C_M2_BEGINNING_RE:        ['1120-M2-1','1120_M2_1','260', 'M2-1'],
  C_M2_NET_INCOME_M2:       ['1120-M2-2','1120_M2_2','261', 'M2-2'],
  C_M2_OTHER_INCREASES_M2:  ['1120-M2-3','1120_M2_3','262', 'M2-3'],
  C_M2_DISTRIBUTIONS_CASH:  ['1120-M2-5','1120_M2_5','263', 'M2-5'],
  C_M2_DISTRIBUTIONS_PROP:  ['1120-M2-6','1120_M2_6','264', 'M2-6'],
  C_M2_OTHER_DECREASES_M2:  ['1120-M2-7','1120_M2_7','265', 'M2-7'],
};

function getMaps(taxCode) {
  const sw = SW[taxCode];
  if (!sw) return [{ tax_software: 'generic', software_code: taxCode, software_description: null }];
  const [ut, cch, lac, gos] = sw;
  return [
    { tax_software: 'ultratax', software_code: ut,      software_description: null },
    { tax_software: 'cch',      software_code: cch,     software_description: null },
    { tax_software: 'lacerte',  software_code: lac,     software_description: null },
    { tax_software: 'gosystem', software_code: gos,     software_description: null },
    { tax_software: 'generic',  software_code: taxCode, software_description: null },
  ];
}

exports.seed = async function(knex) {
  // Helper to build rental/farm/farm_rental for 1120 reusing RENTAL_/FARM_/FR_ codes
  const rentalCodes = [
    'RENTAL_GROSS_RENTS','RENTAL_OTHER_INCOME','RENTAL_ADVERTISING','RENTAL_AUTO_TRAVEL',
    'RENTAL_CLEANING_MAINT','RENTAL_COMMISSIONS','RENTAL_INSURANCE','RENTAL_LEGAL_PROF',
    'RENTAL_MGMT_FEES','RENTAL_MORTGAGE_INT','RENTAL_OTHER_INT','RENTAL_REPAIRS',
    'RENTAL_SUPPLIES','RENTAL_TAXES','RENTAL_UTILITIES','RENTAL_DEPRECIATION','RENTAL_OTHER_EXPENSES',
  ];
  const farmCodes = [
    'FARM_SALES_LIVESTOCK','FARM_COST_LIVESTOCK','FARM_SALES_PRODUCTS','FARM_OTHER_INCOME',
    'FARM_AG_PROGRAM_PMTS','FARM_CCC_LOANS','FARM_CROP_INSURANCE','FARM_CUSTOM_HIRE_INC',
    'FARM_CAR_TRUCK','FARM_CHEMICALS','FARM_CONSERVATION','FARM_CUSTOM_HIRE_EXP',
    'FARM_DEPRECIATION','FARM_EMPLOYEE_BENEFITS','FARM_FEED','FARM_FERTILIZER',
    'FARM_FREIGHT_TRUCKING','FARM_GASOLINE_FUEL','FARM_INSURANCE','FARM_MORTGAGE_INT',
    'FARM_OTHER_INT','FARM_LABOR_HIRED','FARM_PENSION','FARM_RENT_MACHINERY',
    'FARM_RENT_LAND','FARM_REPAIRS','FARM_SEEDS_PLANTS','FARM_STORAGE',
    'FARM_SUPPLIES','FARM_TAXES','FARM_UTILITIES','FARM_VETERINARY','FARM_OTHER_EXPENSES',
  ];
  const farmRentalCodes = [
    'FR_GROSS_FARM_RENTAL','FR_OTHER_INCOME','FR_CAR_TRUCK','FR_CHEMICALS','FR_CONSERVATION',
    'FR_CUSTOM_HIRE','FR_DEPRECIATION','FR_EMPLOYEE_BENEFITS','FR_FEED','FR_FERTILIZER',
    'FR_FREIGHT','FR_GASOLINE','FR_INSURANCE','FR_MORTGAGE_INT','FR_OTHER_INT',
    'FR_LABOR','FR_PENSION','FR_RENT_MACHINERY','FR_REPAIRS','FR_SEEDS',
    'FR_STORAGE','FR_SUPPLIES','FR_TAXES','FR_UTILITIES','FR_VETERINARY','FR_OTHER_EXPENSES',
  ];

  // Look up descriptions from seed 004 for reused codes
  async function getDesc(knex, taxCode) {
    const row = await knex('tax_codes').where({ tax_code: taxCode }).first('description');
    return row ? row.description : taxCode;
  }

  const businessCodes = [
    // Page 1 Income
    { return_form:'1120', activity_type:'business', tax_code:'C_GROSS_RECEIPTS',         description:'Gross Receipts or Sales',                           sort_order:2000, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_RETURNS_ALLOWANCES',      description:'Returns and Allowances',                            sort_order:2001, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_COST_OF_GOODS_SOLD',      description:'Cost of Goods Sold',                                sort_order:2002, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_DIVIDENDS_RECEIVED',      description:'Dividends (Schedule C)',                            sort_order:2004, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_INTEREST_INCOME',         description:'Interest Income',                                   sort_order:2005, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_GROSS_RENTS',             description:'Gross Rents',                                       sort_order:2006, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_GROSS_ROYALTIES',         description:'Gross Royalties',                                   sort_order:2007, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_CAPITAL_GAIN_NET',        description:'Capital Gain Net Income',                           sort_order:2008, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_NET_GAIN_4797',           description:'Net Gain (Loss) from Form 4797',                    sort_order:2009, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_OTHER_INCOME',            description:'Other Income',                                      sort_order:2010, is_system:true },
    // Page 1 Deductions
    { return_form:'1120', activity_type:'business', tax_code:'C_COMPENSATION_OFFICERS',   description:'Compensation of Officers',                          sort_order:2012, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_SALARIES_WAGES',          description:'Salaries and Wages',                                sort_order:2013, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_REPAIRS_MAINTENANCE',     description:'Repairs and Maintenance',                           sort_order:2014, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BAD_DEBTS',               description:'Bad Debts',                                         sort_order:2015, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_RENTS',                   description:'Rents',                                             sort_order:2016, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_TAXES_LICENSES',          description:'Taxes and Licenses',                                sort_order:2017, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_INTEREST_EXP',            description:'Interest Expense',                                  sort_order:2018, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_CHARITABLE_CONTRIB',      description:'Charitable Contributions',                          sort_order:2019, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_DEPRECIATION',            description:'Depreciation',                                      sort_order:2020, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_DEPLETION',               description:'Depletion',                                         sort_order:2021, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_ADVERTISING',             description:'Advertising',                                       sort_order:2022, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_PENSION_PROFIT_SHARING',  description:'Pension, Profit-Sharing Plans',                     sort_order:2023, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_EMPLOYEE_BENEFITS',       description:'Employee Benefit Programs',                         sort_order:2024, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_OTHER_DEDUCTIONS',        description:'Other Deductions',                                  sort_order:2026, is_system:true },
    // Balance Sheet
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_CASH',                 description:'Schedule L — Cash',                                 sort_order:2200, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_TRADE_NOTES_AR',       description:'Schedule L — Trade Notes and Accounts Receivable',  sort_order:2201, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_INVENTORIES',          description:'Schedule L — Inventories',                          sort_order:2203, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_US_GOVT_OBLIGATIONS',  description:'Schedule L — U.S. Government Obligations',           sort_order:2204, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_TAX_EXEMPT_SEC',       description:'Schedule L — Tax-Exempt Securities',                sort_order:2205, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_OTHER_CURRENT_ASSETS', description:'Schedule L — Other Current Assets',                 sort_order:2206, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_LOANS_TO_SH',          description:'Schedule L — Loans to Shareholders',                sort_order:2207, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_MORTGAGE_RE',          description:'Schedule L — Mortgage and Real Estate Loans',        sort_order:2208, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_OTHER_INVESTMENTS',    description:'Schedule L — Other Investments',                    sort_order:2209, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_BUILDINGS_LAND',       description:'Schedule L — Buildings and Other Depreciable Assets',sort_order:2210, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_ACCUM_DEPRECIATION',   description:'Schedule L — Less Accumulated Depreciation',         sort_order:2211, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_LAND',                 description:'Schedule L — Land',                                 sort_order:2214, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_INTANGIBLE_ASSETS',    description:'Schedule L — Intangible Assets',                    sort_order:2215, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_ACCUM_AMORTIZATION',   description:'Schedule L — Less Accumulated Amortization',         sort_order:2216, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_OTHER_ASSETS',         description:'Schedule L — Other Assets',                         sort_order:2217, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_ACCOUNTS_PAYABLE',     description:'Schedule L — Accounts Payable',                     sort_order:2220, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_NOTES_PAYABLE_LT1YR',  description:'Schedule L — Mortgages/Notes Payable < 1 Year',     sort_order:2221, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_OTHER_CURRENT_LIAB',   description:'Schedule L — Other Current Liabilities',             sort_order:2222, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_LOANS_FROM_SH',        description:'Schedule L — Loans from Shareholders',              sort_order:2223, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_MORTGAGES_GT1YR',      description:'Schedule L — Mortgages/Notes Payable ≥ 1 Year',     sort_order:2224, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_OTHER_LIABILITIES',    description:'Schedule L — Other Liabilities',                    sort_order:2225, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_CAPITAL_STOCK',        description:'Schedule L — Capital Stock',                        sort_order:2230, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_APIC',                 description:'Schedule L — Additional Paid-In Capital',           sort_order:2231, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_RETAINED_EARNINGS',    description:'Schedule L — Retained Earnings — Unappropriated',   sort_order:2232, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_BS_LESS_TREASURY_STOCK',  description:'Schedule L — Less Cost of Treasury Stock',           sort_order:2234, is_system:true },
    // M-1
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_NET_INCOME_BOOKS',     description:'Schedule M-1 — Net Income (Loss) per Books',         sort_order:2500, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_FEDERAL_INCOME_TAX',   description:'Schedule M-1 — Federal Income Tax per Books',        sort_order:2501, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_EXCESS_CAP_LOSS',      description:'Schedule M-1 — Excess of Capital Losses over Gains', sort_order:2502, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_INC_RTN_NOT_BOOKS',    description:'Schedule M-1 — Income on Return Not on Books',        sort_order:2503, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_EXP_BOOKS_NOT_RTN',    description:'Schedule M-1 — Expenses on Books Not on Return',      sort_order:2504, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_INC_BOOKS_NOT_RTN',    description:'Schedule M-1 — Income on Books Not on Return',        sort_order:2505, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M1_DED_RTN_NOT_BOOKS',    description:'Schedule M-1 — Deductions on Return Not on Books',    sort_order:2506, is_system:true },
    // M-2
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_BEGINNING_RE',         description:'Schedule M-2 — Balance at Beginning of Year',         sort_order:2550, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_NET_INCOME_M2',        description:'Schedule M-2 — Net Income (Loss) per Books',          sort_order:2551, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_OTHER_INCREASES_M2',   description:'Schedule M-2 — Other Increases',                      sort_order:2552, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_DISTRIBUTIONS_CASH',   description:'Schedule M-2 — Distributions: Cash',                  sort_order:2553, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_DISTRIBUTIONS_PROP',   description:'Schedule M-2 — Distributions: Property',              sort_order:2554, is_system:true },
    { return_form:'1120', activity_type:'business', tax_code:'C_M2_OTHER_DECREASES_M2',   description:'Schedule M-2 — Other Decreases',                      sort_order:2555, is_system:true },
  ];

  for (const code of businessCodes) {
    const [row] = await knex('tax_codes')
      .insert({ ...code, created_at: knex.fn.now(), updated_at: knex.fn.now() })
      .onConflict(['return_form', 'activity_type', 'tax_code'])
      .merge(['description', 'sort_order', 'is_system', 'updated_at'])
      .returning('id');
    const maps = getMaps(code.tax_code);
    for (const map of maps) {
      await knex('tax_code_software_maps')
        .insert({ tax_code_id: row.id, ...map, created_at: knex.fn.now() })
        .onConflict(['tax_code_id', 'tax_software'])
        .merge(['software_code', 'software_description']);
    }
  }

  // 1120 rental / farm / farm_rental — reuse same tax_codes as 1065 equivalents
  const reuseSets = [
    { activity_type: 'rental',       codes: rentalCodes,      startSort: 2600 },
    { activity_type: 'farm',         codes: farmCodes,        startSort: 2700 },
    { activity_type: 'farm_rental',  codes: farmRentalCodes,  startSort: 2800 },
  ];

  for (const { activity_type, codes, startSort } of reuseSets) {
    for (let i = 0; i < codes.length; i++) {
      const taxCode = codes[i];
      const desc = await getDesc(knex, taxCode);
      const [row] = await knex('tax_codes')
        .insert({ return_form:'1120', activity_type, tax_code: taxCode, description: desc,
                  sort_order: startSort + i, is_system: true,
                  created_at: knex.fn.now(), updated_at: knex.fn.now() })
        .onConflict(['return_form', 'activity_type', 'tax_code'])
        .merge(['description', 'sort_order', 'is_system', 'updated_at'])
        .returning('id');
      const maps = getMaps(taxCode);
      for (const map of maps) {
        await knex('tax_code_software_maps')
          .insert({ tax_code_id: row.id, ...map, created_at: knex.fn.now() })
          .onConflict(['tax_code_id', 'tax_software'])
          .merge(['software_code', 'software_description']);
      }
    }
  }
};

const rentalCodes = [
  'RENTAL_GROSS_RENTS','RENTAL_OTHER_INCOME','RENTAL_ADVERTISING','RENTAL_AUTO_TRAVEL',
  'RENTAL_CLEANING_MAINT','RENTAL_COMMISSIONS','RENTAL_INSURANCE','RENTAL_LEGAL_PROF',
  'RENTAL_MGMT_FEES','RENTAL_MORTGAGE_INT','RENTAL_OTHER_INT','RENTAL_REPAIRS',
  'RENTAL_SUPPLIES','RENTAL_TAXES','RENTAL_UTILITIES','RENTAL_DEPRECIATION','RENTAL_OTHER_EXPENSES',
];
const farmCodes = [
  'FARM_SALES_LIVESTOCK','FARM_COST_LIVESTOCK','FARM_SALES_PRODUCTS','FARM_OTHER_INCOME',
  'FARM_AG_PROGRAM_PMTS','FARM_CCC_LOANS','FARM_CROP_INSURANCE','FARM_CUSTOM_HIRE_INC',
  'FARM_CAR_TRUCK','FARM_CHEMICALS','FARM_CONSERVATION','FARM_CUSTOM_HIRE_EXP',
  'FARM_DEPRECIATION','FARM_EMPLOYEE_BENEFITS','FARM_FEED','FARM_FERTILIZER',
  'FARM_FREIGHT_TRUCKING','FARM_GASOLINE_FUEL','FARM_INSURANCE','FARM_MORTGAGE_INT',
  'FARM_OTHER_INT','FARM_LABOR_HIRED','FARM_PENSION','FARM_RENT_MACHINERY',
  'FARM_RENT_LAND','FARM_REPAIRS','FARM_SEEDS_PLANTS','FARM_STORAGE',
  'FARM_SUPPLIES','FARM_TAXES','FARM_UTILITIES','FARM_VETERINARY','FARM_OTHER_EXPENSES',
];
const farmRentalCodes = [
  'FR_GROSS_FARM_RENTAL','FR_OTHER_INCOME','FR_CAR_TRUCK','FR_CHEMICALS','FR_CONSERVATION',
  'FR_CUSTOM_HIRE','FR_DEPRECIATION','FR_EMPLOYEE_BENEFITS','FR_FEED','FR_FERTILIZER',
  'FR_FREIGHT','FR_GASOLINE','FR_INSURANCE','FR_MORTGAGE_INT','FR_OTHER_INT',
  'FR_LABOR','FR_PENSION','FR_RENT_MACHINERY','FR_REPAIRS','FR_SEEDS',
  'FR_STORAGE','FR_SUPPLIES','FR_TAXES','FR_UTILITIES','FR_VETERINARY','FR_OTHER_EXPENSES',
];
