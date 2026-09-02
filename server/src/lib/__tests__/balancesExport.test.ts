// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Balances-export recognition for the TB CSV import: the header row is what
 * names the layout, `adjusted_balance` is the column imported, `p_n_l` sets
 * the statement, and the QuickBooks columns ride along.
 * Run: npx tsx --test src/lib/__tests__/balancesExport.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectBalancesExport,
  duplicatedQboIds,
  parsePnlFlag,
  parseQboAccountId,
  parseQboAccountName,
} from '../balancesExport';
import { inferAccountType } from '../accountTypeInference';
import { normalizeQboDisplayName } from '../qbo/matcher';

process.env.JWT_SECRET ??= 'test'.repeat(16);
const { parseAllRows, detectKnownLayout } = require('../../routes/csvImport') as typeof import('../../routes/csvImport');

/** The header exactly as the export writes it. */
const HEADER = 'account_number,account_name,p_n_l,beginning_balance,unadjusted_balance,adjusted_balance,federal_balance,state_balance,other_balance,budget_amount,wp_reference,quickbooks_account_description,qbo_account_id,xero_account_id,category';

const FILE = [
  HEADER,
  '3999,P & L Summary,N,0,0,0,0,0,0,0,,,,,--',
  '9999,Rounding Account,Y,0,0,0,0,0,0,0,,,,,--',
  '2810,Note Payable - Hawthorn Bank,N,-116265.79,-116265.79,-62274.92999999999,-62274.92999999999,-62274.92999999999,-62274.92999999999,0,,Note Payable - Hawthorn Bank,67,,--',
  '4740,Rental Income,Y,42982,42982,51522.67999999999,51522.67999999999,51522.67999999999,51522.67999999999,0,,47400 Rental Income,36,,--',
  '2710,Due To/From Tolson,N,0,0,0,0,0,0,0,,160000 Due from Tolson Drug,72,,--',
  '1600,Due to Tolson Drug,N,53507.56,53507.56,21428.559999999998,21428.559999999998,21428.559999999998,21428.559999999998,0,,160000 Due to Tolson Drug,72,,--',
  '6045,Overdraft Fees,Y,350,350,350,350,350,350,0,,60400 Bank Service Charges:60450 Overdraft Fees,91,,--',
  '3424,Note Payable - Hawthorn Bank,N,0,0,-92148.34,-92148.34,-92148.34,-92148.34,0,,,,,--',
];

test('the header names the layout; column order is not assumed', () => {
  const cols = detectBalancesExport(HEADER.split(','));
  assert.deepEqual(cols, { accountNumber: 0, accountName: 1, amount: 5, pnl: 2, qboAccountName: 11, qboAccountId: 12 });

  const shuffled = detectBalancesExport(['qbo_account_id', 'adjusted_balance', 'account_name', 'p_n_l', 'account_number']);
  assert.deepEqual(shuffled, { accountNumber: 4, accountName: 2, amount: 1, pnl: 3, qboAccountName: null, qboAccountId: 0 });
});

test('an ordinary trial balance header is not the layout', () => {
  assert.equal(detectBalancesExport(['Acct', 'Name', 'Debit', 'Credit']), null);
  // Close but missing the P&L flag — the mapping would be a guess, so no.
  assert.equal(detectBalancesExport(['account_number', 'account_name', 'adjusted_balance']), null);
  assert.equal(detectBalancesExport([]), null);
});

test('detectKnownLayout maps the whole file deterministically', () => {
  const layout = detectKnownLayout(['', ...FILE])!;
  assert.ok(layout);
  assert.equal(layout.detectedFormat, 'balances_export');
  assert.equal(layout.delimiter, ',');
  assert.equal(layout.headerRow, 1);
  assert.equal(layout.dataStartRow, 2);
  assert.equal(layout.amountFormat, 'single_signed');
  assert.equal(layout.columns.amount, 5);
  assert.equal(layout.columns.debit, null);
  assert.equal(detectKnownLayout(['Acct,Name,Debit,Credit', '1000,Cash,1,']), null);
});

test('parseAllRows imports adjusted_balance, signed, with the carried fields', () => {
  const layout = detectKnownLayout(FILE)!;
  const rows = parseAllRows(FILE, layout.columns, layout.delimiter, layout.dataStartRow, layout.amountFormat, layout.rowsToSkip);
  assert.equal(rows.length, FILE.length);
  assert.equal(rows[0].action, 'skip'); // header

  const byNum = new Map(rows.map((r) => [r.csvAccountNumber, r]));
  const np = byNum.get('2810')!;
  assert.equal(np.action, 'create_new');
  // adjusted (-62274.92999999999), not unadjusted (-116265.79); float noise rounded half-up
  assert.equal(np.creditCents, 6227493);
  assert.equal(np.debitCents, 0);
  assert.equal(np.pnl, 'N');
  assert.equal(np.qboAccountId, '67');
  assert.equal(np.qboAccountName, 'Note Payable - Hawthorn Bank');

  const rent = byNum.get('4740')!;
  assert.equal(rent.debitCents, 5152268);
  assert.equal(rent.pnl, 'Y');
  assert.equal(rent.qboAccountName, '47400 Rental Income');

  // Blank QBO cells come back null, not '' — the confirm tests truthiness.
  const summary = byNum.get('3999')!;
  assert.equal(summary.qboAccountId, null);
  assert.equal(summary.qboAccountName, null);
  assert.equal(summary.pnl, 'N');
  // Zero-balance rows are still real accounts (they carry links).
  assert.equal(summary.action, 'create_new');
});

test('an ordinary mapping leaves the carried fields off the row entirely', () => {
  const rows = parseAllRows(['1000,Cash,10,'], { accountNumber: 0, accountName: 1, debit: 2, credit: 3, amount: null }, ',', 0, 'separate_dr_cr', []);
  assert.equal('pnl' in rows[0], false);
  assert.equal('qboAccountId' in rows[0], false);
});

test('parsePnlFlag / parseQboAccountId / parseQboAccountName', () => {
  assert.equal(parsePnlFlag('Y'), 'Y');
  assert.equal(parsePnlFlag(' n '), 'N');
  assert.equal(parsePnlFlag('yes'), 'Y');
  assert.equal(parsePnlFlag(''), null);
  assert.equal(parsePnlFlag('maybe'), null);
  assert.equal(parseQboAccountId('72'), '72');
  assert.equal(parseQboAccountId(' 72 '), '72');
  assert.equal(parseQboAccountId(''), null);
  assert.equal(parseQboAccountId('QB72'), null);
  assert.equal(parseQboAccountName('  '), null);
  assert.equal(parseQboAccountName('x'.repeat(300))!.length, 255);
});

test('a QBO id on two rows is reported, never linked', () => {
  assert.deepEqual([...duplicatedQboIds(['67', '72', null, '72', '36', undefined])], ['72']);
  assert.equal(duplicatedQboIds([]).size, 0);
});

test('the P&L flag corrects a leading digit on the wrong statement, and only then', () => {
  // Consistent: the digit stands.
  assert.equal(inferAccountType('3999', 'P & L Summary', 'bs').category, 'equity');
  assert.equal(inferAccountType('9999', 'Rounding Account', 'pnl').category, 'expenses');
  assert.equal(inferAccountType('2810', 'Note Payable', 'bs').category, 'liabilities');
  assert.equal(inferAccountType('4740', 'Rental Income', 'pnl').category, 'revenue');
  // Disagreement: fall back to a name on the right statement, else the default.
  assert.equal(inferAccountType('1500', 'Interest Income', 'pnl').category, 'revenue');
  assert.equal(inferAccountType('1500', 'Bank Fees', 'pnl').category, 'expenses');
  assert.equal(inferAccountType('4200', 'Loan From Officer', 'bs').category, 'liabilities');
  assert.equal(inferAccountType('4200', 'Mystery', 'bs').category, 'assets');
  // No hint: unchanged behaviour.
  assert.equal(inferAccountType('4200', 'Loan From Officer').category, 'revenue');
  assert.equal(inferAccountType(null, 'Loan From Officer').category, 'liabilities');
});

test('normalizeQboDisplayName drops the per-level QBO numbers the export prints', () => {
  assert.equal(normalizeQboDisplayName('60400 Bank Service Charges:60450 Overdraft Fees'), 'bank service charges:overdraft fees');
  assert.equal(normalizeQboDisplayName('Bank Service Charges:Overdraft Fees'), 'bank service charges:overdraft fees');
  assert.equal(normalizeQboDisplayName('160000 Due to Tolson Drug'), 'due to tolson drug');
  assert.equal(normalizeQboDisplayName('  Lease   Income '), 'lease income');
  // A leading word that is not purely numeric stays.
  assert.equal(normalizeQboDisplayName('2nd Floor Rent'), '2nd floor rent');
  assert.equal(normalizeQboDisplayName('1.2 Sub'), 'sub');
});
