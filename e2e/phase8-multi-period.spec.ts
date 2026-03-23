import { test, expect } from '@playwright/test';
import {
  login,
  selectDemoClientAndPeriod,
  mockComparisonApi,
  mockVarianceNotesPut,
  mockPeriodsWithTwo,
} from './helpers';

// ─── suite setup ─────────────────────────────────────────────────────────────

test.describe('Phase 8 — Multi-Period Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. No period selected ───────────────────────────────────────────────

  test('shows "no period selected" placeholder when no period is active', async ({ page }) => {
    await page.goto('/multi-period');
    await expect(page.getByText('No period selected')).toBeVisible();
    await expect(page.getByText(/choose a client and period/i)).toBeVisible();
  });

  // ─── 2. Period selected but no compare period ────────────────────────────

  test('shows prompt to select compare period after period is chosen', async ({ page }) => {
    // Mock two periods so the dropdown has options
    await mockPeriodsWithTwo(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    await expect(page.getByText('Period Comparison')).toBeVisible();
    await expect(page.getByText(/select a period above to compare/i)).toBeVisible();
  });

  // ─── 3. Page controls ───────────────────────────────────────────────────

  test('renders "Compare to" dropdown and threshold input', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    // "Compare to:" label
    await expect(page.getByText('Compare to:')).toBeVisible();

    // Select with placeholder "— select period —"
    const compareSelect = page.getByRole('main').getByRole('combobox');
    await expect(compareSelect).toBeVisible();

    // Threshold input defaults to 10
    const thresholdInput = page.locator('input[type="number"]');
    await expect(thresholdInput).toHaveValue('10');

    // "%" label next to threshold
    await expect(page.getByText('%')).toBeVisible();
  });

  test('threshold input accepts new values', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const thresholdInput = page.locator('input[type="number"]');
    await thresholdInput.fill('25');
    await expect(thresholdInput).toHaveValue('25');
  });

  // ─── 4. Compare period dropdown has correct options ──────────────────────

  test('"Compare to" dropdown lists the other period only', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    // FY 2023 should be available (FY 2024 is selected as primary)
    await expect(compareSelect.locator('option', { hasText: 'FY 2023' })).toHaveCount(1);
    // FY 2024 should NOT appear (it's the current period)
    await expect(compareSelect.locator('option', { hasText: 'FY 2024' })).toHaveCount(0);
  });

  // ─── 5. Comparison table loads ───────────────────────────────────────────

  test('loads comparison table after selecting compare period', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Header shows both period names
    await expect(page.getByRole('columnheader', { name: 'FY 2024' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'FY 2023' })).toBeVisible();

    // Table column headers
    await expect(page.getByRole('columnheader', { name: /acct/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /account name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /\$ change/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /% change/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /note/i })).toBeVisible();
  });

  test('renders category section headers', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Mock data includes assets, revenue, expenses (exact match avoids "Total Assets" etc.)
    await expect(page.getByText('Assets', { exact: true })).toBeVisible();
    await expect(page.getByText('Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Expenses', { exact: true })).toBeVisible();
  });

  test('renders account rows with correct data', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Cash - Operating row
    await expect(page.getByText('1000')).toBeVisible();
    await expect(page.getByText('Cash - Operating')).toBeVisible();

    // Service Revenue row
    await expect(page.getByText('4000')).toBeVisible();
    await expect(page.getByText('Service Revenue')).toBeVisible();

    // Cost of Goods Sold row
    await expect(page.getByText('5000')).toBeVisible();
    await expect(page.getByText('Cost of Goods Sold')).toBeVisible();
  });

  test('renders category subtotal rows', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
  });

  // ─── 6. Significance highlighting ───────────────────────────────────────

  test('flags rows above threshold with amber background', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    // Set threshold to 10% (default) — all mock rows have variance > 10%
    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Cash - Operating: 25% variance — should be highlighted (bg-amber-50)
    const cashRow = page.getByText('Cash - Operating').locator('xpath=ancestor::tr');
    await expect(cashRow).toHaveClass(/bg-amber-50/);
  });

  test('legend text reflects the current threshold', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    await expect(page.getByText(/highlighted rows have variance > 10%/i)).toBeVisible();

    // Change threshold — legend updates
    const thresholdInput = page.locator('input[type="number"]');
    await thresholdInput.fill('20');
    await expect(page.getByText(/highlighted rows have variance > 20%/i)).toBeVisible();
  });

  test('raising threshold above all variances removes amber highlighting', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Raise threshold to 99% — no row should have amber background
    const thresholdInput = page.locator('input[type="number"]');
    await thresholdInput.fill('99');

    const cashRow = page.getByText('Cash - Operating').locator('xpath=ancestor::tr');
    await expect(cashRow).not.toHaveClass(/bg-amber-50/);
  });

  // ─── 7. Variance note cells ──────────────────────────────────────────────

  test('existing note is shown in the note cell', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Service Revenue has note: 'New contracts in Q3' in mock data
    await expect(page.getByText('New contracts in Q3')).toBeVisible();
  });

  test('clicking empty note cell enters edit mode', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // Cash - Operating has no note — click "Add note…" button
    const addNoteBtn = page.getByRole('button', { name: /add note…/i }).first();
    await addNoteBtn.click();

    // Input should appear
    await expect(page.locator('input[placeholder="Variance explanation…"]')).toBeVisible();
  });

  test('pressing Enter in note input saves the note', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await mockVarianceNotesPut(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    const addNoteBtn = page.getByRole('button', { name: /add note…/i }).first();
    await addNoteBtn.click();

    const noteInput = page.locator('input[placeholder="Variance explanation…"]');
    await noteInput.fill('Increase due to acquisition');
    await noteInput.press('Enter');

    // Input should disappear (edit mode closed)
    await expect(noteInput).not.toBeVisible();
  });

  test('pressing Escape in note input cancels without saving', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    const addNoteBtn = page.getByRole('button', { name: /add note…/i }).first();
    await addNoteBtn.click();

    const noteInput = page.locator('input[placeholder="Variance explanation…"]');
    await noteInput.fill('Should be discarded');
    await noteInput.press('Escape');

    await expect(noteInput).not.toBeVisible();
    // Original "Add note…" button should be back
    await expect(addNoteBtn).toBeVisible();
  });

  test('clicking ✓ button saves the note', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await mockVarianceNotesPut(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    const addNoteBtn = page.getByRole('button', { name: /add note…/i }).first();
    await addNoteBtn.click();

    const noteInput = page.locator('input[placeholder="Variance explanation…"]');
    await noteInput.fill('Confirmed via tick');
    await page.getByRole('button', { name: '✓' }).click();

    await expect(noteInput).not.toBeVisible();
  });

  test('clicking ✕ button cancels without saving', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    const addNoteBtn = page.getByRole('button', { name: /add note…/i }).first();
    await addNoteBtn.click();

    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.locator('input[placeholder="Variance explanation…"]')).not.toBeVisible();
  });

  // ─── 8. PDF buttons ──────────────────────────────────────────────────────

  test('shows Preview PDF and Download PDF buttons after comparison loads', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    await expect(page.getByRole('link', { name: 'Preview PDF' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible();
  });

  test('PDF links point to the correct flux endpoint', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    const previewLink = page.getByRole('link', { name: 'Preview PDF' });
    const downloadLink = page.getByRole('link', { name: 'Download PDF' });

    const previewHref = await previewLink.getAttribute('href');
    const downloadHref = await downloadLink.getAttribute('href');

    expect(previewHref).toMatch(/\/reports\/periods\/\d+\/flux\/\d+\?preview=true/);
    expect(downloadHref).toMatch(/\/reports\/periods\/\d+\/flux\/\d+\?preview=false/);
  });

  test('PDF buttons are hidden when no compare period is selected', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    await expect(page.getByRole('link', { name: 'Preview PDF' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Download PDF' })).not.toBeVisible();
  });

  // ─── 9. Period label in controls bar ─────────────────────────────────────

  test('shows "FY 2024 vs. FY 2023" label in controls bar after selection', async ({ page }) => {
    await mockPeriodsWithTwo(page);
    await mockComparisonApi(page);
    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    // The controls bar renders the period names as visible <span> elements (not hidden <option>)
    await expect(page.locator('span').filter({ hasText: /^FY 2024$/ })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^FY 2023$/ })).toBeVisible();
    await expect(page.getByText(/vs\./i)).toBeVisible();
  });

  // ─── 10. Empty state ─────────────────────────────────────────────────────

  test('shows "no accounts found" message when comparison returns empty rows', async ({ page }) => {
    await mockPeriodsWithTwo(page);

    // Override comparison mock to return empty rows
    await page.route(/\/api\/v1\/periods\/\d+\/compare\/\d+$/, async (route) => {
      const url = route.request().url();
      const match = url.match(/periods\/(\d+)\/compare\/(\d+)/);
      const [, periodId, comparePeriodId] = match!;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            period:        { id: Number(periodId),        period_name: 'FY 2024', start_date: '2024-01-01', end_date: '2024-12-31' },
            comparePeriod: { id: Number(comparePeriodId), period_name: 'FY 2023', start_date: '2023-01-01', end_date: '2023-12-31' },
            rows: [],
          },
          error: null,
        }),
      });
    });

    await page.goto('/multi-period');
    await selectDemoClientAndPeriod(page);

    const compareSelect = page.getByRole('main').getByRole('combobox');
    await compareSelect.selectOption({ label: 'FY 2023' });

    await expect(page.getByText(/no accounts found for this period/i)).toBeVisible();
  });
});
