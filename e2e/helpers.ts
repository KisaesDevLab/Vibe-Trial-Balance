import { Page } from '@playwright/test';

export async function login(page: Page, username = 'admin', password = 'admin') {
  await page.goto('/login');
  // Labels on LoginPage are not linked via htmlFor/id, so target by input type
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/** Select Demo Company LLC in sidebar, then select the first available period */
export async function selectDemoClientAndPeriod(page: Page) {
  // Sidebar has two selects: client first, then period
  const clientSelect = page.locator('select').first();
  await clientSelect.selectOption({ label: 'Demo Company LLC' });

  // Period select appears after client is chosen
  const periodSelect = page.locator('select').nth(1);
  await periodSelect.waitFor({ state: 'visible', timeout: 5000 });
  const options = await periodSelect.locator('option[value]').all();
  for (const opt of options) {
    const val = await opt.getAttribute('value');
    if (val) {
      await periodSelect.selectOption(val);
      return;
    }
  }
}

/**
 * Intercept comparison API with mock data for two period IDs.
 * Uses a wildcard pattern so it works regardless of actual DB IDs.
 */
export async function mockComparisonApi(page: Page) {
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
          rows: [
            {
              account_id: 101, account_number: '1000', account_name: 'Cash - Operating',
              category: 'assets', normal_balance: 'debit', sort_order: 10,
              current_balance: 15000000, compare_balance: 12000000,
              variance_amount: 3000000, variance_pct: 25.0, note: null,
            },
            {
              account_id: 102, account_number: '4000', account_name: 'Service Revenue',
              category: 'revenue', normal_balance: 'credit', sort_order: 90,
              current_balance: 45000000, compare_balance: 38000000,
              variance_amount: 7000000, variance_pct: 18.4, note: 'New contracts in Q3',
            },
            {
              account_id: 103, account_number: '5000', account_name: 'Cost of Goods Sold',
              category: 'expenses', normal_balance: 'debit', sort_order: 110,
              current_balance: 28000000, compare_balance: 24000000,
              variance_amount: 4000000, variance_pct: 16.7, note: null,
            },
          ],
        },
        error: null,
      }),
    });
  });
}

/** Intercept variance-notes PUT to capture request body without hitting the DB */
export async function mockVarianceNotesPut(page: Page) {
  await page.route(/\/api\/v1\/periods\/\d+\/compare\/\d+\/variance-notes\/\d+/, async (route) => {
    if (route.request().method() !== 'PUT') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 1, note: 'test' }, error: null }),
    });
  });
}

/** Add a second mock period to the periods list API response */
export async function mockPeriodsWithTwo(page: Page) {
  await page.route(/\/api\/v1\/clients\/\d+\/periods/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 10, period_name: 'FY 2024', start_date: '2024-01-01', end_date: '2024-12-31', is_current: true,  is_locked: false, client_id: 1 },
          { id: 11, period_name: 'FY 2023', start_date: '2023-01-01', end_date: '2023-12-31', is_current: false, is_locked: false, client_id: 1 },
        ],
        error: null,
        meta: {},
      }),
    });
  });
}
