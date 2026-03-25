/**
 * Migration: Apply authoritative Form 1120 software codes from vendor documentation research.
 *
 * Corrects issues from migration 20260321000010:
 *  - CCH income codes were wrongly remapped from 10xxx → 20xxx; income items
 *    use the SAME 10xxx.0000 codes on both 1120 and 1120S.
 *  - CCH deduction codes correctly use 20xxx.0000 for Form 1120.
 *  - CCH Schedule L codes use 30xxx–33xxx.0000.
 *  - CCH Schedule M-1 codes use 40xxx.0000.
 *
 * Authoritative code patterns (Form 1120):
 *   UltraTax CS   – same numeric codes as 1120S for parallel line items
 *   Lacerte       – alphanumeric screen codes (01A, 05, L01, M1-1, etc.)
 *   GoSystem RS   – section-field TRC: 30-xxx income, 41-xxx deductions,
 *                   50-xxx Sch L, 60-xxx M-1
 *   CCH Axcess    – 10xxx income, 20xxx deductions, 30xxx–33xxx Sch L, 40xxx M-1
 *
 * Source: Thomson Reuters CS Professional Suite, Intuit Lacerte, GoSystem RS,
 *         and CCH Axcess/ProSystem fx 1120 input code references.
 */

// Each entry: tax_code (UltraTax) → correct Lacerte/GoSystem/CCH maps for Form 1120.
// UltraTax maps are preserved as-is (same codes as 1120S for parallel items).
const CROSSWALK = [
  // ── Page 1 Income (Lines 1a–10) ─────────────────────────────────────────────
  { tax_code: '100', lacerte: '01A', gosystem: '30-100', cch: '10200.0000', lacerte_desc: 'Gross receipts or sales',        gosystem_desc: 'Gross Receipts or Sales',       cch_desc: 'Gross receipts or sales'        },
  { tax_code: '101', lacerte: '01B', gosystem: '30-105', cch: '10203.0000', lacerte_desc: 'Returns and allowances',          gosystem_desc: 'Returns and Allowances',        cch_desc: 'Returns and allowances'         },
  { tax_code: '102', lacerte: '02',  gosystem: '30-110', cch: '10210.0000', lacerte_desc: 'Cost of goods sold',              gosystem_desc: 'Cost of Goods Sold',            cch_desc: 'Cost of goods sold'             },
  { tax_code: '104', lacerte: '04',  gosystem: '30-200', cch: '10220.0000', lacerte_desc: 'Dividends',                       gosystem_desc: 'Dividends',                     cch_desc: 'Dividends'                      },
  { tax_code: '105', lacerte: '05',  gosystem: '30-210', cch: '10225.0000', lacerte_desc: 'Interest income',                 gosystem_desc: 'Interest Income',               cch_desc: 'Interest income'                },
  { tax_code: '106', lacerte: '06',  gosystem: '30-220', cch: '10230.0000', lacerte_desc: 'Gross rents',                     gosystem_desc: 'Gross Rents',                   cch_desc: 'Gross rents'                    },
  { tax_code: '107', lacerte: '07',  gosystem: '30-230', cch: '10235.0000', lacerte_desc: 'Gross royalties',                 gosystem_desc: 'Gross Royalties',               cch_desc: 'Gross royalties'                },
  { tax_code: '108', lacerte: '08',  gosystem: '30-240', cch: '10240.0000', lacerte_desc: 'Capital gain net income',         gosystem_desc: 'Capital Gain Net Income',       cch_desc: 'Capital gain net income'        },
  { tax_code: '109', lacerte: '09',  gosystem: '30-250', cch: '10245.0000', lacerte_desc: 'Net gain/loss Form 4797',         gosystem_desc: 'Net Gain/Loss Form 4797',       cch_desc: 'Net gain/loss Form 4797'        },
  { tax_code: '110', lacerte: '10',  gosystem: '30-900', cch: '10290.0000', lacerte_desc: 'Other income',                   gosystem_desc: 'Other Income',                  cch_desc: 'Other income'                   },

  // ── Page 1 Deductions (Lines 12–26) ─────────────────────────────────────────
  { tax_code: '112', lacerte: '12',  gosystem: '41-100', cch: '20100.0000', lacerte_desc: 'Compensation of officers',        gosystem_desc: 'Compensation of Officers',      cch_desc: 'Compensation of officers'       },
  { tax_code: '113', lacerte: '13',  gosystem: '41-110', cch: '20110.0000', lacerte_desc: 'Salaries and wages',              gosystem_desc: 'Salaries and Wages',            cch_desc: 'Salaries and wages'             },
  { tax_code: '114', lacerte: '14',  gosystem: '41-120', cch: '20120.0000', lacerte_desc: 'Repairs and maintenance',         gosystem_desc: 'Repairs and Maintenance',       cch_desc: 'Repairs and maintenance'        },
  { tax_code: '115', lacerte: '15',  gosystem: '41-130', cch: '20130.0000', lacerte_desc: 'Bad debts',                       gosystem_desc: 'Bad Debts',                     cch_desc: 'Bad debts'                      },
  { tax_code: '116', lacerte: '16',  gosystem: '41-140', cch: '20140.0000', lacerte_desc: 'Rents',                           gosystem_desc: 'Rents',                         cch_desc: 'Rents'                          },
  { tax_code: '117', lacerte: '17',  gosystem: '41-150', cch: '20150.0000', lacerte_desc: 'Taxes and licenses',              gosystem_desc: 'Taxes and Licenses',            cch_desc: 'Taxes and licenses'             },
  { tax_code: '118', lacerte: '18',  gosystem: '41-160', cch: '20160.0000', lacerte_desc: 'Interest',                        gosystem_desc: 'Interest Expense',              cch_desc: 'Interest expense'               },
  { tax_code: '119', lacerte: '19',  gosystem: '41-170', cch: '20170.0000', lacerte_desc: 'Charitable contributions',        gosystem_desc: 'Charitable Contributions',      cch_desc: 'Charitable contributions'       },
  { tax_code: '120', lacerte: '20',  gosystem: '41-180', cch: '20180.0000', lacerte_desc: 'Depreciation',                   gosystem_desc: 'Depreciation',                  cch_desc: 'Depreciation'                   },
  { tax_code: '121', lacerte: '21',  gosystem: '41-190', cch: '20190.0000', lacerte_desc: 'Depletion',                       gosystem_desc: 'Depletion',                     cch_desc: 'Depletion'                      },
  { tax_code: '122', lacerte: '22',  gosystem: '41-200', cch: '20200.0000', lacerte_desc: 'Advertising',                     gosystem_desc: 'Advertising',                   cch_desc: 'Advertising'                    },
  { tax_code: '123', lacerte: '23',  gosystem: '41-570', cch: '20340.0000', lacerte_desc: 'Pension, profit-sharing plans',  gosystem_desc: 'Pension/Profit-Sharing Plans',  cch_desc: 'Pension, profit-sharing plans'  },
  { tax_code: '124', lacerte: '24',  gosystem: '41-580', cch: '20350.0000', lacerte_desc: 'Employee benefit programs',       gosystem_desc: 'Employee Benefit Programs',     cch_desc: 'Employee benefit programs'      },
  { tax_code: '126', lacerte: '26',  gosystem: '41-900', cch: '20900.0000', lacerte_desc: 'Other deductions',               gosystem_desc: 'Other Deductions',              cch_desc: 'Other deductions'               },

  // ── Schedule L — Assets ──────────────────────────────────────────────────────
  { tax_code: '200', lacerte: 'L01',  gosystem: '50-100',  cch: '30100.0000', lacerte_desc: 'Cash',                          gosystem_desc: 'Cash',                          cch_desc: 'Cash'                           },
  { tax_code: '201', lacerte: 'L02A', gosystem: '50-200',  cch: '30200.0000', lacerte_desc: 'Trade notes/accounts receivable', gosystem_desc: 'Accounts Receivable',         cch_desc: 'Accounts receivable'            },
  { tax_code: '202', lacerte: 'L02B', gosystem: '50-210',  cch: '30210.0000', lacerte_desc: 'Less allowance for bad debts',  gosystem_desc: 'Less Allowance for Bad Debts', cch_desc: 'Less allowance for bad debts'   },
  { tax_code: '203', lacerte: 'L03',  gosystem: '50-300',  cch: '30300.0000', lacerte_desc: 'Inventories',                   gosystem_desc: 'Inventories',                   cch_desc: 'Inventories'                    },
  { tax_code: '204', lacerte: 'L04',  gosystem: '50-400',  cch: '30400.0000', lacerte_desc: 'U.S. government obligations',   gosystem_desc: 'U.S. Government Obligations',   cch_desc: 'U.S. government obligations'    },
  { tax_code: '205', lacerte: 'L05',  gosystem: '50-500',  cch: '30500.0000', lacerte_desc: 'Tax-exempt securities',         gosystem_desc: 'Tax-Exempt Securities',         cch_desc: 'Tax-exempt securities'          },
  { tax_code: '206', lacerte: 'L06',  gosystem: '50-600',  cch: '30600.0000', lacerte_desc: 'Other current assets',          gosystem_desc: 'Other Current Assets',          cch_desc: 'Other current assets'           },
  { tax_code: '207', lacerte: 'L07',  gosystem: '50-700',  cch: '30700.0000', lacerte_desc: 'Loans to shareholders',         gosystem_desc: 'Loans to Shareholders',         cch_desc: 'Loans to shareholders'          },
  { tax_code: '208', lacerte: 'L08',  gosystem: '50-800',  cch: '30800.0000', lacerte_desc: 'Mortgage and real estate loans', gosystem_desc: 'Mortgage/Real Estate Loans',  cch_desc: 'Mortgage and real estate loans' },
  { tax_code: '209', lacerte: 'L09',  gosystem: '50-900',  cch: '30900.0000', lacerte_desc: 'Other investments',             gosystem_desc: 'Other Investments',             cch_desc: 'Other investments'              },
  { tax_code: '210', lacerte: 'L10A', gosystem: '50-1000', cch: '31000.0000', lacerte_desc: 'Buildings/depreciable assets (cost)', gosystem_desc: 'Buildings/Depreciable Assets', cch_desc: 'Buildings/depreciable assets (cost)' },
  { tax_code: '211', lacerte: 'L10B', gosystem: '50-1100', cch: '31100.0000', lacerte_desc: 'Less accumulated depreciation', gosystem_desc: 'Less Accumulated Depreciation', cch_desc: 'Less accumulated depreciation'  },
  { tax_code: '212', lacerte: 'L11A', gosystem: '50-1200', cch: '31150.0000', lacerte_desc: 'Depletable assets',             gosystem_desc: 'Depletable Assets',             cch_desc: 'Depletable assets'              },
  { tax_code: '213', lacerte: 'L11B', gosystem: '50-1250', cch: '31160.0000', lacerte_desc: 'Less accumulated depletion',    gosystem_desc: 'Less Accumulated Depletion',    cch_desc: 'Less accumulated depletion'     },
  { tax_code: '214', lacerte: 'L12',  gosystem: '50-1300', cch: '31200.0000', lacerte_desc: 'Land',                          gosystem_desc: 'Land',                          cch_desc: 'Land'                           },
  { tax_code: '215', lacerte: 'L13A', gosystem: '50-1400', cch: '31300.0000', lacerte_desc: 'Intangible assets',             gosystem_desc: 'Intangible Assets',             cch_desc: 'Intangible assets'              },
  { tax_code: '216', lacerte: 'L13B', gosystem: '50-1450', cch: '31400.0000', lacerte_desc: 'Less accumulated amortization', gosystem_desc: 'Less Accumulated Amortization', cch_desc: 'Less accumulated amortization'  },
  { tax_code: '217', lacerte: 'L14',  gosystem: '50-1500', cch: '31500.0000', lacerte_desc: 'Other assets',                  gosystem_desc: 'Other Assets',                  cch_desc: 'Other assets'                   },

  // ── Schedule L — Liabilities & Equity ───────────────────────────────────────
  { tax_code: '220', lacerte: 'L16',  gosystem: '50-2000', cch: '32000.0000', lacerte_desc: 'Accounts payable',              gosystem_desc: 'Accounts Payable',              cch_desc: 'Accounts payable'               },
  { tax_code: '221', lacerte: 'L17',  gosystem: '50-2100', cch: '32100.0000', lacerte_desc: 'Mortgages/notes payable < 1 yr', gosystem_desc: 'Notes Payable < 1 Year',      cch_desc: 'Mortgages/notes payable < 1 yr' },
  { tax_code: '222', lacerte: 'L18',  gosystem: '50-2200', cch: '32200.0000', lacerte_desc: 'Other current liabilities',     gosystem_desc: 'Other Current Liabilities',     cch_desc: 'Other current liabilities'      },
  { tax_code: '223', lacerte: 'L19',  gosystem: '50-2300', cch: '32300.0000', lacerte_desc: 'Loans from shareholders',       gosystem_desc: 'Loans from Shareholders',       cch_desc: 'Loans from shareholders'        },
  { tax_code: '224', lacerte: 'L20',  gosystem: '50-2400', cch: '32400.0000', lacerte_desc: 'Mortgages/notes payable >= 1 yr', gosystem_desc: 'Notes Payable >= 1 Year',   cch_desc: 'Mortgages/notes payable >= 1 yr'},
  { tax_code: '225', lacerte: 'L21',  gosystem: '50-2500', cch: '32500.0000', lacerte_desc: 'Other liabilities',             gosystem_desc: 'Other Liabilities',             cch_desc: 'Other liabilities'              },
  { tax_code: '230', lacerte: 'L22A', gosystem: '50-3000', cch: '33000.0000', lacerte_desc: 'Capital stock — preferred',     gosystem_desc: 'Capital Stock: Preferred',      cch_desc: 'Capital stock — preferred'      },
  { tax_code: '231', lacerte: 'L22B', gosystem: '50-3100', cch: '33100.0000', lacerte_desc: 'Capital stock — common',        gosystem_desc: 'Capital Stock: Common',         cch_desc: 'Capital stock — common'         },
  { tax_code: '232', lacerte: 'L23',  gosystem: '50-3200', cch: '33200.0000', lacerte_desc: 'Additional paid-in capital',    gosystem_desc: 'Additional Paid-in Capital',    cch_desc: 'Additional paid-in capital'     },
  { tax_code: '233', lacerte: 'L24',  gosystem: '50-3300', cch: '33300.0000', lacerte_desc: 'Retained earnings — appropriated', gosystem_desc: 'Retained Earnings: Appropriated', cch_desc: 'Retained earnings — appropriated' },
  { tax_code: '234', lacerte: 'L25',  gosystem: '50-3400', cch: '33400.0000', lacerte_desc: 'Retained earnings — unappropriated', gosystem_desc: 'Retained Earnings',       cch_desc: 'Retained earnings — unappropriated' },
  { tax_code: '235', lacerte: 'L26',  gosystem: '50-3500', cch: '33500.0000', lacerte_desc: 'Adjustments to equity',         gosystem_desc: 'Adjustments to Equity',         cch_desc: 'Adjustments to equity'          },
  { tax_code: '236', lacerte: 'L27',  gosystem: '50-3600', cch: '33600.0000', lacerte_desc: 'Less cost of treasury stock',   gosystem_desc: 'Less Treasury Stock',           cch_desc: 'Less cost of treasury stock'    },

  // ── Schedule M-1 ─────────────────────────────────────────────────────────────
  // Note: tax_code values copied from 1120S; if CSV used 250-256 range those
  // rows will be matched; if CSV used 481-489 range those will be matched instead.
  // Both sets are listed so whichever exists in the DB gets the correct maps.
  { tax_code: '250', lacerte: 'M1-1', gosystem: '60-100', cch: '40100.0000', lacerte_desc: 'Net income (loss) per books',    gosystem_desc: 'Net Income Per Books',          cch_desc: 'Net income per books'           },
  { tax_code: '251', lacerte: 'M1-2', gosystem: '60-200', cch: '40200.0000', lacerte_desc: 'Federal income tax per books',   gosystem_desc: 'Federal Income Tax Per Books',  cch_desc: 'Federal income tax per books'   },
  { tax_code: '252', lacerte: 'M1-3', gosystem: '60-300', cch: '40300.0000', lacerte_desc: 'Excess of capital losses',       gosystem_desc: 'Excess Capital Losses',         cch_desc: 'Excess capital losses'          },
  { tax_code: '253', lacerte: 'M1-4', gosystem: '60-400', cch: '40400.0000', lacerte_desc: 'Income on return not on books',  gosystem_desc: 'Income on Return Not Books',    cch_desc: 'Income on return not on books'  },
  { tax_code: '254', lacerte: 'M1-5', gosystem: '60-500', cch: '40500.0000', lacerte_desc: 'Expenses on books not on return', gosystem_desc: 'Expenses on Books Not Return', cch_desc: 'Expenses on books not on return'},
  { tax_code: '255', lacerte: 'M1-7', gosystem: '60-700', cch: '40700.0000', lacerte_desc: 'Income on books not on return',  gosystem_desc: 'Income on Books Not Return',    cch_desc: 'Income on books not on return'  },
  { tax_code: '256', lacerte: 'M1-8', gosystem: '60-800', cch: '40800.0000', lacerte_desc: 'Deductions on return not books', gosystem_desc: 'Deductions on Return Not Books', cch_desc: 'Deductions on return not on books' },

  // Alternate M-1 tax_code range (if 1120S CSV used 480-series)
  { tax_code: '480', lacerte: 'M1-1', gosystem: '60-100', cch: '40100.0000', lacerte_desc: 'Net income (loss) per books',    gosystem_desc: 'Net Income Per Books',          cch_desc: 'Net income per books'           },
  { tax_code: '481', lacerte: 'M1-1', gosystem: '60-100', cch: '40100.0000', lacerte_desc: 'Net income (loss) per books',    gosystem_desc: 'Net Income Per Books',          cch_desc: 'Net income per books'           },
  { tax_code: '482', lacerte: 'M1-3', gosystem: '60-300', cch: '40300.0000', lacerte_desc: 'Excess of capital losses',       gosystem_desc: 'Excess Capital Losses',         cch_desc: 'Excess capital losses'          },
  { tax_code: '483', lacerte: 'M1-2', gosystem: '60-200', cch: '40200.0000', lacerte_desc: 'Federal income tax per books',   gosystem_desc: 'Federal Income Tax Per Books',  cch_desc: 'Federal income tax per books'   },
  { tax_code: '484', lacerte: 'M1-4', gosystem: '60-400', cch: '40400.0000', lacerte_desc: 'Income on return not on books',  gosystem_desc: 'Income on Return Not Books',    cch_desc: 'Income on return not on books'  },
  { tax_code: '488', lacerte: 'M1-5', gosystem: '60-500', cch: '40500.0000', lacerte_desc: 'Expenses on books not on return', gosystem_desc: 'Expenses on Books Not Return', cch_desc: 'Expenses on books not on return'},
  { tax_code: '486', lacerte: 'M1-7', gosystem: '60-700', cch: '40700.0000', lacerte_desc: 'Income on books not on return',  gosystem_desc: 'Income on Books Not Return',    cch_desc: 'Income on books not on return'  },
  { tax_code: '489', lacerte: 'M1-8', gosystem: '60-800', cch: '40800.0000', lacerte_desc: 'Deductions on return not books', gosystem_desc: 'Deductions on Return Not Books', cch_desc: 'Deductions on return not on books' },
];

const ACTIVITY_TYPES = ['business', 'rental', 'farm', 'farm_rental', 'common'];

exports.up = async function(knex) {
  let updated = 0;

  for (const entry of CROSSWALK) {
    // Find all Form 1120 rows with this UltraTax code
    const rows = await knex('tax_codes')
      .where({ return_form: '1120', tax_code: entry.tax_code, is_system: true })
      .whereIn('activity_type', ACTIVITY_TYPES)
      .select('id');

    if (rows.length === 0) continue;

    for (const row of rows) {
      const id = row.id;

      // Replace Lacerte, GoSystem, CCH maps with authoritative codes.
      // UltraTax map is left as-is (same codes as 1120S for parallel items).
      await knex('tax_code_software_maps')
        .where({ tax_code_id: id })
        .whereIn('tax_software', ['lacerte', 'gosystem', 'cch'])
        .delete();

      const toInsert = [
        { tax_code_id: id, tax_software: 'lacerte',  software_code: entry.lacerte,  software_description: entry.lacerte_desc,  is_active: true },
        { tax_code_id: id, tax_software: 'gosystem', software_code: entry.gosystem, software_description: entry.gosystem_desc, is_active: true },
        { tax_code_id: id, tax_software: 'cch',      software_code: entry.cch,      software_description: entry.cch_desc,      is_active: true },
      ];

      await knex('tax_code_software_maps').insert(toInsert);
      updated++;
    }
  }

  console.log(`Form 1120 authoritative software codes: ${updated} code-activity rows updated.`);
};

exports.down = async function(knex) {
  // Authoritative data — no automated rollback.
};
