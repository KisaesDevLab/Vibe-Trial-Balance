/**
 * Seed: Tax line reference data.
 *
 * Maps entity_type + tax_software → available tax line codes.
 * Starting with UltraTax for 1065 (Partnership) and 1120S (S-Corp).
 *
 * These codes correspond to UltraTax's spreadsheet import format.
 * Additional tax software formats (CCH, Lacerte, Drake) should be
 * added as separate seed files or expanded here.
 *
 * sort_order determines display sequence in the Tax Return Order report.
 */

import type { Knex } from 'knex';

interface TaxLineRow {
  entity_type: string;
  tax_software: string;
  tax_line_code: string;
  tax_line_description: string;
  form_section: string;
  sort_order: number;
}

export async function seed(knex: Knex): Promise<void> {
  await knex('tax_line_reference').del();

  const rows: TaxLineRow[] = [
    // ================================================================
    // FORM 1065 — PARTNERSHIP (UltraTax)
    // ================================================================

    // Page 1 — Income
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-1a', tax_line_description: 'Gross receipts or sales', form_section: 'Page 1 - Income', sort_order: 100 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-1b', tax_line_description: 'Returns and allowances', form_section: 'Page 1 - Income', sort_order: 101 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-2', tax_line_description: 'Cost of goods sold', form_section: 'Page 1 - Income', sort_order: 102 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-4', tax_line_description: 'Ordinary income (loss) from other partnerships', form_section: 'Page 1 - Income', sort_order: 104 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-5', tax_line_description: 'Net farm profit (loss)', form_section: 'Page 1 - Income', sort_order: 105 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-6', tax_line_description: 'Net gain (loss) from Form 4797', form_section: 'Page 1 - Income', sort_order: 106 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-7', tax_line_description: 'Other income (loss)', form_section: 'Page 1 - Income', sort_order: 107 },

    // Page 1 — Deductions
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-9', tax_line_description: 'Salaries and wages', form_section: 'Page 1 - Deductions', sort_order: 200 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-10', tax_line_description: 'Guaranteed payments to partners', form_section: 'Page 1 - Deductions', sort_order: 201 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-11', tax_line_description: 'Repairs and maintenance', form_section: 'Page 1 - Deductions', sort_order: 202 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-12', tax_line_description: 'Bad debts', form_section: 'Page 1 - Deductions', sort_order: 203 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-13', tax_line_description: 'Rent', form_section: 'Page 1 - Deductions', sort_order: 204 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-14', tax_line_description: 'Taxes and licenses', form_section: 'Page 1 - Deductions', sort_order: 205 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-15', tax_line_description: 'Interest', form_section: 'Page 1 - Deductions', sort_order: 206 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-16a', tax_line_description: 'Depreciation', form_section: 'Page 1 - Deductions', sort_order: 207 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-17', tax_line_description: 'Depletion', form_section: 'Page 1 - Deductions', sort_order: 208 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-18', tax_line_description: 'Retirement plans', form_section: 'Page 1 - Deductions', sort_order: 209 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-19', tax_line_description: 'Employee benefit programs', form_section: 'Page 1 - Deductions', sort_order: 210 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-20', tax_line_description: 'Other deductions', form_section: 'Page 1 - Deductions', sort_order: 211 },

    // Schedule K — Partners' Distributive Share Items
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-1', tax_line_description: 'Ordinary business income (loss)', form_section: 'Schedule K', sort_order: 300 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-2', tax_line_description: 'Net rental real estate income (loss)', form_section: 'Schedule K', sort_order: 301 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-3a', tax_line_description: 'Other net rental income (loss)', form_section: 'Schedule K', sort_order: 302 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-4', tax_line_description: 'Guaranteed payments — services', form_section: 'Schedule K', sort_order: 303 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-4b', tax_line_description: 'Guaranteed payments — capital', form_section: 'Schedule K', sort_order: 304 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-5', tax_line_description: 'Interest income', form_section: 'Schedule K', sort_order: 305 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-6a', tax_line_description: 'Ordinary dividends', form_section: 'Schedule K', sort_order: 306 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-7', tax_line_description: 'Royalties', form_section: 'Schedule K', sort_order: 307 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-8', tax_line_description: 'Net short-term capital gain (loss)', form_section: 'Schedule K', sort_order: 308 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-9a', tax_line_description: 'Net long-term capital gain (loss)', form_section: 'Schedule K', sort_order: 309 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-11', tax_line_description: 'Other income (loss)', form_section: 'Schedule K', sort_order: 311 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-12', tax_line_description: 'Section 179 deduction', form_section: 'Schedule K', sort_order: 312 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-13a', tax_line_description: 'Charitable contributions', form_section: 'Schedule K', sort_order: 313 },

    // Form 8825 — Rental Real Estate
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-2', tax_line_description: 'Rental real estate gross rents', form_section: 'Form 8825', sort_order: 400 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-3', tax_line_description: 'Advertising', form_section: 'Form 8825', sort_order: 401 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-4', tax_line_description: 'Auto and travel', form_section: 'Form 8825', sort_order: 402 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-5', tax_line_description: 'Cleaning and maintenance', form_section: 'Form 8825', sort_order: 403 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-9', tax_line_description: 'Insurance', form_section: 'Form 8825', sort_order: 407 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-11', tax_line_description: 'Mortgage interest', form_section: 'Form 8825', sort_order: 409 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-14', tax_line_description: 'Taxes', form_section: 'Form 8825', sort_order: 412 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-15', tax_line_description: 'Utilities', form_section: 'Form 8825', sort_order: 413 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-16', tax_line_description: 'Depreciation — rental', form_section: 'Form 8825', sort_order: 414 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '8825-17', tax_line_description: 'Other rental expenses', form_section: 'Form 8825', sort_order: 415 },

    // Schedule L — Balance Sheet
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-1', tax_line_description: 'Cash', form_section: 'Schedule L - Assets', sort_order: 500 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-2', tax_line_description: 'Trade notes and accounts receivable', form_section: 'Schedule L - Assets', sort_order: 501 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-3', tax_line_description: 'Less allowance for bad debts', form_section: 'Schedule L - Assets', sort_order: 502 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-4', tax_line_description: 'Inventories', form_section: 'Schedule L - Assets', sort_order: 503 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-6', tax_line_description: 'Mortgage and real estate loans', form_section: 'Schedule L - Assets', sort_order: 505 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-7', tax_line_description: 'Other investments', form_section: 'Schedule L - Assets', sort_order: 506 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-8', tax_line_description: 'Buildings and other depreciable assets', form_section: 'Schedule L - Assets', sort_order: 507 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-8b', tax_line_description: 'Less accumulated depreciation', form_section: 'Schedule L - Assets', sort_order: 508 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-9', tax_line_description: 'Land', form_section: 'Schedule L - Assets', sort_order: 509 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-10', tax_line_description: 'Intangible assets', form_section: 'Schedule L - Assets', sort_order: 510 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-10b', tax_line_description: 'Less accumulated amortization', form_section: 'Schedule L - Assets', sort_order: 511 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-11', tax_line_description: 'Other assets', form_section: 'Schedule L - Assets', sort_order: 512 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-15', tax_line_description: 'Accounts payable', form_section: 'Schedule L - Liabilities', sort_order: 600 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-16', tax_line_description: 'Mortgages, notes, bonds payable (<1 yr)', form_section: 'Schedule L - Liabilities', sort_order: 601 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-17', tax_line_description: 'Other current liabilities', form_section: 'Schedule L - Liabilities', sort_order: 602 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-19', tax_line_description: 'Mortgages, notes, bonds payable (>1 yr)', form_section: 'Schedule L - Liabilities', sort_order: 604 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-20', tax_line_description: 'Other liabilities', form_section: 'Schedule L - Liabilities', sort_order: 605 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-21', tax_line_description: "Partners' capital accounts", form_section: 'Schedule L - Capital', sort_order: 700 },

    // ================================================================
    // FORM 1120S — S-CORPORATION (UltraTax)
    // ================================================================

    // Page 1 — Income
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-1a', tax_line_description: 'Gross receipts or sales', form_section: 'Page 1 - Income', sort_order: 100 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-1b', tax_line_description: 'Returns and allowances', form_section: 'Page 1 - Income', sort_order: 101 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-2', tax_line_description: 'Cost of goods sold', form_section: 'Page 1 - Income', sort_order: 102 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-4', tax_line_description: 'Net gain (loss) from Form 4797', form_section: 'Page 1 - Income', sort_order: 104 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-5', tax_line_description: 'Other income (loss)', form_section: 'Page 1 - Income', sort_order: 105 },

    // Page 1 — Deductions
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-7', tax_line_description: 'Compensation of officers', form_section: 'Page 1 - Deductions', sort_order: 200 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-8', tax_line_description: 'Salaries and wages', form_section: 'Page 1 - Deductions', sort_order: 201 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-9', tax_line_description: 'Repairs and maintenance', form_section: 'Page 1 - Deductions', sort_order: 202 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-10', tax_line_description: 'Bad debts', form_section: 'Page 1 - Deductions', sort_order: 203 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-11', tax_line_description: 'Rents', form_section: 'Page 1 - Deductions', sort_order: 204 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-12', tax_line_description: 'Taxes and licenses', form_section: 'Page 1 - Deductions', sort_order: 205 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-13', tax_line_description: 'Interest', form_section: 'Page 1 - Deductions', sort_order: 206 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-14', tax_line_description: 'Depreciation', form_section: 'Page 1 - Deductions', sort_order: 207 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-15', tax_line_description: 'Depletion', form_section: 'Page 1 - Deductions', sort_order: 208 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-16', tax_line_description: 'Advertising', form_section: 'Page 1 - Deductions', sort_order: 209 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-17', tax_line_description: 'Pension/profit-sharing plans', form_section: 'Page 1 - Deductions', sort_order: 210 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-18', tax_line_description: 'Employee benefit programs', form_section: 'Page 1 - Deductions', sort_order: 211 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-19', tax_line_description: 'Other deductions', form_section: 'Page 1 - Deductions', sort_order: 212 },

    // Schedule K — Shareholders' Pro Rata Share Items
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-1', tax_line_description: 'Ordinary business income (loss)', form_section: 'Schedule K', sort_order: 300 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-2', tax_line_description: 'Net rental real estate income (loss)', form_section: 'Schedule K', sort_order: 301 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-3a', tax_line_description: 'Other net rental income (loss)', form_section: 'Schedule K', sort_order: 302 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-4', tax_line_description: 'Interest income', form_section: 'Schedule K', sort_order: 303 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-5a', tax_line_description: 'Ordinary dividends', form_section: 'Schedule K', sort_order: 304 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-6', tax_line_description: 'Royalties', form_section: 'Schedule K', sort_order: 305 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-7', tax_line_description: 'Net short-term capital gain (loss)', form_section: 'Schedule K', sort_order: 306 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-8a', tax_line_description: 'Net long-term capital gain (loss)', form_section: 'Schedule K', sort_order: 307 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-10', tax_line_description: 'Other income (loss)', form_section: 'Schedule K', sort_order: 310 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-11', tax_line_description: 'Section 179 deduction', form_section: 'Schedule K', sort_order: 311 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-12a', tax_line_description: 'Charitable contributions', form_section: 'Schedule K', sort_order: 312 },

    // Schedule L — Balance Sheet (S-Corp)
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-1', tax_line_description: 'Cash', form_section: 'Schedule L - Assets', sort_order: 500 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-2', tax_line_description: 'Trade notes and accounts receivable', form_section: 'Schedule L - Assets', sort_order: 501 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-3', tax_line_description: 'Less allowance for bad debts', form_section: 'Schedule L - Assets', sort_order: 502 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-4', tax_line_description: 'Inventories', form_section: 'Schedule L - Assets', sort_order: 503 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-7', tax_line_description: 'Other investments', form_section: 'Schedule L - Assets', sort_order: 506 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-8', tax_line_description: 'Buildings and other depreciable assets', form_section: 'Schedule L - Assets', sort_order: 507 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-8b', tax_line_description: 'Less accumulated depreciation', form_section: 'Schedule L - Assets', sort_order: 508 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-9', tax_line_description: 'Land', form_section: 'Schedule L - Assets', sort_order: 509 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-10', tax_line_description: 'Intangible assets', form_section: 'Schedule L - Assets', sort_order: 510 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-10b', tax_line_description: 'Less accumulated amortization', form_section: 'Schedule L - Assets', sort_order: 511 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-11', tax_line_description: 'Other assets', form_section: 'Schedule L - Assets', sort_order: 512 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-15', tax_line_description: 'Accounts payable', form_section: 'Schedule L - Liabilities', sort_order: 600 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-16', tax_line_description: 'Mortgages, notes, bonds payable (<1 yr)', form_section: 'Schedule L - Liabilities', sort_order: 601 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-17', tax_line_description: 'Other current liabilities', form_section: 'Schedule L - Liabilities', sort_order: 602 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-18', tax_line_description: 'Loans from shareholders', form_section: 'Schedule L - Liabilities', sort_order: 603 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-19', tax_line_description: 'Mortgages, notes, bonds payable (>1 yr)', form_section: 'Schedule L - Liabilities', sort_order: 604 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-20', tax_line_description: 'Other liabilities', form_section: 'Schedule L - Liabilities', sort_order: 605 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-22', tax_line_description: 'Common stock', form_section: 'Schedule L - Equity', sort_order: 700 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-23', tax_line_description: 'Additional paid-in capital', form_section: 'Schedule L - Equity', sort_order: 701 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-24', tax_line_description: 'Retained earnings', form_section: 'Schedule L - Equity', sort_order: 702 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-25', tax_line_description: 'Adjustments to shareholders equity', form_section: 'Schedule L - Equity', sort_order: 703 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-26', tax_line_description: 'Less cost of treasury stock', form_section: 'Schedule L - Equity', sort_order: 704 },

    // ================================================================
    // DO NOT MAP (available for all entity types)
    // ================================================================
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'DONOTMAP', tax_line_description: 'Do Not Map (exclude from export)', form_section: 'N/A', sort_order: 9999 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'DONOTMAP', tax_line_description: 'Do Not Map (exclude from export)', form_section: 'N/A', sort_order: 9999 },
  ];

  // Insert in chunks (Knex/PG has a parameter limit)
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await knex('tax_line_reference').insert(rows.slice(i, i + chunkSize));
  }
}
