# Transaction Entry Register

## Overview
The Transaction Entry Register is a spreadsheet-style data entry screen for manually creating bank transactions in bulk. It's designed for entering transactions from statements, checks, or other sources that don't have OFX/CSV files.

Access: **Bookkeeping > Transaction Entry**

This is distinct from the Bank Transactions import workflow — use Transaction Entry when you want to type in transactions one by one or in a batch, rather than uploading a file.

## The Register Grid
Each row represents one transaction with these fields:
- **Account** (first column): The source bank/cash account the money moved through. New rows carry forward the account from the row above, or use the client's **Default account** (see below)
- **Date**: Transaction date (defaults to today)
- **Ref**: Optional reference number (check number, wire ID, etc.)
- **Payee**: The payee or payer name
- **Category**: The COA account to assign the transaction to (the offset to the source account)
- **Amount**: Dollar amount; positive = debit, negative = credit (use parentheses or minus sign for credits)

Unsaved rows are highlighted with a light blue tint so you can see which entries haven't been posted yet.

## Default Account
Use the **Default account** dropdown in the page header to choose the source account that new rows should start with (typically the client's main operating/checking account). The choice is saved per client, so it persists across sessions and devices. Pick "— none —" to clear it. Rows that already have an account are not changed.

## Smart Payee Dropdown
As you type in the Payee field, the system searches for previously-used payees for this client:
- The dropdown shows known payees with their **most-used category**
- Selecting a payee from the dropdown pre-fills the Account field with its most common category
- This saves time for recurring transactions (utilities, rent, payroll, etc.)
- If the payee is new, just type the name and select the account manually

## Smart Category Selection
The Account dropdown for each row shows a **Previously Used** section at the top with accounts you've recently assigned to this payee. Below that is the full chart of accounts. This makes re-entering monthly recurring transactions fast.

## Import a Scanned Sheet (AI)
Clients often hand in a handwritten sheet listing what they spent and deposited. Click **Import scanned sheet…** in the page header, drop the scanned PDF (up to 10 pages), set the **sheet date** (used for every line unless a date is written on the line) and the bank account, and click **Read sheet**. After the AI data-use notice, the AI reads each page — description, amount, and whether each line is money in or out — and shows a review screen with the scanned page on the left and the extracted rows on the right:
- Rows are colour-coded by confidence; **amber cells** are values the AI was unsure about (illegible digits, unclear in/out) — click any cell to correct it, or click the in/out badge to flip it
- The **Payee** box is free text, pre-filled with exactly what was written on the sheet; type to change it — known payees are suggested as you type but never substituted for the client's wording
- Categories are pre-filled from a matching payee's rule / most-used account, and the **AI suggests a category** for every remaining row (badge "AI 86%"; amber when it's unsure). Use "AI: fill missing categories" / "re-suggest all" in the toolbar to run it again; anything you set by hand is never overwritten
- Untick rows you don't want; use "Apply to all rows" to reset dates to the sheet date
- **Add N rows to register** places them in the register as **unsaved** rows — nothing is posted until you press **Save**, so you get the normal validation, rule learning, and journal entries

Requirements: a vision-capable AI provider (Claude, OpenAI, an Ollama vision model, or the Vibe AI Router) and, for scanned PDFs, poppler-utils on the server (included in the Docker image). If OCR pre-processing is configured under Settings, it can be ticked as an alternative for scans the vision model struggles with.

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
