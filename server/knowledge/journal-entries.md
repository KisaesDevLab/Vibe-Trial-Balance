# Journal Entries

## Entry Types
There are three types of journal entries:
- **Book AJEs** (`entry_type = 'book'`): Adjusting journal entries that affect the book-adjusted trial balance. Used for GAAP or accrual adjustments.
- **Tax AJEs** (`entry_type = 'tax'`): Tax-only adjusting entries for M-1 differences. These affect the tax-adjusted balances but not book balances.
- **Trans JEs** (`entry_type = 'trans'`): Reclassification or transactional entries.

## Creating a Journal Entry
You can create journal entries from multiple places:
1. **Trial Balance > AJE Listing** or **Bookkeeping > Journal Entries** — click **New Entry**
2. **Trial Balance grid** — click the **New JE** button in the toolbar
3. Select entry type (Book AJE or Tax AJE)
4. Enter a description, date, and debit/credit line items with account search
5. The system validates that debits equal credits before saving
6. If the entry doesn't balance, you'll see an error showing the out-of-balance amount
7. When a JE is created, the system automatically ensures trial balance rows exist for all referenced accounts

## Editing Journal Entries
- From the **General Ledger** view: click any JE row to open the edit dialog
- From the **Trial Balance** grid: click an AJE amount cell to see the JE list, then click any entry to edit
- For **transaction-type entries** (linked to bank transactions): editing the date, description, or amounts automatically syncs changes to the linked bank transaction
- The edit dialog supports adding/removing lines, changing accounts, and deleting the entry

## Balance Validation
- Every journal entry must balance (total debits = total credits)
- The system enforces this on save and prevents saving unbalanced entries
- The TB grid shows the combined effect of all posted journal entries in the AJE columns

## Journal Entry Listing
- Go to **Trial Balance > AJE Listing** for a printable list of all journal entries
- Filter by entry type: **All Entries**, **Book** (AJEs), **Tax** (AJEs), or **Transactions** (Trans JEs)
- The summary line shows counts: e.g., "12 entries — 5 book, 4 tax, 3 trans"
- Download as PDF using the **Download PDF** button
- Each entry shows: JE number, date, description, WP ref, account, debit, credit
- Entry type badges are color-coded: Book (blue), Tax (amber), Transaction (teal)

## M-1 Worksheet
- Tax AJEs automatically populate the **M-1 Worksheet** under **Tax > Tax Worksheets**
- The M-1 shows book-to-tax differences with line-item detail
