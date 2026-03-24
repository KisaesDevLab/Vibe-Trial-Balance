# Trial Balance

## TB Grid Overview
The Trial Balance grid is the main data entry screen. It shows all active accounts with:
- Account number and name
- Unadjusted Debit / Credit (raw imported balances)
- Book AJE Debit / Credit (book adjustments from journal entries)
- Tax AJE Debit / Credit (tax adjustments from journal entries)
- Book-Adjusted balance (computed, never stored)
- Prior Year Debit / Credit (for comparison)

Adjusted balances are **always computed** from the view `v_adjusted_trial_balance` — they are never stored directly.

## Inline Editing
- Click any unadjusted debit or credit cell to edit it
- Type the amount in dollars (e.g., `12345.67`)
- All amounts are stored as BIGINT cents internally
- Press **Enter** or **Tab** to confirm and move to the next cell
- The **Tax Code** column is read-only on the TB grid — tax codes must be assigned via the Tax Mapping page to ensure proper dual-write (tax_code_id + tax_line)

## Keyboard Navigation
- **Enter**: confirm edit and move down
- **Tab**: confirm edit and move right
- **Arrow keys**: navigate between cells
- **Escape**: cancel edit

## Period Locking
- A locked period prevents all edits to the TB, journal entries, and bank transactions
- Only **admins** can unlock a period
- To lock: go to **Setup > Periods**, click the lock icon for the period
- The system checks that the TB is balanced before allowing a lock
- Locking triggers an audit log entry

## File Import
1. Click **Import File** on the Trial Balance page
2. Upload a CSV, Excel (.xlsx/.xls), or text file with at minimum: account number column and one or more balance columns
3. The AI automatically maps your columns to the correct fields (a data disclosure popup shows what data will be sent to AI before processing)
4. Review the mapping, then confirm to import
5. Existing balances are overwritten for matched accounts
6. Click **Import from PDF** for scanned or digital PDF trial balance documents

## New Journal Entry
- Click **New JE** on the Trial Balance toolbar to create a journal entry directly from the TB view
- Select Book AJE or Tax AJE type, enter date, description, and debit/credit lines
- The TB grid refreshes automatically after saving

## Viewing & Editing Journal Entries
- Click any AJE amount cell on the TB grid to see the list of journal entries for that account and type
- Click any entry in the list to open an edit dialog where you can modify the date, description, and line amounts
- For transaction-type entries, changes automatically sync to the linked bank transaction

## Prior Year Columns
- Import prior year balances with **Import PY**
- PY columns appear alongside current year for comparison
- PY balances are used in flux analysis and financial statement comparatives
