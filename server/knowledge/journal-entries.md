# Journal Entries

## Entry Types
There are three types of journal entries:
- **Book AJEs** (`entry_type = 'book'`): Adjusting journal entries that affect the book-adjusted trial balance. Used for GAAP or accrual adjustments.
- **Tax AJEs** (`entry_type = 'tax'`): Tax-only adjusting entries for M-1 differences. These affect the tax-adjusted balances but not book balances.
- **Trans JEs** (`entry_type = 'trans'`): Reclassification or transactional entries.

## Creating a Journal Entry
1. Go to **Trial Balance > AJE Listing** or **Bookkeeping > Journal Entries**
2. Click **New Entry**
3. Select entry type (Book/Tax/Trans)
4. Enter a description, date, and workpaper reference
5. Add line items: select account, enter debit or credit amount
6. The system validates that debits equal credits before saving
7. If the entry doesn't balance, you'll see an error showing the out-of-balance amount

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
