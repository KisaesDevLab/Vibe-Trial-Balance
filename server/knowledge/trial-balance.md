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

## CSV Import
1. Click **Import TB** on the Trial Balance page
2. Upload a CSV file with at minimum: account number column and one or more balance columns
3. The AI automatically maps your CSV columns to the correct fields
4. Review the mapping, then confirm to import
5. Existing balances are overwritten for matched accounts

## Prior Year Columns
- Import prior year balances with **Import PY**
- PY columns appear alongside current year for comparison
- PY balances are used in flux analysis and financial statement comparatives
