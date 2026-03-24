# Tax Mapping

## Overview
The Tax Mapping page is a **separate, read-only view** of the trial balance where you assign tax codes to each account. Unlike the TB grid, Tax Mapping shows category subtotals, net income, and a balance sheet check.

Access: **Tax > Tax Mapping**

## How to Assign Tax Codes Manually
1. Select your client and period in the sidebar
2. Go to **Tax > Tax Mapping**
3. For each account, click the **Tax Code** dropdown
4. Search for the appropriate code by typing part of the code or description
5. Select the code — the assignment saves immediately (optimistic update with a green flash confirmation)

## Progress Bar
The progress bar at the top shows what percentage of accounts have been assigned a tax code. Aim for 100% before generating tax exports. The progress bar color changes from red → amber → green as you map more accounts.

## Category Subtotals
Tax Mapping groups accounts by category (Assets, Liabilities, Equity, Income, Expense) and shows subtotals. This helps verify that the tax-mapped balances are correct before exporting.

## Net Income Row
A computed Net Income row appears at the bottom of the Income/Expense section showing Income minus Expenses. This should match the net income on your financial statements.

## Balance Sheet Check
The balance sheet check verifies that Assets = Liabilities + Equity. If the balance sheet is out of balance, a red warning banner appears. Fix the imbalance in the TB grid before proceeding.

## Auto-Assign (AI Feature)
The **Auto-Assign Tax Codes** button triggers AI-powered tax code suggestions. Before processing, a **data disclosure popup** shows what data will be sent to the AI provider (account names/numbers, entity type, available tax codes — client name is NOT sent).

The assignment uses a 5-step waterfall that suggests tax codes for all unmapped accounts:

1. **Existing mapping**: If the account already has a tax code, it's confirmed at 100% confidence
2. **Prior-period mapping**: Looks for the same account number mapped in an earlier period for this client (95% confidence)
3. **Cross-client mapping**: Looks for the same account number mapped in other clients (80% confidence)
4. **AI assignment**: Claude AI analyzes the account name, category, and client entity/activity type to suggest the best tax code (confidence varies, typically 60–95%)
5. **Unmappable**: Accounts the AI cannot classify with confidence are flagged as unmappable

### Reviewing Auto-Assign Results
After clicking **Auto-Assign Tax Codes**, the **Assignment Preview Modal** opens:
- Each suggestion shows the account, suggested code, description, source (step 1–5), and confidence score
- **Color coding**: Green = high confidence (≥80%), Amber = medium (60–79%), Red = low (<60%)
- For any suggestion, you can use the override dropdown to select a different tax code
- Click **Confirm Selected** to write all (or selected) assignments to the database

### Bulk Confirm
Select checkboxes for multiple accounts and click **Confirm Selected** to accept those assignments in bulk. Use this to quickly confirm all high-confidence (green) suggestions.

### Dual-Write Behavior
When a tax code is assigned, the system writes both:
1. `tax_code_id` FK to the `tax_codes` table (new system, used by exports)
2. `tax_line` VARCHAR string (legacy field, for backward compatibility with older export formats)

## Roll-Forward
When you roll forward a period, tax code assignments carry forward from the prior year. This saves significant time for returning clients — typically only new accounts need to be mapped in subsequent years.

## Tips
- Run **Auto-Assign** first, then manually assign the remaining flagged accounts
- Check that the client's **Activity Type** is correct before running auto-assign (it affects which codes are suggested for rental, farm, etc.)
- The cross-client waterfall improves over time as you map more clients — accounts with common names get suggested correctly for new clients
