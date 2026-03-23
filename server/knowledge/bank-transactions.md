# Bank Transactions

## Importing Transactions
1. Go to **Bookkeeping > Bank Transactions**
2. Click **Import** and select your file format:
   - **OFX**: standard bank export format (most banks support this)
   - **CSV**: comma-separated file; the AI will map columns automatically
3. Select the source account (the bank account in your COA)
4. Upload the file — duplicate transactions are automatically detected using SHA-256 hash deduplication; duplicates are skipped silently

## AI Classification
- After import, click **Classify with AI** to have Claude suggest account assignments for unclassified transactions
- Each suggestion includes a **confidence score** (0–100%)
- High-confidence matches (>85%) are highlighted in green
- Review and confirm each classification, or use **Bulk Confirm** to accept all high-confidence matches at once
- Confidence improves over time as classification rules accumulate

## Status Values
Transactions move through these statuses:
- **unclassified**: imported but not yet assigned to an account
- **suggested**: AI has suggested an account, pending user confirmation
- **confirmed**: user has confirmed the account assignment

You cannot lock a period if there are unclassified transactions.

## Classification Rules
Rules automatically classify future transactions matching a pattern:
- **Payee (exact)**: matches if the payee name is exactly equal
- **Payee (contains)**: matches if the payee name includes a phrase
- **Amount range**: optionally restrict the rule to a min/max amount
- **Transaction type**: debit or credit

Rules are applied in **priority order** (sort_order). Lower sort_order = higher priority. When multiple rules match, the highest-priority rule wins.

### Managing Rules
1. Go to **Bookkeeping > Bank Transactions**
2. Click the **Rules** tab
3. Add, edit, reorder, or delete rules
4. Rules created via the Transaction Entry register are added here automatically

## Bulk Operations
- Select multiple transactions using the checkboxes
- Use the **Batch** dropdown to:
  - **Confirm selected**: Accept the current suggested accounts
  - **Reclassify selected**: Change the account for all selected transactions
  - **Delete selected**: Remove the selected transactions
- A toast notification confirms the result of each batch operation

## Reclassification
- To change a confirmed transaction's account: click the account name to edit it
- All reclassifications are recorded in the audit trail with the original and new account

## Manual Transaction Entry
For transactions that can't be imported (paper statements, checks, transfers), use the **Transaction Entry Register** at **Bookkeeping > Transaction Entry**. This provides a spreadsheet-style grid for fast batch entry with smart payee suggestions.

The single **New Transaction** button on the Bank Transactions page adds one transaction at a time; use Transaction Entry for entering multiple transactions efficiently.

## Filtering and Sorting
Use the filter bar to show transactions by:
- Status (unclassified, suggested, confirmed)
- Date range
- Source account
- Payee search text

Sort by date, amount, or payee by clicking column headers.

## Pagination
Bank transactions are paginated (50 per page by default for performance). Use the pagination controls at the bottom to navigate through large imports.
