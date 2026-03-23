# Transaction Entry Register

## Overview
The Transaction Entry Register is a spreadsheet-style data entry screen for manually creating bank transactions in bulk. It's designed for entering transactions from statements, checks, or other sources that don't have OFX/CSV files.

Access: **Bookkeeping > Transaction Entry**

This is distinct from the Bank Transactions import workflow — use Transaction Entry when you want to type in transactions one by one or in a batch, rather than uploading a file.

## The Register Grid
Each row represents one transaction with these fields:
- **Date**: Transaction date (defaults to today)
- **Ref**: Optional reference number (check number, wire ID, etc.)
- **Payee**: The payee or payer name
- **Account**: The COA account to assign the transaction to
- **Amount**: Dollar amount; positive = debit, negative = credit (use parentheses or minus sign for credits)

Unsaved rows are highlighted with a light blue tint so you can see which entries haven't been posted yet.

## Smart Payee Dropdown
As you type in the Payee field, the system searches for previously-used payees for this client:
- The dropdown shows known payees with their **most-used category**
- Selecting a payee from the dropdown pre-fills the Account field with its most common category
- This saves time for recurring transactions (utilities, rent, payroll, etc.)
- If the payee is new, just type the name and select the account manually

## Smart Category Selection
The Account dropdown for each row shows a **Previously Used** section at the top with accounts you've recently assigned to this payee. Below that is the full chart of accounts. This makes re-entering monthly recurring transactions fast.

## Adding and Managing Rows
- The grid starts with 5 blank rows
- Click **+ Add Row** to add more rows
- Click **Duplicate** (copy icon) on any row to copy its date, payee, and account to a new row below — useful for similar transactions
- Click **Delete** (trash icon) to remove a row
- Navigate between cells with Tab/Enter

## Stat Cards
Three summary cards at the top update as you enter data:
- **Debits**: total of all positive amounts
- **Credits**: total of all negative amounts (shown as a positive number)
- **Net**: Debits minus Credits

Use the Net card to verify your entries match the expected total before posting.

## Posting Transactions
When your rows are ready:
1. Review the stat cards to confirm totals
2. Click **Post Transactions**
3. The system validates each row (date, payee, account, and amount are all required)
4. Valid rows are saved as bank transactions with status "confirmed"
5. A classification rule is automatically created or updated for each payee-account pair, so future imports classify the same payee automatically
6. Posted rows are marked with a checkmark and the tint is removed

## After Posting
Posted transactions appear on the **Bank Transactions** page where you can view them, reclassify if needed, or delete them. They are included in all reports that use bank transaction data.

## When to Use Transaction Entry vs. Bank Transactions Import
| Scenario | Recommended |
|---|---|
| Have an OFX or CSV file from the bank | Bank Transactions > Import |
| Entering from a paper statement | Transaction Entry |
| Entering a few one-off adjustments | Transaction Entry |
| Entering 50+ transactions at once | Bank Transactions > Import (CSV) |
| Re-entering from a prior system | Transaction Entry (small) or CSV Import (large) |
