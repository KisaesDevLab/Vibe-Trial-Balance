/**
 * Seed 32 system COA templates from BusinessCategoryList.xlsx
 * Run with: npx knex seed:run --specific=007_coa_templates.js
 */
exports.seed = async function(knex) {
  const existing = await knex('coa_templates').where({ is_system: true }).first();
  if (existing) return; // migration 20260321000005 already loaded these

  const templates = [
  {
    "name": "Accommodation and Food Services",
    "slug": "accommodation_and_food_services",
    "description": "Hotels, motels, restaurants, bars, and catering businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 0
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 3
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 4
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 5
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 6
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 7
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 8
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 9
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 10
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 11
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 12
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 13
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 14
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 15
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 16
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 17
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 18
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 19
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 20
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 21
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 22
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 23
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 24
      },
      {
        "account_number": "50100",
        "account_name": "Materials & Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 25
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 26
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 27
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 28
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 29
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 30
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 31
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 32
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 33
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 34
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 35
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 36
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 37
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 38
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 39
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 40
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 41
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 42
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 43
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 44
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 45
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 46
      },
      {
        "account_number": "61630",
        "account_name": "Packaging",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 47
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 48
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 49
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 50
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 51
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 52
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 53
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 54
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 55
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 56
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 57
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 58
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 59
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 60
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 61
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 62
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 63
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 64
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 65
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 66
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 67
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 68
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 69
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 70
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 71
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 72
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 73
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 74
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 75
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 76
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 77
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 78
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 79
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 80
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 81
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 82
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 83
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 84
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 85
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 86
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 87
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 88
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 89
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 90
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 91
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 92
      }
    ]
  },
  {
    "name": "Administrative and Management Services",
    "slug": "administrative_and_management_services",
    "description": "Office administration, business support, and management consulting services.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 93
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 94
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 95
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 96
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 97
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 98
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 99
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 100
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 101
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 102
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 103
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 104
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 105
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 106
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 107
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 108
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 109
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 110
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 111
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 112
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 113
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 114
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 115
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 116
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 117
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 118
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 119
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 120
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 121
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 122
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 123
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 124
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 125
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 126
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 127
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 128
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 129
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 130
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 131
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 132
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 133
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 134
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 135
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 136
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 137
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 138
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 139
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 140
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 141
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 142
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 143
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 144
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 145
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 146
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 147
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 148
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 149
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 150
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 151
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 152
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 153
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 154
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 155
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 156
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 157
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 158
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 159
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 160
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 161
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 162
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 163
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 164
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 165
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 166
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 167
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 168
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 169
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 170
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 171
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 172
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 173
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 174
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 175
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 176
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 177
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 178
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 179
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 180
      }
    ]
  },
  {
    "name": "Appliance Repairs",
    "slug": "appliance_repairs",
    "description": "Household and commercial appliance repair and service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 181
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 182
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 183
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 184
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 185
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 186
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 187
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 188
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 189
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 190
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 191
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 192
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 193
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 194
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 195
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 196
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 197
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 198
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 199
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 200
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 201
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 202
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 203
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 204
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 205
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 206
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 207
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 208
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 209
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 210
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 211
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 212
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 213
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 214
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 215
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 216
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 217
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 218
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 219
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 220
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 221
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 222
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 223
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 224
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 225
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 226
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 227
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 228
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 229
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 230
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 231
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 232
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 233
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 234
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 235
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 236
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 237
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 238
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 239
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 240
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 241
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 242
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 243
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 244
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 245
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 246
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 247
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 248
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 249
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 250
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 251
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 252
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 253
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 254
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 255
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 256
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 257
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 258
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 259
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 260
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 261
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 262
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 263
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 264
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 265
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 266
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 267
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 268
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 269
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 270
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 271
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 272
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 273
      }
    ]
  },
  {
    "name": "Arts, Entertainment, and Recreation",
    "slug": "arts_entertainment_and_recreation",
    "description": "Performing arts, sports, amusement, and recreation businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 274
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 275
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 276
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 277
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 278
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 279
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 280
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 281
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 282
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 283
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 284
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 285
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 286
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 287
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 288
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 289
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 290
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 291
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 292
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 293
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 294
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 295
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 296
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 297
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 298
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 299
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 300
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 301
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 302
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 303
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 304
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 305
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 306
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 307
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 308
      }
    ]
  },
  {
    "name": "Automotive and Small Engine Repairs",
    "slug": "automotive_and_small_engine_repairs",
    "description": "Auto repair shops, body shops, and small engine service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 309
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 310
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 311
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 312
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 313
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 314
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 315
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 316
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 317
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 318
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 319
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 320
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 321
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 322
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 323
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 324
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 325
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 326
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 327
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 328
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 329
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 330
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 331
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 332
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 333
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 334
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 335
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 336
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 337
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 338
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 339
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 340
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 341
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 342
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 343
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 344
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 345
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 346
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 347
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 348
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 349
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 350
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 351
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 352
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 353
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 354
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 355
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 356
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 357
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 358
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 359
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 360
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 361
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 362
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 363
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 364
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 365
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 366
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 367
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 368
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 369
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 370
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 371
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 372
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 373
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 374
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 375
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 376
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 377
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 378
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 379
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 380
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 381
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 382
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 383
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 384
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 385
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 386
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 387
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 388
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 389
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 390
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 391
      }
    ]
  },
  {
    "name": "Automotive, Equipment Rental and Leasing",
    "slug": "automotive_equipment_rental_and_leasing",
    "description": "Vehicle and equipment rental and leasing businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 392
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 393
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 394
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 395
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 396
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 397
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 398
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 399
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 400
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 401
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 402
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 403
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 404
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 405
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 406
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 407
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 408
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 409
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 410
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 411
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 412
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 413
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 414
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 415
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 416
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 417
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 418
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 419
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 420
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 421
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 422
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 423
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 424
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 425
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 426
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 427
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 428
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 429
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 430
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 431
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 432
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 433
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 434
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 435
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 436
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 437
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 438
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 439
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 440
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 441
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 442
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 443
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 444
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 445
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 446
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 447
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 448
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 449
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 450
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 451
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 452
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 453
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 454
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 455
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 456
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 457
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 458
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 459
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 460
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 461
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 462
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 463
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 464
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 465
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 466
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 467
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 468
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 469
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 470
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 471
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 472
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 473
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 474
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 475
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 476
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 477
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 478
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 479
      }
    ]
  },
  {
    "name": "Bookkeeping and Tax Services",
    "slug": "bookkeeping_and_tax_services",
    "description": "Bookkeeping, payroll, and tax preparation service providers.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 480
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 481
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 482
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 483
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 484
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 485
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 486
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 487
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 488
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 489
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 490
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 491
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 492
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 493
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 494
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 495
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 496
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 497
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 498
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 499
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 500
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 501
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 502
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 503
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 504
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 505
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 506
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 507
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 508
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 509
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 510
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 511
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 512
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 513
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 514
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 515
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 516
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 517
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 518
      },
      {
        "account_number": "61440",
        "account_name": "Malpractice Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 519
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 520
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 521
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 522
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 523
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 524
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 525
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 526
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 527
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 528
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 529
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 530
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 531
      },
      {
        "account_number": "61650",
        "account_name": "Printing",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 532
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 533
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 534
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 535
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 536
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 537
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 538
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 539
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 540
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 541
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 542
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 543
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 544
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 545
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 546
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 547
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 548
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 549
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 550
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 551
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 552
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 553
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 554
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 555
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 556
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 557
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 558
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 559
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 560
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 561
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 562
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 563
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 564
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 565
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 566
      }
    ]
  },
  {
    "name": "Cleaning Service",
    "slug": "cleaning_service",
    "description": "Residential and commercial cleaning and janitorial service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 567
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 568
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 569
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 570
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 571
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 572
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 573
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 574
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 575
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 576
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 577
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 578
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 579
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 580
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 581
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 582
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 583
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 584
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 585
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 586
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 587
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 588
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 589
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 590
      },
      {
        "account_number": "50100",
        "account_name": "Materials & Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 591
      },
      {
        "account_number": "50400",
        "account_name": "Labor",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 592
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 593
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 594
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 595
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 596
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 597
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 598
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 599
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 600
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 601
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 602
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 603
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 604
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 605
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 606
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 607
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 608
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 609
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 610
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 611
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 612
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 613
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 614
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 615
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 616
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 617
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 618
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 619
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 620
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 621
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 622
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 623
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 624
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 625
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 626
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 627
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 628
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 629
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 630
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 631
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 632
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 633
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 634
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 635
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 636
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 637
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 638
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 639
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 640
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 641
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 642
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 643
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 644
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 645
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 646
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 647
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 648
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 649
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 650
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 651
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 652
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 653
      }
    ]
  },
  {
    "name": "Computer and Electronics Repair",
    "slug": "computer_and_electronics_repair",
    "description": "Computer, phone, and electronics repair service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 654
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 655
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 656
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 657
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 658
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 659
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 660
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 661
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 662
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 663
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 664
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 665
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 666
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 667
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 668
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 669
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 670
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 671
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 672
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 673
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 674
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 675
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 676
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 677
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 678
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 679
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 680
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 681
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 682
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 683
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 684
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 685
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 686
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 687
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 688
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 689
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 690
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 691
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 692
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 693
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 694
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 695
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 696
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 697
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 698
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 699
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 700
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 701
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 702
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 703
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 704
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 705
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 706
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 707
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 708
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 709
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 710
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 711
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 712
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 713
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 714
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 715
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 716
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 717
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 718
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 719
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 720
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 721
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 722
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 723
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 724
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 725
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 726
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 727
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 728
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 729
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 730
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 731
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 732
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 733
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 734
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 735
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 736
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 737
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 738
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 739
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 740
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 741
      }
    ]
  },
  {
    "name": "Construction",
    "slug": "construction",
    "description": "General contractors, specialty trade contractors, and construction businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 742
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 743
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 744
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 745
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 746
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 747
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 748
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 749
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 750
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 751
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 752
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 753
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 754
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 755
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 756
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 757
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 758
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 759
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 760
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 761
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 762
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 763
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 764
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 765
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 766
      },
      {
        "account_number": "50100",
        "account_name": "Materials & Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 767
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 768
      },
      {
        "account_number": "50210",
        "account_name": "Franchise Fees",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 769
      },
      {
        "account_number": "50400",
        "account_name": "Labor",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 770
      },
      {
        "account_number": "50500",
        "account_name": "Returns",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 771
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 772
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 773
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 774
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 775
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 776
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 777
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 778
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 779
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 780
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 781
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 782
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 783
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 784
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 785
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 786
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 787
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 788
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 789
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 790
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 791
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 792
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 793
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 794
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 795
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 796
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 797
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 798
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 799
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 800
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 801
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 802
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 803
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 804
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 805
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 806
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 807
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 808
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 809
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 810
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 811
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 812
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 813
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 814
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 815
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 816
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 817
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 818
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 819
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 820
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 821
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 822
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 823
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 824
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 825
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 826
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 827
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 828
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 829
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 830
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 831
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 832
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 833
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 834
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 835
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 836
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 837
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 838
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 839
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 840
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 841
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 842
      }
    ]
  },
  {
    "name": "Consulting  and Design Services",
    "slug": "consulting_and_design_services",
    "description": "Business consulting, design, and professional advisory service firms.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 843
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 844
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 845
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 846
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 847
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 848
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 849
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 850
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 851
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 852
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 853
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 854
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 855
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 856
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 857
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 858
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 859
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 860
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 861
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 862
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 863
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 864
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 865
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 866
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 867
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 868
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 869
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 870
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 871
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 872
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 873
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 874
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 875
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 876
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 877
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 878
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 879
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 880
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 881
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 882
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 883
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 884
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 885
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 886
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 887
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 888
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 889
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 890
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 891
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 892
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 893
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 894
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 895
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 896
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 897
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 898
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 899
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 900
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 901
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 902
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 903
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 904
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 905
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 906
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 907
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 908
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 909
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 910
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 911
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 912
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 913
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 914
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 915
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 916
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 917
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 918
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 919
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 920
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 921
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 922
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 923
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 924
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 925
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 926
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 927
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 928
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 929
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 930
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 931
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 932
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 933
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 934
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 935
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 936
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 937
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 938
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 939
      }
    ]
  },
  {
    "name": "Day Care",
    "slug": "day_care",
    "description": "Child care centers, family day care, and after-school programs.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 940
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 941
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 942
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 943
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 944
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 945
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 946
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 947
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 948
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 949
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 950
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 951
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 952
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 953
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 954
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 955
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 956
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 957
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 958
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 959
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 960
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 961
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 962
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 963
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 964
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 965
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 966
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 967
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 968
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 969
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 970
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 971
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 972
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 973
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 974
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 975
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 976
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 977
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 978
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 979
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 980
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 981
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 982
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 983
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 984
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 985
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 986
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 987
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 988
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 989
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 990
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 991
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 992
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 993
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 994
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 995
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 996
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 997
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 998
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 999
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1000
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1001
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1002
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1003
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1004
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1005
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1006
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1007
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1008
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1009
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1010
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1011
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1012
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1013
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1014
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1015
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1016
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1017
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1018
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1019
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1020
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1021
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1022
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1023
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1024
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1025
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1026
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1027
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1028
      }
    ]
  },
  {
    "name": "Equipment Rental and Leasing",
    "slug": "equipment_rental_and_leasing",
    "description": "Heavy equipment, tool, and machinery rental and leasing businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1029
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1030
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1031
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1032
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1033
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1034
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1035
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1036
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1037
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1038
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1039
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1040
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1041
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1042
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1043
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1044
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1045
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1046
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1047
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1048
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1049
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1050
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1051
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1052
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1053
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1054
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1055
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1056
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1057
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1058
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1059
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1060
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1061
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1062
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1063
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1064
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1065
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1066
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1067
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1068
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1069
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1070
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1071
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1072
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1073
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1074
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1075
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1076
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1077
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1078
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1079
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1080
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1081
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1082
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1083
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1084
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1085
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1086
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1087
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1088
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1089
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1090
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1091
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1092
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1093
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1094
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1095
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1096
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1097
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1098
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1099
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1100
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1101
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1102
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1103
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1104
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1105
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1106
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1107
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1108
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1109
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1110
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1111
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1112
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1113
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1114
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1115
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1116
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1117
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1118
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1119
      }
    ]
  },
  {
    "name": "Event, Wedding and Party Planning",
    "slug": "event_wedding_and_party_planning",
    "description": "Event coordination, wedding planning, and party organizing businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1120
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1121
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1122
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1123
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1124
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1125
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1126
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1127
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1128
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1129
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1130
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1131
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1132
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1133
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1134
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1135
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1136
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1137
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1138
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1139
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1140
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1141
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1142
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1143
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1144
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1145
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1146
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1147
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1148
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1149
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1150
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1151
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1152
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1153
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1154
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1155
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1156
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1157
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1158
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1159
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1160
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1161
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1162
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1163
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1164
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1165
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1166
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1167
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1168
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1169
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1170
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1171
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1172
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1173
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1174
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1175
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1176
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1177
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1178
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1179
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1180
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1181
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1182
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1183
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1184
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1185
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1186
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1187
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1188
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1189
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1190
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1191
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1192
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1193
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1194
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1195
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1196
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1197
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1198
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1199
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1200
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1201
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1202
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1203
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1204
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1205
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1206
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1207
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1208
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1209
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1210
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1211
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1212
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1213
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1214
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1215
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1216
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1217
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1218
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1219
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1220
      }
    ]
  },
  {
    "name": "Farm, Crops and Animals",
    "slug": "farm_crops_and_animals",
    "description": "Crop production, livestock, poultry, and mixed farming operations.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1221
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1222
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1223
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1224
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1225
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1226
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1227
      },
      {
        "account_number": "10800",
        "account_name": "Livestock Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1228
      },
      {
        "account_number": "10900",
        "account_name": "Land & Buildings",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1229
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1230
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1231
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1232
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1233
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1234
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1235
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1236
      },
      {
        "account_number": "20800",
        "account_name": "Mortgage Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1237
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1238
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1239
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1240
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1241
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1242
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1243
      },
      {
        "account_number": "40300",
        "account_name": "Rental Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1244
      },
      {
        "account_number": "42100",
        "account_name": "Livestock, Raised Non Breeding",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1245
      },
      {
        "account_number": "42110",
        "account_name": "Cattle & Horses, Raised Held < 24 months",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1246
      },
      {
        "account_number": "42120",
        "account_name": "Cattle & Horses, Raised Held > 24 months",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1247
      },
      {
        "account_number": "42130",
        "account_name": "Other Livestock, Raised Held < 12 months",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1248
      },
      {
        "account_number": "42140",
        "account_name": "Other Livestock, Raised Held > 12 months",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1249
      },
      {
        "account_number": "42150",
        "account_name": "Livestock, Resale",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1250
      },
      {
        "account_number": "42160",
        "account_name": "Livestock, Sale of Depreciable",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1251
      },
      {
        "account_number": "42200",
        "account_name": "Produce/Grain, Raised",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1252
      },
      {
        "account_number": "42210",
        "account_name": "Produce/Grain, Resale",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1253
      },
      {
        "account_number": "42300",
        "account_name": "Ag Program Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1254
      },
      {
        "account_number": "42400",
        "account_name": "Coop Patronage Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1255
      },
      {
        "account_number": "42500",
        "account_name": "Crop Insurance Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1256
      },
      {
        "account_number": "47000",
        "account_name": "Custom Hire",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1257
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1258
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1259
      },
      {
        "account_number": "52000",
        "account_name": "Livestock/Produce/Grain, Resale",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1260
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1261
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1262
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1263
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1264
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1265
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1266
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1267
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1268
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1269
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1270
      },
      {
        "account_number": "60400",
        "account_name": "Chemicals",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1271
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1272
      },
      {
        "account_number": "60600",
        "account_name": "Custom Hire",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1273
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1274
      },
      {
        "account_number": "61000",
        "account_name": "Feed",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1275
      },
      {
        "account_number": "61100",
        "account_name": "Fertilizer & Lime",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1276
      },
      {
        "account_number": "61200",
        "account_name": "Freight & Trucking",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1277
      },
      {
        "account_number": "61300",
        "account_name": "Gas/Fuel/Oil",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1278
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1279
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1280
      },
      {
        "account_number": "61420",
        "account_name": "Crop Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1281
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1282
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1283
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1284
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1285
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1286
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1287
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1288
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1289
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1290
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1291
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1292
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1293
      },
      {
        "account_number": "61700",
        "account_name": "Other Expenses",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1294
      },
      {
        "account_number": "61702",
        "account_name": "Bank Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1295
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1296
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1297
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1298
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1299
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1300
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1301
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1302
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1303
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1304
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1305
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1306
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1307
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1308
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1309
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1310
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1311
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1312
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1313
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1314
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1315
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1316
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1317
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1318
      },
      {
        "account_number": "61910",
        "account_name": "Animals",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1319
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1320
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1321
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1322
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1323
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1324
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1325
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1326
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1327
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1328
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1329
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1330
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1331
      }
    ]
  },
  {
    "name": "Financial Planning, Agents and Brokers",
    "slug": "financial_planning_agents_and_brokers",
    "description": "Financial advisors, investment planners, and insurance/securities agents.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1332
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1333
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1334
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1335
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1336
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1337
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1338
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1339
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1340
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1341
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1342
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1343
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1344
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1345
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1346
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1347
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1348
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1349
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1350
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1351
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1352
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1353
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1354
      },
      {
        "account_number": "48200",
        "account_name": "Investment Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1355
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1356
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1357
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1358
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1359
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1360
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1361
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1362
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1363
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1364
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1365
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1366
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1367
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1368
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1369
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1370
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1371
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1372
      },
      {
        "account_number": "61430",
        "account_name": "E&O Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1373
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1374
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1375
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1376
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1377
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1378
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1379
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1380
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1381
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1382
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1383
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1384
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1385
      },
      {
        "account_number": "61650",
        "account_name": "Printing",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1386
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1387
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1388
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1389
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1390
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1391
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1392
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1393
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1394
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1395
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1396
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1397
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1398
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1399
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1400
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1401
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1402
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1403
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1404
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1405
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1406
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1407
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1408
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1409
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1410
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1411
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1412
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1413
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1414
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1415
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1416
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1417
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1418
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1419
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1420
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1421
      }
    ]
  },
  {
    "name": "Graphic Design and Desktop Publishing",
    "slug": "graphic_design_and_desktop_publishing",
    "description": "Graphic design studios and desktop publishing service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1422
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1423
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1424
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1425
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1426
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1427
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1428
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1429
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1430
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1431
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1432
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1433
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1434
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1435
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1436
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1437
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1438
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1439
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1440
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1441
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1442
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1443
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1444
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1445
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1446
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1447
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1448
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1449
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1450
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1451
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1452
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1453
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1454
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1455
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1456
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1457
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1458
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1459
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1460
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1461
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1462
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1463
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1464
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1465
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1466
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1467
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1468
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1469
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1470
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1471
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1472
      },
      {
        "account_number": "61650",
        "account_name": "Printing",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1473
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1474
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1475
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1476
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1477
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1478
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1479
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1480
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1481
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1482
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1483
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1484
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1485
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1486
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1487
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1488
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1489
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1490
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1491
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1492
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1493
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1494
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1495
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1496
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1497
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1498
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1499
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1500
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1501
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1502
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1503
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1504
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1505
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1506
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1507
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1508
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1509
      }
    ]
  },
  {
    "name": "Hairstylist and Barbers",
    "slug": "hairstylist_and_barbers",
    "description": "Hair salons, barbershops, and personal hair care service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1510
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1511
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1512
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1513
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1514
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1515
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1516
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1517
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1518
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1519
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1520
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1521
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1522
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1523
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1524
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1525
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1526
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1527
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1528
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1529
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1530
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1531
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1532
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1533
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1534
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1535
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1536
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1537
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1538
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1539
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1540
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1541
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1542
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1543
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1544
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1545
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1546
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1547
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1548
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1549
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1550
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1551
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1552
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1553
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1554
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1555
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1556
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1557
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1558
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1559
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1560
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1561
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1562
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1563
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1564
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1565
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1566
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1567
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1568
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1569
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1570
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1571
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1572
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1573
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1574
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1575
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1576
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1577
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1578
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1579
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1580
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1581
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1582
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1583
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1584
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1585
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1586
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1587
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1588
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1589
      }
    ]
  },
  {
    "name": "Health Care and Social Assistance",
    "slug": "health_care_and_social_assistance",
    "description": "Medical practices, therapy, counseling, and social assistance organizations.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1590
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1591
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1592
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1593
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1594
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1595
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1596
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1597
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1598
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1599
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1600
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1601
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1602
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1603
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1604
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1605
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1606
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1607
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1608
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1609
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1610
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1611
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1612
      },
      {
        "account_number": "48200",
        "account_name": "Investment Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1613
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1614
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1615
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1616
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1617
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1618
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1619
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1620
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1621
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1622
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1623
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1624
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1625
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1626
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1627
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1628
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1629
      },
      {
        "account_number": "61430",
        "account_name": "E&O Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1630
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1631
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1632
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1633
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1634
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1635
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1636
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1637
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1638
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1639
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1640
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1641
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1642
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1643
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1644
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1645
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1646
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1647
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1648
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1649
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1650
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1651
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1652
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1653
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1654
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1655
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1656
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1657
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1658
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1659
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1660
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1661
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1662
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1663
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1664
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1665
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1666
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1667
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1668
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1669
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1670
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1671
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1672
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1673
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1674
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1675
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1676
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1677
      }
    ]
  },
  {
    "name": "Insurance Agents and Brokers",
    "slug": "insurance_agents_and_brokers",
    "description": "Independent insurance agents, brokers, and related service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1678
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1679
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1680
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1681
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1682
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1683
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1684
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1685
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1686
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1687
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1688
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1689
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1690
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1691
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1692
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1693
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1694
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1695
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1696
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1697
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1698
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1699
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1700
      },
      {
        "account_number": "48200",
        "account_name": "Investment Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1701
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1702
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1703
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1704
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1705
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1706
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1707
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1708
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1709
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1710
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1711
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1712
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1713
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1714
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1715
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1716
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1717
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1718
      },
      {
        "account_number": "61430",
        "account_name": "E&O Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1719
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1720
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1721
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1722
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1723
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1724
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1725
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1726
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1727
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1728
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1729
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1730
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1731
      },
      {
        "account_number": "61650",
        "account_name": "Printing",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1732
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1733
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1734
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1735
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1736
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1737
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1738
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1739
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1740
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1741
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1742
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1743
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1744
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1745
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1746
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1747
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1748
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1749
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1750
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1751
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1752
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1753
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1754
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1755
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1756
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1757
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1758
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1759
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1760
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1761
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1762
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1763
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1764
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1765
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1766
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1767
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1768
      }
    ]
  },
  {
    "name": "Landscaping",
    "slug": "landscaping",
    "description": "Lawn care, landscaping, tree service, and grounds maintenance businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1769
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1770
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1771
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1772
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1773
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1774
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1775
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1776
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1777
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1778
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1779
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1780
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1781
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1782
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1783
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1784
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1785
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1786
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1787
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1788
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1789
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1790
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1791
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1792
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1793
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1794
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1795
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1796
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1797
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1798
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1799
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1800
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1801
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1802
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1803
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1804
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1805
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1806
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1807
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1808
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1809
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1810
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1811
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1812
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1813
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1814
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1815
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1816
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1817
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1818
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1819
      },
      {
        "account_number": "61660",
        "account_name": "Shipping & Couriers",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1820
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1821
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1822
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1823
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1824
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1825
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1826
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1827
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1828
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1829
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1830
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1831
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1832
      },
      {
        "account_number": "61760",
        "account_name": "Small Tools",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1833
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1834
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1835
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1836
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1837
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1838
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1839
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1840
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1841
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1842
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1843
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1844
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1845
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1846
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1847
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1848
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1849
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1850
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1851
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1852
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1853
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1854
      }
    ]
  },
  {
    "name": "Personal Activities",
    "slug": "personal_activities",
    "description": "Non-business personal financial activity and miscellaneous personal items.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1855
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1856
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1857
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1858
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1859
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1860
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1861
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1862
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1863
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1864
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1865
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1866
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1867
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1868
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1869
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1870
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1871
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1872
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1873
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1874
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1875
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1876
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1877
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1878
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1879
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1880
      }
    ]
  },
  {
    "name": "Personal Services",
    "slug": "personal_services",
    "description": "Dry cleaning, laundry, alterations, and other personal care service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1881
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1882
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1883
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1884
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1885
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1886
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1887
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1888
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1889
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1890
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1891
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1892
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1893
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1894
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1895
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1896
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1897
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1898
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1899
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1900
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1901
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1902
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1903
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1904
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1905
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1906
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1907
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1908
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1909
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1910
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1911
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1912
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1913
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1914
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1915
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1916
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1917
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1918
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1919
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1920
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1921
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1922
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1923
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1924
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1925
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1926
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1927
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1928
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1929
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1930
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1931
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1932
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1933
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1934
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1935
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1936
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1937
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1938
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1939
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1940
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1941
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1942
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1943
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1944
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1945
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1946
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1947
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1948
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1949
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1950
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1951
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1952
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1953
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1954
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1955
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1956
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1957
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1958
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1959
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1960
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1961
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1962
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1963
      }
    ]
  },
  {
    "name": "Personal Trainers",
    "slug": "personal_trainers",
    "description": "Fitness training, coaching, and personal wellness service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1964
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1965
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1966
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1967
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1968
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 1969
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 1970
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1971
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1972
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1973
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1974
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1975
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1976
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 1977
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1978
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1979
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1980
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1981
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 1982
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 1983
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1984
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1985
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1986
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 1987
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1988
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1989
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1990
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1991
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1992
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1993
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1994
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1995
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1996
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1997
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1998
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 1999
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2000
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2001
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2002
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2003
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2004
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2005
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2006
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2007
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2008
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2009
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2010
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2011
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2012
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2013
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2014
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2015
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2016
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2017
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2018
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2019
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2020
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2021
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2022
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2023
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2024
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2025
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2026
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2027
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2028
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2029
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2030
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2031
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2032
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2033
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2034
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2035
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2036
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2037
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2038
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2039
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2040
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2041
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2042
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2043
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2044
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2045
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2046
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2047
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2048
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2049
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2050
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2051
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2052
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2053
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2054
      }
    ]
  },
  {
    "name": "Pet Sitting",
    "slug": "pet_sitting",
    "description": "Pet sitting, dog walking, boarding, and animal care service businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2055
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2056
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2057
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2058
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2059
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2060
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2061
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2062
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2063
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2064
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2065
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2066
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2067
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2068
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2069
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2070
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2071
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2072
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2073
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2074
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2075
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2076
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2077
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2078
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2079
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2080
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2081
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2082
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2083
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2084
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2085
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2086
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2087
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2088
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2089
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2090
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2091
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2092
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2093
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2094
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2095
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2096
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2097
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2098
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2099
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2100
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2101
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2102
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2103
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2104
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2105
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2106
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2107
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2108
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2109
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2110
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2111
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2112
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2113
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2114
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2115
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2116
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2117
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2118
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2119
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2120
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2121
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2122
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2123
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2124
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2125
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2126
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2127
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2128
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2129
      }
    ]
  },
  {
    "name": "Photographer",
    "slug": "photographer",
    "description": "Photography studios, freelance photographers, and video production businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2130
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2131
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2132
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2133
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2134
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2135
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2136
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2137
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2138
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2139
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2140
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2141
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2142
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2143
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2144
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2145
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2146
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2147
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2148
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2149
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2150
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2151
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2152
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2153
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2154
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2155
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2156
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2157
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2158
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2159
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2160
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2161
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2162
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2163
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2164
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2165
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2166
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2167
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2168
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2169
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2170
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2171
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2172
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2173
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2174
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2175
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2176
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2177
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2178
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2179
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2180
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2181
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2182
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2183
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2184
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2185
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2186
      },
      {
        "account_number": "61660",
        "account_name": "Shipping & Couriers",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2187
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2188
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2189
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2190
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2191
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2192
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2193
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2194
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2195
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2196
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2197
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2198
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2199
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2200
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2201
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2202
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2203
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2204
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2205
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2206
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2207
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2208
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2209
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2210
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2211
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2212
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2213
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2214
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2215
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2216
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2217
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2218
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2219
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2220
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2221
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2222
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2223
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2224
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2225
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2226
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2227
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2228
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2229
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2230
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2231
      }
    ]
  },
  {
    "name": "Real Estate Agents and Brokers",
    "slug": "real_estate_agents_and_brokers",
    "description": "Real estate sales agents, buyer agents, and real estate brokerage firms.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2232
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2233
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2234
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2235
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2236
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2237
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2238
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2239
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2240
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2241
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2242
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2243
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2244
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2245
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2246
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2247
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2248
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2249
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2250
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2251
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2252
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2253
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2254
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2255
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2256
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2257
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2258
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2259
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2260
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2261
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2262
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2263
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2264
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2265
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2266
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2267
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2268
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2269
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2270
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2271
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2272
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2273
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2274
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2275
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2276
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2277
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2278
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2279
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2280
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2281
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2282
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2283
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2284
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2285
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2286
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2287
      },
      {
        "account_number": "61650",
        "account_name": "Printing",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2288
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2289
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2290
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2291
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2292
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2293
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2294
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2295
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2296
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2297
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2298
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2299
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2300
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2301
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2302
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2303
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2304
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2305
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2306
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2307
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2308
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2309
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2310
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2311
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2312
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2313
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2314
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2315
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2316
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2317
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2318
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2319
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2320
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2321
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2322
      }
    ]
  },
  {
    "name": "Real Estate Rental",
    "slug": "real_estate_rental",
    "description": "Residential and commercial rental property management and ownership.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2323
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2324
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2325
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2326
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2327
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2328
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2329
      },
      {
        "account_number": "10900",
        "account_name": "Land & Buildings",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2330
      },
      {
        "account_number": "10950",
        "account_name": "Security Deposits Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2331
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2332
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2333
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2334
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2335
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2336
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2337
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2338
      },
      {
        "account_number": "20800",
        "account_name": "Mortgage Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2339
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2340
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2341
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2342
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2343
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2344
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2345
      },
      {
        "account_number": "40300",
        "account_name": "Rental Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2346
      },
      {
        "account_number": "40400",
        "account_name": "Royalty Revenue",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2347
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2348
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2349
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2350
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2351
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2352
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2353
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2354
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2355
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2356
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2357
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2358
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2359
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2360
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2361
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2362
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2363
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2364
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2365
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2366
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2367
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2368
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2369
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2370
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2371
      },
      {
        "account_number": "61700",
        "account_name": "Other Expenses",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2372
      },
      {
        "account_number": "61702",
        "account_name": "Bank Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2373
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2374
      },
      {
        "account_number": "61715",
        "account_name": "Commissions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2375
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2376
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2377
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2378
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2379
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2380
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2381
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2382
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2383
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2384
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2385
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2386
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2387
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2388
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2389
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2390
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2391
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2392
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2393
      },
      {
        "account_number": "61830",
        "account_name": "Management Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2394
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2395
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2396
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2397
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2398
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2399
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2400
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2401
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2402
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2403
      }
    ]
  },
  {
    "name": "Retail and Wholesale Product Sales",
    "slug": "retail_and_wholesale_product_sales",
    "description": "Retail stores, online sellers, and wholesale product distribution businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2404
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2405
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2406
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2407
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2408
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2409
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2410
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2411
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2412
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2413
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2414
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2415
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2416
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2417
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2418
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2419
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2420
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2421
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2422
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2423
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2424
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2425
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2426
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2427
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2428
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2429
      },
      {
        "account_number": "50300",
        "account_name": "Shipping & Couriers",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2430
      },
      {
        "account_number": "50500",
        "account_name": "Returns",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2431
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2432
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2433
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2434
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2435
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2436
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2437
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2438
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2439
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2440
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2441
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2442
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2443
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2444
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2445
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2446
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2447
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2448
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2449
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2450
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2451
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2452
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2453
      },
      {
        "account_number": "61660",
        "account_name": "Shipping & Couriers",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2454
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2455
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2456
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2457
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2458
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2459
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2460
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2461
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2462
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2463
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2464
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2465
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2466
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2467
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2468
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2469
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2470
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2471
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2472
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2473
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2474
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2475
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2476
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2477
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2478
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2479
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2480
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2481
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2482
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2483
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2484
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2485
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2486
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2487
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2488
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2489
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2490
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2491
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2492
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2493
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2494
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2495
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2496
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2497
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2498
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2499
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2500
      }
    ]
  },
  {
    "name": "Ride-Sharing Driver",
    "slug": "ride_sharing_driver",
    "description": "Rideshare and gig transportation drivers operating personal vehicles.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2501
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2502
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2503
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2504
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2505
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2506
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2507
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2508
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2509
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2510
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2511
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2512
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2513
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2514
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2515
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2516
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2517
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2518
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2519
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2520
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2521
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2522
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2523
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2524
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2525
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2526
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2527
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2528
      },
      {
        "account_number": "60330",
        "account_name": "Parking/Tolls",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2529
      },
      {
        "account_number": "60340",
        "account_name": "Repairs/Tires",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2530
      },
      {
        "account_number": "60350",
        "account_name": "Car & Truck Insurance",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2531
      },
      {
        "account_number": "60360",
        "account_name": "Car & Truck Services",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2532
      },
      {
        "account_number": "60370",
        "account_name": "Car & Truck Taxes, Licenses & Inspections",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2533
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2534
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2535
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2536
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2537
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2538
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2539
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2540
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2541
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2542
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2543
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2544
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2545
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2546
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2547
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2548
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2549
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2550
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2551
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2552
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2553
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2554
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2555
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2556
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2557
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2558
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2559
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2560
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2561
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2562
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2563
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2564
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2565
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2566
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2567
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2568
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2569
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2570
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2571
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2572
      }
    ]
  },
  {
    "name": "Secondhand Stores",
    "slug": "secondhand_stores",
    "description": "Thrift stores, resale shops, consignment, and used goods retail businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2573
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2574
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2575
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2576
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2577
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2578
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2579
      },
      {
        "account_number": "10700",
        "account_name": "Inventory",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2580
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2581
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2582
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2583
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2584
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2585
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2586
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2587
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2588
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2589
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2590
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2591
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2592
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2593
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2594
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2595
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2596
      },
      {
        "account_number": "49000",
        "account_name": "Other Revenues",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2597
      },
      {
        "account_number": "50100",
        "account_name": "Materials & Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2598
      },
      {
        "account_number": "50200",
        "account_name": "Purchases/Inventory",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2599
      },
      {
        "account_number": "50300",
        "account_name": "Shipping & Couriers",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2600
      },
      {
        "account_number": "50500",
        "account_name": "Returns",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2601
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2602
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2603
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2604
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2605
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2606
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2607
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2608
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2609
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2610
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2611
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2612
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2613
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2614
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2615
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2616
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2617
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2618
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2619
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2620
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2621
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2622
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2623
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2624
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2625
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2626
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2627
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2628
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2629
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2630
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2631
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2632
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2633
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2634
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2635
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2636
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2637
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2638
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2639
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2640
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2641
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2642
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2643
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2644
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2645
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2646
      },
      {
        "account_number": "61920",
        "account_name": "Equipment & Machinery",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2647
      },
      {
        "account_number": "61930",
        "account_name": "Land",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2648
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2649
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2650
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2651
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2652
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2653
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2654
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2655
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2656
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2657
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2658
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2659
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2660
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2661
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2662
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2663
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2664
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2665
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2666
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2667
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2668
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2669
      }
    ]
  },
  {
    "name": "Website Design and Development",
    "slug": "website_design_and_development",
    "description": "Web design agencies, developers, and digital product creation businesses.",
    "accounts": [
      {
        "account_number": "10100",
        "account_name": "Cash",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2670
      },
      {
        "account_number": "10200",
        "account_name": "Accounts Receivable",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2671
      },
      {
        "account_number": "10300",
        "account_name": "Prepaid Expenses",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2672
      },
      {
        "account_number": "10400",
        "account_name": "Other Current Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2673
      },
      {
        "account_number": "10500",
        "account_name": "Fixed Assets",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2674
      },
      {
        "account_number": "10510",
        "account_name": "Accumulated Depreciation",
        "subcategory": "Fixed Assets",
        "category": "assets",
        "normal_balance": "credit",
        "sort_order": 2675
      },
      {
        "account_number": "10600",
        "account_name": "Vehicles",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2676
      },
      {
        "account_number": "20100",
        "account_name": "Accounts Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2677
      },
      {
        "account_number": "20200",
        "account_name": "Credit Cards Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2678
      },
      {
        "account_number": "20300",
        "account_name": "Accrued Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2679
      },
      {
        "account_number": "20400",
        "account_name": "Payroll Liabilities",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2680
      },
      {
        "account_number": "20500",
        "account_name": "Loans Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2681
      },
      {
        "account_number": "20600",
        "account_name": "Line of Credit",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2682
      },
      {
        "account_number": "20700",
        "account_name": "Notes Payable",
        "subcategory": null,
        "category": "liabilities",
        "normal_balance": "credit",
        "sort_order": 2683
      },
      {
        "account_number": "30100",
        "account_name": "Equity",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2684
      },
      {
        "account_number": "30110",
        "account_name": "Owner's Capital",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2685
      },
      {
        "account_number": "30120",
        "account_name": "Retained Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2686
      },
      {
        "account_number": "30130",
        "account_name": "Current Year Earnings",
        "subcategory": "Equity",
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2687
      },
      {
        "account_number": "30160",
        "account_name": "Owner Contribution",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "credit",
        "sort_order": 2688
      },
      {
        "account_number": "30170",
        "account_name": "Owner Withdraw",
        "subcategory": null,
        "category": "equity",
        "normal_balance": "debit",
        "sort_order": 2689
      },
      {
        "account_number": "40100",
        "account_name": "Revenues, Cash & Check",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2690
      },
      {
        "account_number": "40200",
        "account_name": "Revenues, Credit Card",
        "subcategory": "Operating Revenue",
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2691
      },
      {
        "account_number": "48100",
        "account_name": "Interest Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2692
      },
      {
        "account_number": "60100",
        "account_name": "Advertising",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2693
      },
      {
        "account_number": "60200",
        "account_name": "Bad Debt/Returned Checks",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2694
      },
      {
        "account_number": "60300",
        "account_name": "Car & Truck",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2695
      },
      {
        "account_number": "60310",
        "account_name": "Gas/Oil",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2696
      },
      {
        "account_number": "60320",
        "account_name": "Mileage Reimbursed",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2697
      },
      {
        "account_number": "60380",
        "account_name": "Car & Truck Other Expenses",
        "subcategory": "Car & Truck",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2698
      },
      {
        "account_number": "60500",
        "account_name": "Contractors",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2699
      },
      {
        "account_number": "60700",
        "account_name": "Donations",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2700
      },
      {
        "account_number": "60800",
        "account_name": "Education & Training",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2701
      },
      {
        "account_number": "60900",
        "account_name": "Employee Benefits",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2702
      },
      {
        "account_number": "60910",
        "account_name": "Accident Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2703
      },
      {
        "account_number": "60920",
        "account_name": "Health Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2704
      },
      {
        "account_number": "60930",
        "account_name": "Life Insurance",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2705
      },
      {
        "account_number": "60940",
        "account_name": "Pension/Retirement",
        "subcategory": "Employee Benefits",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2706
      },
      {
        "account_number": "61400",
        "account_name": "Insurance",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2707
      },
      {
        "account_number": "61410",
        "account_name": "Business Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2708
      },
      {
        "account_number": "61450",
        "account_name": "Workers Compensation Insurance",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2709
      },
      {
        "account_number": "61460",
        "account_name": "Life Insurance Owners",
        "subcategory": "Insurance",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2710
      },
      {
        "account_number": "61500",
        "account_name": "Meals & Entertainment",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2711
      },
      {
        "account_number": "61510",
        "account_name": "Dining/Restaurants",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2712
      },
      {
        "account_number": "61520",
        "account_name": "Entertainment",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2713
      },
      {
        "account_number": "61530",
        "account_name": "Working Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2714
      },
      {
        "account_number": "61540",
        "account_name": "DOT Meals",
        "subcategory": "Meals & Entertainment",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2715
      },
      {
        "account_number": "61600",
        "account_name": "Office",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2716
      },
      {
        "account_number": "61610",
        "account_name": "Hardware & Equipment",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2717
      },
      {
        "account_number": "61615",
        "account_name": "Home Office",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2718
      },
      {
        "account_number": "61620",
        "account_name": "Office Supplies",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2719
      },
      {
        "account_number": "61640",
        "account_name": "Postage",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2720
      },
      {
        "account_number": "61670",
        "account_name": "Software",
        "subcategory": "Office",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2721
      },
      {
        "account_number": "61710",
        "account_name": "Cleaning & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2722
      },
      {
        "account_number": "61720",
        "account_name": "Dues & Subscriptions",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2723
      },
      {
        "account_number": "61722",
        "account_name": "Entry Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2724
      },
      {
        "account_number": "61725",
        "account_name": "Gifts",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2725
      },
      {
        "account_number": "61727",
        "account_name": "Hair Products & Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2726
      },
      {
        "account_number": "61730",
        "account_name": "Interest - Mortgage",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2727
      },
      {
        "account_number": "61735",
        "account_name": "Interest - Other",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2728
      },
      {
        "account_number": "61740",
        "account_name": "Miscellaneous",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2729
      },
      {
        "account_number": "61745",
        "account_name": "Online Services",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2730
      },
      {
        "account_number": "61747",
        "account_name": "Passenger Supplies",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2731
      },
      {
        "account_number": "61749",
        "account_name": "Professional Development",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2732
      },
      {
        "account_number": "61750",
        "account_name": "Reference Materials",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2733
      },
      {
        "account_number": "61755",
        "account_name": "Repairs & Maintenance",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2734
      },
      {
        "account_number": "61765",
        "account_name": "Taxes & Licenses",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2735
      },
      {
        "account_number": "61766",
        "account_name": "Transaction & Processing Fees",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2736
      },
      {
        "account_number": "61768",
        "account_name": "Uniforms",
        "subcategory": "Other Expenses",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2737
      },
      {
        "account_number": "61770",
        "account_name": "Employee Wages and Taxes",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2738
      },
      {
        "account_number": "61772",
        "account_name": "Wages, Net Payroll",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2739
      },
      {
        "account_number": "61775",
        "account_name": "Payroll Taxes",
        "subcategory": "Employee Wages and Taxes",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2740
      },
      {
        "account_number": "61800",
        "account_name": "Professional Services",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2741
      },
      {
        "account_number": "61810",
        "account_name": "Accounting",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2742
      },
      {
        "account_number": "61820",
        "account_name": "Legal Fees",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2743
      },
      {
        "account_number": "61840",
        "account_name": "Tax Preparation",
        "subcategory": "Professional Services",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2744
      },
      {
        "account_number": "61900",
        "account_name": "Rent or Lease",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2745
      },
      {
        "account_number": "61940",
        "account_name": "Office Space",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2746
      },
      {
        "account_number": "61950",
        "account_name": "Vehicles",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2747
      },
      {
        "account_number": "61960",
        "account_name": "Buildings",
        "subcategory": "Rent or Lease",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2748
      },
      {
        "account_number": "62200",
        "account_name": "Seeds & Plants",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2749
      },
      {
        "account_number": "62300",
        "account_name": "Storage & Warehousing",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2750
      },
      {
        "account_number": "62400",
        "account_name": "Supplies",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2751
      },
      {
        "account_number": "62500",
        "account_name": "Travel",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2752
      },
      {
        "account_number": "62510",
        "account_name": "Airfare & Transportation",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2753
      },
      {
        "account_number": "62520",
        "account_name": "Hotel & Lodging",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2754
      },
      {
        "account_number": "62530",
        "account_name": "Taxi & Parking",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2755
      },
      {
        "account_number": "62540",
        "account_name": "Meals, Travel",
        "subcategory": "Travel",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2756
      },
      {
        "account_number": "62600",
        "account_name": "Utilities",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2757
      },
      {
        "account_number": "62610",
        "account_name": "Communications/Telephone/Internet",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2758
      },
      {
        "account_number": "62620",
        "account_name": "Gas/Electric/Water/Sewer",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2759
      },
      {
        "account_number": "62630",
        "account_name": "Trash",
        "subcategory": "Utilities",
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2760
      },
      {
        "account_number": "62640",
        "account_name": "Vet/Breeding/Medicine",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2761
      },
      {
        "account_number": "70110",
        "account_name": "Asset Purchase",
        "subcategory": null,
        "category": "assets",
        "normal_balance": "debit",
        "sort_order": 2762
      },
      {
        "account_number": "70150",
        "account_name": "Other Non-Deductible",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2763
      },
      {
        "account_number": "80110",
        "account_name": "Gain Loss on Sale",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2764
      },
      {
        "account_number": "80150",
        "account_name": "Other Non-Includible Income",
        "subcategory": null,
        "category": "revenue",
        "normal_balance": "credit",
        "sort_order": 2765
      },
      {
        "account_number": "89999",
        "account_name": "Uncategorized",
        "subcategory": null,
        "category": "expenses",
        "normal_balance": "debit",
        "sort_order": 2766
      }
    ]
  }
];

  for (const t of templates) {
    const [row] = await knex('coa_templates').insert({
      name: t.name,
      description: t.description,
      business_type: t.slug,
      is_system: true,
      is_active: true,
      account_count: t.accounts.length,
    }).returning('id');
    const templateId = row.id;
    if (t.accounts.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < t.accounts.length; i += CHUNK) {
        await knex('coa_template_accounts').insert(
          t.accounts.slice(i, i + CHUNK).map(a => ({
            template_id: templateId,
            account_number: a.account_number,
            account_name: a.account_name,
            subcategory: a.subcategory,
            category: a.category,
            normal_balance: a.normal_balance,
            sort_order: a.sort_order,
            is_active: true,
          }))
        );
      }
    }
  }
};
