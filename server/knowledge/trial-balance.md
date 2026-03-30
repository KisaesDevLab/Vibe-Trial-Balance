# Trial Balance

## TB Grid Overview
The Trial Balance grid is the main data entry screen. It shows all active accounts with configurable columns:
- Account number and name
- Prior Year Debit / Credit (toggle with **PY** checkbox)
- Unadjusted Debit / Credit (raw imported balances — editable)
- Transaction JE Debit / Credit (auto-hidden when no transaction entries exist)
- Book AJE Debit / Credit (book adjustments from journal entries)
- Book-Adjusted balance (computed, never stored)
- Tax AJE Debit / Credit (toggle with **Tax** checkbox)
- Tax-Adjusted balance (computed)
- Workpaper Reference, Notes, and Tickmarks columns

Adjusted balances are **always computed** from the view `v_adjusted_trial_balance` — they are never stored directly.

## Column Toggles
The toolbar has three column toggles:
- **Single** — switches between Dr/Cr column pairs and single net-balance columns
- **PY** — shows/hides Prior Year columns
- **Tax** — shows/hides Tax Adjustment and Tax Adjusted columns
- **Trans JE** columns auto-hide when the period has no transaction journal entries

The **Excel export** automatically mirrors whichever columns are currently visible — hidden columns are excluded from the export.

## Inline Editing
- Click any unadjusted debit or credit cell to edit it
- Type the amount in dollars (e.g., `12345.67`) — supports math expressions (e.g., `100+50`)
- All amounts are stored as BIGINT cents internally
- Press **Enter** or **Tab** to confirm and move to the next cell
- The **Tax Code** column is read-only on the TB grid — assign tax codes via the Tax Mapping page

## Keyboard Navigation
- **Enter**: confirm edit and move down
- **Tab**: confirm edit and move right
- **Arrow keys**: navigate between cells
- **Escape**: cancel edit
- **F2** or start typing: enter edit mode on the selected cell

## Period Locking
- A locked period prevents all edits to the TB, journal entries, bank transactions, and PY data
- Only **admins** can unlock a period
- To lock: go to **Setup > Periods**, click the lock icon
- The system checks that the TB is balanced before allowing a lock
- Locking and unlocking trigger audit log entries

## File Import
1. Click **Import File** on the Trial Balance page
2. Upload a CSV, Excel (.xlsx/.xls), or text file
3. The AI automatically maps columns (a consent popup shows what data is sent to AI)
4. Review the mapping, then confirm to import
5. Existing balances are overwritten for matched accounts
6. The **Account Name** column can optionally be mapped — imported names are stored as import aliases on the COA for future matching
7. Click **Import from PDF** for scanned or digital PDF trial balance documents

## Prior Year Import
- Click **Import PY** to import prior year balances from a CSV
- Map columns for Account Number, optional Account Name, Debit, and Credit
- PY balances appear in the PY columns when the PY toggle is on

## Pop-Out Window
- Click the **pop-out icon** (external link arrow) in the toolbar to open the trial balance in a separate browser window
- The pop-out shows the same column toggles (Single, PY, Tax) and a font size control
- It auto-refreshes when the window regains focus, picking up edits from the main window
- Font size is independent from the main app — useful when displaying on a different-sized monitor

## New Journal Entry
- Click **New JE** on the TB toolbar to create a journal entry directly
- Select Book AJE or Tax AJE type, enter date, description, and debit/credit lines
- Each line has an account dropdown with search — click **+ New Account** at the bottom to create a new COA account without leaving the dialog
- The TB grid refreshes automatically after saving

## Viewing & Editing Journal Entries
- Click any AJE amount cell on the TB grid to see journal entries for that account
- Click any entry to open an edit dialog for dates, descriptions, and line amounts
- Transaction-type entries sync edits to the linked bank transaction

## Initialize / Sync with COA
- Click **Initialize from COA** to create TB rows for all active COA accounts
- Click **Sync with COA** to add rows for new accounts and remove zero-balance inactive ones
