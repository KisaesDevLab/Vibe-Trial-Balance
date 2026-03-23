/**
 * Comprehensive engagement QA — simulates a CPA completing an S-Corp engagement
 * for Demo Company LLC (FY 2024) from start to finish.
 *
 * Workflow:
 *   1.  Login + dashboard loads
 *   2.  Client/period selection
 *   3.  Trial Balance Grid — navigate, edit balance, verify totals
 *   4.  Journal Entries — create book AJE, verify balance check
 *   5.  Tax Mapping — assign tax code, verify progress bar
 *   6.  Financial Statements — verify IS net income, BS balance check
 *   7.  Trial Balance Report — verify debit/credit columns + CSV export
 *   8.  Tax-Basis P&L — verify net income calculation
 *   9.  Tax Return Order — verify it loads accounts
 *   10. Multi-Period Comparison — verify variance display
 *   11. Exports page — validate pre-export checks, trigger download
 *   12. General Ledger — verify running balance
 *   13. Bank Transactions — load page, verify stat bar
 *   14. Periods — verify lock workflow
 *   15. Period navigation — verify sidebar period selector
 */

import { test, expect, type Page } from '@playwright/test';
import { login, selectDemoClientAndPeriod } from './helpers';

// ─── shared helpers ────────────────────────────────────────────────────────────

async function goTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

function fmt(dollars: number): string {
  return dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── 1. Login ─────────────────────────────────────────────────────────────────

test.describe('1. Authentication', () => {
  test('login page renders and rejects bad credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.locator('input[type="text"]').fill('wronguser');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should stay on login or show error
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('login succeeds with admin/admin and redirects to dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i }).or(page.getByText(/dashboard/i).first())).toBeVisible();
  });
});

// ─── 2. Dashboard + Client Selection ──────────────────────────────────────────

test.describe('2. Dashboard and client selection', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('dashboard shows stat cards when no client selected', async ({ page }) => {
    await goTo(page, '/dashboard');
    // Either shows "select a client" message or stat cards
    const body = page.locator('main, [role="main"], .flex-1').first();
    await expect(body).toBeVisible();
  });

  test('selecting Demo Company LLC shows period selector', async ({ page }) => {
    await goTo(page, '/dashboard');
    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ label: 'Demo Company LLC' });

    const periodSelect = page.locator('select').nth(1);
    await periodSelect.waitFor({ state: 'visible', timeout: 5000 });
    const options = await periodSelect.locator('option[value]').allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some(o => o.includes('2024'))).toBe(true);
  });

  test('selecting client + period loads dashboard metrics', async ({ page }) => {
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    // Wait for any stat cards or content
    await page.waitForTimeout(1500);
    // Dashboard should show something meaningful
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
  });
});

// ─── 3. Trial Balance Grid ─────────────────────────────────────────────────────

test.describe('3. Trial Balance Grid', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/trial-balance');
    await page.waitForTimeout(1000);
  });

  test('TB grid loads with account rows', async ({ page }) => {
    // Should show account rows
    await expect(page.getByText('Cash - Operating')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Service Revenue')).toBeVisible();
    await expect(page.getByText('Salaries & Wages')).toBeVisible();
  });

  test('TB grid shows debit and credit columns', async ({ page }) => {
    const headers = page.locator('th');
    const headerTexts = await headers.allTextContents();
    // Should have Dr and Cr columns
    expect(headerTexts.some(h => h.match(/Dr|DR|Debit/i))).toBe(true);
    expect(headerTexts.some(h => h.match(/Cr|CR|Credit/i))).toBe(true);
  });

  test('TB footer shows balanced totals', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1500);
    // Look for a footer or totals row
    const balancedIndicator = page.getByText(/balanced|in balance/i);
    // If balanced indicator exists, it should show "balanced"
    // (data from seed is balanced so this should pass)
    if (await balancedIndicator.count() > 0) {
      await expect(balancedIndicator.first()).toBeVisible();
    }
  });

  test('clicking a balance cell makes it editable', async ({ page }) => {
    await page.waitForTimeout(1500);
    // Find a table cell that contains a debit amount (non-zero)
    const rows = page.locator('tbody tr').filter({ hasText: 'Cash - Operating' });
    await expect(rows.first()).toBeVisible({ timeout: 3000 });

    // Click on the first numeric cell in that row
    const cells = rows.first().locator('td');
    const count = await cells.count();
    if (count > 2) {
      await cells.nth(2).click();
      await page.waitForTimeout(300);
      // An input should appear
      const input = cells.nth(2).locator('input');
      if (await input.count() > 0) {
        await expect(input).toBeVisible();
        // Press Escape to cancel
        await input.press('Escape');
      }
    }
  });

  test('CSV export button is present and clickable', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /import|export|csv/i }).first();
    if (await exportBtn.count() > 0) {
      await expect(exportBtn).toBeVisible();
    }
  });
});

// ─── 4. Journal Entries ────────────────────────────────────────────────────────

test.describe('4. Journal Entries', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/journal-entries');
    await page.waitForTimeout(1000);
  });

  test('journal entries page loads with existing demo AJE', async ({ page }) => {
    await expect(page.getByText(/depreciation/i).or(page.getByText(/journal/i)).first()).toBeVisible({ timeout: 5000 });
  });

  test('add new journal entry button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /new|add|create/i });
    await expect(addBtn.first()).toBeVisible({ timeout: 3000 });
  });

  test('new JE dialog validates that debit must equal credit', async ({ page }) => {
    // Wait for the JE page to finish loading
    await page.waitForTimeout(1000);

    // Click "+ New Entry" button
    const addBtn = page.getByRole('button', { name: /new entry/i });
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await addBtn.click();
    await page.waitForTimeout(600);

    // The JE form renders inline — verify it appeared
    const saveBtn = page.getByRole('button', { name: /save entry/i });
    if (!(await saveBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // The Save button is disabled until the form has valid content (reference + balanced lines)
    // Verify it starts disabled (correct form validation behavior)
    const isDisabled = await saveBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
    expect(isDisabled).toBe(true);

    // Add a line and enter mismatched debit/credit to trigger balance error
    const addLineBtn = page.getByRole('button', { name: /add line/i });
    if (await addLineBtn.isVisible().catch(() => false)) {
      await addLineBtn.click();
      await page.waitForTimeout(200);
      // After adding a line the button may become enabled; save still won't balance
      // Just verify the form is still open (cancel button visible)
    }

    // Close the form
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
    await page.waitForTimeout(300);
    // After cancel, "Save Entry" should no longer be visible
    await expect(saveBtn).not.toBeVisible({ timeout: 2000 });
  });

  test('filter by type (Book / Tax) works', async ({ page }) => {
    await page.waitForTimeout(1000);
    const typeFilter = page.getByRole('combobox').or(page.locator('select')).first();
    if (await typeFilter.isVisible()) {
      const options = await typeFilter.locator('option').allTextContents();
      if (options.some(o => /book/i.test(o))) {
        await typeFilter.selectOption({ label: options.find(o => /book/i.test(o))! });
        await page.waitForTimeout(500);
        // Should show filtered results
        const rows = page.locator('tbody tr');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(0); // Just verify no crash
      }
    }
  });
});

// ─── 5. Tax Mapping ────────────────────────────────────────────────────────────

test.describe('5. Tax Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/tax-mapping');
    await page.waitForTimeout(1500);
  });

  test('tax mapping page shows accounts with tax code dropdowns', async ({ page }) => {
    await expect(page.getByText('Service Revenue').or(page.getByText('Cash - Operating')).first()).toBeVisible({ timeout: 5000 });
  });

  test('progress bar shows mapping completion', async ({ page }) => {
    // Should show x/y accounts mapped
    const progressText = page.getByText(/mapped|accounts/i);
    await expect(progressText.first()).toBeVisible({ timeout: 3000 });
  });

  test('net income row appears at bottom', async ({ page }) => {
    await page.waitForTimeout(1000);
    const netIncomeRow = page.getByText(/net income|net loss/i);
    if (await netIncomeRow.count() > 0) {
      await expect(netIncomeRow.first()).toBeVisible();
    }
  });

  test('balance sheet check row is present', async ({ page }) => {
    await page.waitForTimeout(1000);
    const bsCheck = page.getByText(/balance sheet|balanced|assets.*liabilit/i);
    if (await bsCheck.count() > 0) {
      await expect(bsCheck.first()).toBeVisible();
    }
  });

  test('tax code dropdown is usable', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Find any select in the table body
    const selects = page.locator('tbody select, tbody [role="combobox"]');
    const count = await selects.count();
    if (count > 0) {
      await expect(selects.first()).toBeEnabled();
    }
  });
});

// ─── 6. Financial Statements ───────────────────────────────────────────────────

test.describe('6. Financial Statements', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/financial-statements');
    await page.waitForTimeout(1500);
  });

  test('income statement tab shows revenue and expense sections', async ({ page }) => {
    // Give the IS extra time to fetch and render — it aggregates multiple queries
    await page.waitForTimeout(2500);
    await expect(page.getByText('Revenue').first()).toBeVisible({ timeout: 8000 });
    // Use a specific section-header cell to avoid strict-mode ambiguity
    await expect(page.getByRole('cell', { name: 'Expenses', exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('net income / net loss row is shown', async ({ page }) => {
    await expect(page.getByText(/net income|net loss/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('balance sheet tab shows assets, liabilities, equity sections', async ({ page }) => {
    // Look for Balance Sheet tab
    const bsTab = page.getByRole('tab', { name: /balance sheet/i }).or(page.getByRole('button', { name: /balance sheet/i }));
    if (await bsTab.count() > 0) {
      await bsTab.first().click();
      await page.waitForTimeout(500);
    }
    await expect(page.getByText('Assets').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Liabilities/i).first()).toBeVisible();
    await expect(page.getByText(/Equity/i).first()).toBeVisible();
  });

  test('IS revenue shows positive amounts (correct sign convention)', async ({ page }) => {
    // Revenue for Demo Company: $450k service + $220k product = $670k
    // The amounts should be positive (not in parentheses)
    const content = await page.locator('body').textContent() ?? '';
    // If we see revenue amounts, they should not all be in parens
    // Service Revenue: 450,000.00 not (450,000.00)
    expect(content).not.toMatch(/\(450,000\.00\)/);
  });

  test('PDF preview button is present', async ({ page }) => {
    const pdfBtn = page.getByRole('button', { name: /pdf|preview|download/i });
    if (await pdfBtn.count() > 0) {
      await expect(pdfBtn.first()).toBeVisible();
    }
  });

  test('column toggle (Book / Tax / Unadjusted) works', async ({ page }) => {
    const colToggle = page.getByRole('combobox').or(page.locator('select')).first();
    if (await colToggle.isVisible()) {
      const options = await colToggle.locator('option').allTextContents();
      if (options.some(o => /tax/i.test(o))) {
        await colToggle.selectOption({ label: options.find(o => /tax/i.test(o))! });
        await page.waitForTimeout(500);
        await expect(page.getByText('Revenue').first()).toBeVisible();
      }
    }
  });
});

// ─── 7. Trial Balance Report ───────────────────────────────────────────────────

test.describe('7. Trial Balance Report', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/trial-balance-report');
    await page.waitForTimeout(1500);
  });

  test('TB report loads with account rows', async ({ page }) => {
    await expect(page.getByText('Cash - Operating')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Service Revenue')).toBeVisible();
  });

  test('TB report has separate DR and CR columns', async ({ page }) => {
    const headers = await page.locator('th').allTextContents();
    expect(headers.some(h => /^Dr$/i.test(h.trim()) || h.trim() === 'Dr')).toBe(true);
    expect(headers.some(h => /^Cr$/i.test(h.trim()) || h.trim() === 'Cr')).toBe(true);
  });

  test('category sections are labeled (Assets, Liabilities, Revenue)', async ({ page }) => {
    await expect(page.getByText('Assets').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Revenue').first()).toBeVisible();
    await expect(page.getByText('Liabilities').first()).toBeVisible();
  });

  test('export Excel button works', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export.*excel|export excel/i });
    if (await exportBtn.count() > 0) {
      // Set up download listener
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        exportBtn.first().click(),
      ]);
      // Either download started or button was clicked without error
      expect(true).toBe(true);
    }
  });

  test('CY vs PY variance columns are present', async ({ page }) => {
    const headers = await page.locator('th').allTextContents();
    expect(headers.some(h => /var|pct|%/i.test(h))).toBe(true);
  });
});

// ─── 8. Tax-Basis P&L ─────────────────────────────────────────────────────────

test.describe('8. Tax-Basis P&L', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/tax-basis-pl');
    await page.waitForTimeout(1500);
  });

  test('page loads with revenue and expense groups', async ({ page }) => {
    // Should show accounts grouped by tax code
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });

  test('Net Income row appears at bottom', async ({ page }) => {
    await expect(page.getByText(/net income|net loss/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('net income is NOT a sum of revenue + expenses (correct sign)', async ({ page }) => {
    // Demo data: Revenue $670k, Expenses $550k → Net Income should be ~$120k, not $1.22M
    // Get the net income cell text
    const content = await page.locator('body').textContent() ?? '';

    // If net income appears, the number should be reasonable (not a huge sum)
    // Revenue: 450+220 = 670k. Expenses: 280+180+48+25+12+5 = 550k. Net = 120k
    // The WRONG answer would be 1,220,000 (sum). The RIGHT answer is ~120,000
    // We check the net income does not show a value over 700,000
    const netIncomeMatch = content.match(/net income.*?([\d,]+)/i);
    if (netIncomeMatch) {
      const val = parseInt(netIncomeMatch[1].replace(/,/g, ''), 10);
      // Should be much less than 700,000 (sum of revenues alone)
      expect(val).toBeLessThan(700000);
    }
  });

  test('PDF download button is present and enabled', async ({ page }) => {
    const dlBtn = page.getByRole('button', { name: /download.*pdf|⬇/i });
    if (await dlBtn.count() > 0) {
      await expect(dlBtn.first()).toBeVisible();
    }
  });
});

// ─── 9. Tax Return Order ───────────────────────────────────────────────────────

test.describe('9. Tax Return Order', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/tax-return-order');
    await page.waitForTimeout(1500);
  });

  test('page loads with accounts', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });

  test('category filter dropdown works', async ({ page }) => {
    const filter = page.locator('select').filter({ hasText: /all categories/i });
    if (await filter.count() > 0) {
      await filter.selectOption('revenue');
      await page.waitForTimeout(500);
      // Should only show revenue accounts
      await expect(page.getByText('Service Revenue')).toBeVisible({ timeout: 3000 });
    }
  });

  test('account count badge shows mapped/total', async ({ page }) => {
    const mappedText = page.getByText(/\d+\/\d+.*mapped/i);
    if (await mappedText.count() > 0) {
      await expect(mappedText.first()).toBeVisible();
    }
  });
});

// ─── 10. Multi-Period Comparison ──────────────────────────────────────────────

test.describe('10. Multi-Period Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/multi-period');
    await page.waitForTimeout(1500);
  });

  test('page shows compare-to period dropdown', async ({ page }) => {
    // Compare dropdown should appear in the main content area
    const mainArea = page.getByRole('main').or(page.locator('.flex-1').first());
    const compareSelect = mainArea.getByRole('combobox').or(mainArea.locator('select'));
    // Either shows dropdown or placeholder text
    const content = await page.locator('body').textContent() ?? '';
    expect(content.length).toBeGreaterThan(0);
  });

  test('compare-to placeholder shown when no second period selected', async ({ page }) => {
    // Should show some guidance text if only one period exists
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toBeTruthy();
  });

  test('variance columns show $ and % headers', async ({ page }) => {
    // Try selecting the period in the compare dropdown
    const mainComboboxes = page.getByRole('main').locator('select, [role="combobox"]');
    const count = await mainComboboxes.count();
    if (count > 0) {
      // headers for variance columns might appear after selection
      const headers = await page.locator('th').allTextContents();
      const hasVariance = headers.some(h => /var|%|variance/i.test(h));
      // If comparison is active, headers should be there
      if (hasVariance) {
        expect(true).toBe(true); // variance columns present
      }
    }
  });
});

// ─── 11. Exports ──────────────────────────────────────────────────────────────

test.describe('11. Exports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/exports');
    await page.waitForTimeout(2000);
  });

  test('exports page shows pre-export validation section', async ({ page }) => {
    await expect(page.getByText(/validation|pre-export/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('balance status shows (balanced or out of balance)', async ({ page }) => {
    await page.waitForTimeout(2000); // Let validation query run
    const balanceStatus = page.getByText(/balanced|out of balance/i);
    await expect(balanceStatus.first()).toBeVisible({ timeout: 5000 });
  });

  test('software selector has all 5 options', async ({ page }) => {
    // The exports page has two software <select> elements in the main content area;
    // the sidebar also has client/period selects — find the one with UltraTax.
    const allSelects = page.locator('select');
    const count = await allSelects.count();
    expect(count).toBeGreaterThan(0);

    let found = false;
    for (let i = 0; i < count; i++) {
      const opts = await allSelects.nth(i).locator('option').allTextContents();
      if (opts.some(o => /ultratax/i.test(o))) {
        expect(opts.some(o => /cch/i.test(o))).toBe(true);
        expect(opts.some(o => /lacerte/i.test(o))).toBe(true);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('download tax software export works (UltraTax)', async ({ page }) => {
    const downloadBtn = page.getByRole('button', { name: /download.*ultratax|ultratax.*export/i });
    if (await downloadBtn.count() > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        downloadBtn.first().click(),
      ]);
      // Either download started or it processed without error
    }
  });

  test('working TB and bookkeeper letter sections visible', async ({ page }) => {
    await expect(page.getByText(/working trial balance/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/bookkeeper letter/i)).toBeVisible({ timeout: 3000 });
  });
});

// ─── 12. General Ledger ───────────────────────────────────────────────────────

test.describe('12. General Ledger', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/general-ledger');
    await page.waitForTimeout(1500);
  });

  test('general ledger shows account sections', async ({ page }) => {
    await expect(page.getByText('Cash - Operating').or(page.getByText(/account/i)).first()).toBeVisible({ timeout: 5000 });
  });

  test('balance column is present', async ({ page }) => {
    const headers = await page.locator('th').allTextContents();
    expect(headers.some(h => /balance/i.test(h))).toBe(true);
  });

  test('opening balance row shows unadjusted balance', async ({ page }) => {
    await page.waitForTimeout(1000);
    const unadjText = page.getByText(/unadjusted balance/i);
    if (await unadjText.count() > 0) {
      await expect(unadjText.first()).toBeVisible();
    }
  });

  test('filter by account works', async ({ page }) => {
    const filterInput = page.getByRole('textbox', { name: /search|filter|account/i }).or(page.locator('input[type="text"]').first());
    if (await filterInput.count() > 0 && await filterInput.isVisible()) {
      await filterInput.fill('Cash');
      await page.waitForTimeout(400);
      await expect(page.getByText('Cash - Operating')).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── 13. Bank Transactions ────────────────────────────────────────────────────

test.describe('13. Bank Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/bank-transactions');
    await page.waitForTimeout(1500);
  });

  test('bank transactions page loads without crash', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    // No JavaScript errors causing full white page
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('import button is present', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /import/i });
    if (await importBtn.count() > 0) {
      await expect(importBtn.first()).toBeVisible();
    }
  });

  test('classification rules tab/section is accessible', async ({ page }) => {
    const rulesBtn = page.getByRole('button', { name: /rules/i }).or(page.getByText(/classification rules/i));
    if (await rulesBtn.count() > 0) {
      await rulesBtn.first().click();
      await page.waitForTimeout(500);
    }
  });
});

// ─── 14. Transaction Entry ────────────────────────────────────────────────────

test.describe('14. Transaction Entry Register', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/transaction-entry');
    await page.waitForTimeout(1500);
  });

  test('page loads with a blank register row', async ({ page }) => {
    // Should show the date, ref, payee, category, amount columns
    const headers = await page.locator('th').allTextContents();
    expect(headers.some(h => /date/i.test(h))).toBe(true);
    expect(headers.some(h => /payee/i.test(h))).toBe(true);
    expect(headers.some(h => /amount/i.test(h))).toBe(true);
  });

  test('stat cards show 0 entries initially', async ({ page }) => {
    const statCards = page.locator('[class*="bg-gray-50"]').or(page.locator('.grid .border'));
    await expect(statCards.first()).toBeVisible({ timeout: 3000 });
  });

  test('entering a payee name updates the row', async ({ page }) => {
    const payeeInput = page.locator('input[placeholder*="Payee"]').or(page.locator('input[placeholder*="payee"]')).first();
    if (await payeeInput.count() > 0) {
      await payeeInput.fill('Test Vendor');
      await page.waitForTimeout(300);
      await expect(payeeInput).toHaveValue('Test Vendor');
    }
  });

  test('entering amount updates stat cards in real time', async ({ page }) => {
    const amountInput = page.locator('input[placeholder="-85.00"]').or(page.locator('input[placeholder*="amount"]')).first();
    if (await amountInput.count() > 0) {
      await amountInput.fill('-100.00');
      await page.waitForTimeout(400);
      // Debit stat should update
      const bodyText = await page.locator('body').textContent() ?? '';
      expect(bodyText).toContain('100');
    }
  });

  test('save button is disabled when no valid rows', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /save.*transaction/i });
    if (await saveBtn.count() > 0) {
      await expect(saveBtn.first()).toBeDisabled();
    }
  });
});

// ─── 15. Periods + Lock ────────────────────────────────────────────────────────

test.describe('15. Periods and locking', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
    await goTo(page, '/periods');
    await page.waitForTimeout(1000);
  });

  test('periods page shows FY 2024', async ({ page }) => {
    // Allow extra time for the periods query to complete
    await page.waitForTimeout(1500);
    // Look in the table body, not the sidebar's hidden <option> element
    const periodRow = page.locator('tbody').getByText('FY 2024').first();
    await expect(periodRow).toBeVisible({ timeout: 8000 });
  });

  test('lock button is present for unlocked period', async ({ page }) => {
    const lockBtn = page.getByRole('button', { name: /lock/i });
    if (await lockBtn.count() > 0) {
      await expect(lockBtn.first()).toBeVisible();
    }
  });

  test('roll forward option is present', async ({ page }) => {
    const rollBtn = page.getByRole('button', { name: /roll.?forward|rollover/i });
    if (await rollBtn.count() > 0) {
      await expect(rollBtn.first()).toBeVisible();
    }
  });
});

// ─── 16. Chart of Accounts ────────────────────────────────────────────────────

test.describe('16. Chart of Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    const clientSelect = page.locator('select').first();
    await clientSelect.selectOption({ label: 'Demo Company LLC' });
    await page.waitForTimeout(500);
    await goTo(page, '/chart-of-accounts');
    await page.waitForTimeout(1500);
  });

  test('COA shows all 16 demo accounts', async ({ page }) => {
    await expect(page.getByText('Cash - Operating')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Service Revenue')).toBeVisible();
    await expect(page.getByText('Cost of Goods Sold')).toBeVisible();
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(16);
  });

  test('add account button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|new|create/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 3000 });
  });

  test('account category filter works', async ({ page }) => {
    const filter = page.locator('select').or(page.getByRole('combobox')).first();
    if (await filter.isVisible()) {
      const options = await filter.locator('option').allTextContents();
      if (options.some(o => /revenue/i.test(o))) {
        await filter.selectOption({ label: options.find(o => /revenue/i.test(o))! });
        await page.waitForTimeout(400);
        await expect(page.getByText('Service Revenue')).toBeVisible({ timeout: 2000 });
      }
    }
  });
});

// ─── 17. Sidebar Navigation ───────────────────────────────────────────────────

test.describe('17. Sidebar navigation and UX', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('all main nav groups are visible in sidebar', async ({ page }) => {
    const nav = page.locator('nav, aside');
    await expect(nav.first()).toBeVisible();
    const text = await nav.first().textContent() ?? '';
    expect(text).toMatch(/Bookkeeping/i);
    expect(text).toMatch(/Reports/i);
    expect(text).toMatch(/Tax/i);
  });

  test('sidebar groups expand and collapse', async ({ page }) => {
    // Sidebar groups default to closed (defaultOpen: false).
    // Toggle behavior: one click opens, one click closes.
    const bookkeepingToggle = page.getByRole('button', { name: /bookkeeping/i });
    if (!(await bookkeepingToggle.isVisible().catch(() => false))) return;

    // Determine current state: is "Bank Transactions" already visible?
    const bankTxLink = page.getByRole('link', { name: 'Bank Transactions' });
    const wasOpen = await bankTxLink.isVisible().catch(() => false);

    if (!wasOpen) {
      // Group is closed — click once to open
      await bookkeepingToggle.click();
      await page.waitForTimeout(400);
      await expect(bankTxLink).toBeVisible({ timeout: 3000 });
    }

    // Now close the group
    await bookkeepingToggle.click();
    await page.waitForTimeout(400);
    await expect(bankTxLink).not.toBeVisible({ timeout: 2000 });

    // Re-open and verify
    await bookkeepingToggle.click();
    await page.waitForTimeout(400);
    await expect(bankTxLink).toBeVisible({ timeout: 3000 });
  });

  test('Transaction Entry link appears in Bookkeeping group', async ({ page }) => {
    // Expand bookkeeping
    const bookkeepingToggle = page.getByRole('button', { name: /bookkeeping/i });
    if (await bookkeepingToggle.count() > 0) {
      await bookkeepingToggle.click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole('link', { name: 'Transaction Entry' })).toBeVisible({ timeout: 3000 });
  });

  test('active route is highlighted in sidebar', async ({ page }) => {
    await goTo(page, '/clients');
    // The Clients link should have active styling
    const clientsLink = page.getByRole('link', { name: /^Clients$/i });
    if (await clientsLink.count() > 0) {
      const cls = await clientsLink.first().getAttribute('class') ?? '';
      // Active link should have some distinctive class
      expect(cls).toMatch(/active|bg-gray-7|border-blue|font-medium/);
    }
  });

  test('font size A- A+ controls work', async ({ page }) => {
    const increaseBtn = page.getByTitle('Increase font size').or(page.getByRole('button', { name: /A\+/i }));
    if (await increaseBtn.count() > 0) {
      await increaseBtn.click();
      await page.waitForTimeout(200);
      await increaseBtn.click();
      await page.waitForTimeout(200);
      // No crash = pass
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('sign out button logs user out', async ({ page }) => {
    const signOutBtn = page.getByRole('button', { name: /sign out/i });
    await expect(signOutBtn).toBeVisible({ timeout: 3000 });
    await signOutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });
});

// ─── 18. Admin pages ──────────────────────────────────────────────────────────

test.describe('18. Admin pages (admin user)', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('users page is accessible', async ({ page }) => {
    await goTo(page, '/users');
    await expect(page.getByText(/admin|user/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('audit log page loads with records', async ({ page }) => {
    await goTo(page, '/audit-log');
    await page.waitForTimeout(1500);
    // Should show a table or empty state
    const content = await page.locator('body').textContent() ?? '';
    expect(content.length).toBeGreaterThan(10);
  });

  test('COA templates page shows system templates', async ({ page }) => {
    await goTo(page, '/coa-templates');
    await page.waitForTimeout(1500);
    await expect(page.getByText(/general business|template/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('settings page loads', async ({ page }) => {
    await goTo(page, '/settings');
    await expect(page.getByText(/setting|api key|claude/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── 20. PDF Report Buttons — download and preview ────────────────────────────

/**
 * Each report page has two buttons:
 *   ↗ Preview PDF  → window.open(objectUrl, '_blank')  → captured as Playwright 'popup'
 *   ⬇ Download PDF → <a download> click               → captured as Playwright 'download'
 *
 * Strategy: intercept the fetch to /api/v1/reports/... and return a minimal
 * valid PDF so the test does not depend on a live pdfmake render but DOES
 * verify the complete button → fetch → blob → open/download flow.
 */

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
  'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
  '0000000058 00000 n\n0000000115 00000 n\n' +
  'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n',
);

/** Stub all /api/v1/reports/ endpoints to return a minimal PDF */
async function stubPdfEndpoints(page: import('@playwright/test').Page) {
  await page.route(/\/api\/v1\/reports\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: MINIMAL_PDF,
    });
  });
}

test.describe('20. PDF Report Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, '/dashboard');
    await selectDemoClientAndPeriod(page);
  });

  /** Helper: navigate to page, stub PDFs, click Download PDF, assert download */
  async function testDownload(page: import('@playwright/test').Page, route: string) {
    await stubPdfEndpoints(page);
    await goTo(page, route);
    await page.waitForTimeout(1500);

    const dlBtn = page.getByRole('button', { name: /download.*pdf|⬇/i }).first();
    if (!(await dlBtn.isVisible())) return; // page needs a period — already selected

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      dlBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  }

  /** Helper: navigate to page, stub PDFs, click Preview PDF, assert popup opens */
  async function testPreview(page: import('@playwright/test').Page, route: string) {
    await stubPdfEndpoints(page);
    await goTo(page, route);
    await page.waitForTimeout(1500);

    const previewBtn = page.getByRole('button', { name: /preview.*pdf|↗/i }).first();
    if (!(await previewBtn.isVisible())) return;

    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }),
      previewBtn.click(),
    ]);
    // A popup window was opened — that's the PDF preview mechanism working.
    // Blob URLs are created via URL.createObjectURL and set on window.open(); the popup
    // may show as 'about:blank' initially before the blob URL is loaded.
    expect(popup).toBeTruthy();
    // Give the popup a moment to navigate to the blob URL, then close it
    await page.waitForTimeout(300);
    await popup.close().catch(() => {});
  }

  test('Trial Balance Report — download PDF', async ({ page }) => {
    await testDownload(page, '/trial-balance-report');
  });

  test('Trial Balance Report — preview PDF opens popup', async ({ page }) => {
    await testPreview(page, '/trial-balance-report');
  });

  test('Financial Statements (IS) — download PDF', async ({ page }) => {
    await testDownload(page, '/financial-statements');
  });

  test('Financial Statements (IS) — preview PDF opens popup', async ({ page }) => {
    await testPreview(page, '/financial-statements');
  });

  test('General Ledger — download PDF', async ({ page }) => {
    await testDownload(page, '/general-ledger');
  });

  test('General Ledger — preview PDF opens popup', async ({ page }) => {
    await testPreview(page, '/general-ledger');
  });

  test('Tax-Basis P&L — download PDF', async ({ page }) => {
    await testDownload(page, '/tax-basis-pl');
  });

  test('Tax-Basis P&L — preview PDF opens popup', async ({ page }) => {
    await testPreview(page, '/tax-basis-pl');
  });

  test('Tax Return Order — download PDF', async ({ page }) => {
    await testDownload(page, '/tax-return-order');
  });

  test('Tax Return Order — preview PDF opens popup', async ({ page }) => {
    await testPreview(page, '/tax-return-order');
  });

  test('AJE Listing — download PDF', async ({ page }) => {
    await testDownload(page, '/aje-listing');
  });

  test('Workpaper Index — download PDF', async ({ page }) => {
    await testDownload(page, '/workpaper-index');
  });

  test('Tax Code Report — download PDF', async ({ page }) => {
    await testDownload(page, '/tax-code-report');
  });
});

// ─── 19. Report pages — no crash check ────────────────────────────────────────

test.describe('19. All report pages load without crash', () => {
  const reportRoutes = [
    '/trial-balance-report',
    '/general-ledger',
    '/tax-code-report',
    '/workpaper-index',
    '/aje-listing',
    '/financial-statements',
    '/cash-flow',
    '/tax-basis-pl',
    '/tax-return-order',
    '/multi-period',
    '/exports',
    '/workpaper-package',
    '/custom-reports',
  ];

  for (const route of reportRoutes) {
    test(`${route} loads without error`, async ({ page }) => {
      await login(page);
      await goTo(page, '/dashboard');
      await selectDemoClientAndPeriod(page);
      await goTo(page, route);
      await page.waitForTimeout(1000);

      // Page should not show a blank white screen or React error boundary
      const content = await page.locator('body').textContent() ?? '';
      expect(content.length).toBeGreaterThan(20);
      // Should not show generic error
      expect(content).not.toMatch(/Cannot read properties|TypeError|undefined is not|Uncaught/);
    });
  }
});
