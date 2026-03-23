# Chart of Accounts

## Overview
The Chart of Accounts (COA) is the master list of accounts for a client. It is shared across all periods. Access: **Setup > Chart of Accounts** (with a client selected).

## Account Fields
Each account has:
- **Account Number**: A unique identifier within the client (e.g., "1010", "4100"). Used for CSV import matching.
- **Account Name**: Descriptive name (e.g., "Cash — Operating", "Sales Revenue")
- **Category**: Assets, Liabilities, Equity, Income (Revenue), or Expense
- **Normal Balance**: Debit or Credit — determines whether increases are debits or credits
- **Tax Code**: The assigned tax line for exports (assigned on the Tax Mapping page)
- **Active**: Inactive accounts are hidden from the TB grid but preserved in history

## Creating Accounts Manually
1. Go to **Setup > Chart of Accounts**
2. Click **New Account**
3. Fill in all required fields
4. Save — the account appears in the TB grid immediately

## Editing Accounts
Click the edit icon on any account row. You can change the name, category, normal balance, and active status. Account numbers cannot be changed if the account has any TB balances or journal entries.

## Deactivating vs. Deleting Accounts
- **Deactivate** (uncheck Active): Hides the account from the TB grid but preserves all historical data. Use this for accounts that are no longer needed but have prior-period history.
- **Delete**: Only allowed if the account has no TB balances, no journal entries, and no bank transactions. Permanently removes the account.

## Importing from CSV
The CSV import uses AI to automatically map your columns:

1. Click **Import from CSV**
2. Upload your CSV file
3. The AI maps columns automatically (account_number, account_name, category, normal_balance, and optional tax_code columns)
4. Review the column mapping — adjust any columns the AI got wrong
5. Review the preview of accounts that will be created
6. Click **Confirm Import**

**CSV format tips:**
- Column headers don't need to match exactly — the AI handles variations like "Acct #", "Account No.", "GL Code"
- Category values can be "Asset", "Assets", "A" — the AI normalizes these
- Normal balance can be "Debit", "Dr", "D", "Credit", "Cr", "C"
- Include a `tax_code` column if you want tax codes imported with the accounts

## Copying from Another Client
1. Click **Copy from Client**
2. Select the source client
3. All active accounts from that client are copied to the current client (including tax code assignments)
4. Existing accounts are not overwritten — only new accounts are added

This is useful when a new client has a similar business to an existing client.

## Applying a COA Template
For standard industry account sets, use **Admin > COA Templates** to apply a pre-built template. See the COA Templates knowledge article for details.

## Account Search and Filtering
Use the search box to filter accounts by name or number. Use the category filter dropdown to show only a specific category.

## The Account Dropdown in Other Pages
Throughout the app (TB grid, Journal Entries, Bank Transactions), accounts are selected from a searchable dropdown. Type any part of the account name or number to find it. The dropdown shows the account number, name, and category.

## Activity Type Impact
The client's **Activity Type** (business, rental, farm, farm_rental) affects which tax codes are suggested during auto-assignment. Ensure the correct activity type is set on the client record before running AI tax mapping. Edit the client at **Setup > Clients**.
