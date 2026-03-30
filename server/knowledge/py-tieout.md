# Prior Year Tie-Out

## Overview
The PY Tie-Out utility compares the prior year balances rolled forward in the current period against the bookkeeper's actual final prior year trial balance. This identifies variances that need correcting adjusting journal entries to true up opening balances.

Access: **Trial Balance > PY Tie-Out**

## When to Use
After rolling forward a period, the PY balances come from the previous period's adjusted balances. If the bookkeeper made changes after the CPA's work was done, or the CPA worked from preliminary numbers, the rolled PY won't match the bookkeeper's final numbers. The PY Tie-Out helps find and fix these differences.

## Importing the Bookkeeper's Final TB

### Import from File (CSV/Excel)
1. Click **Import from File** on the PY Tie-Out page
2. Accept the AI data disclosure consent
3. Upload a CSV or Excel file containing the bookkeeper's final trial balance
4. The AI automatically maps columns and matches accounts to your chart of accounts
5. For unmatched accounts, use the dropdown to map them to existing COA accounts, or click **+ New Account** to create a new account on the fly
6. The import must balance (total debits = total credits) — unbalanced imports are rejected
7. Click **Confirm Import** to save

### Import from PDF
1. Click **Import from PDF** — same consent dialog
2. Upload a PDF trial balance (text-based or scanned)
3. AI extracts the line items and matches accounts
4. Review and confirm same as CSV import

### Manual Entry
1. Click **Manual Entry** to open a grid of all COA accounts
2. Enter a single balance per account (positive = debit, negative = credit)
3. Supports paste from Excel — copy a column of numbers and paste into the balance column
4. Tab navigates through cells
5. Save requires balanced data

## Comparison View
After importing, the comparison view shows:
- **All accounts** from the current period's trial balance (not just imported ones)
- **Rolled PY** column — the prior year balances stored on the trial balance
- **Uploaded PY** column — the imported bookkeeper's balances
- **Variance** column — the difference
- **Status badges** — green "OK" for matches, amber "DIFF" for variances
- **Category subtotals** and **grand totals** in a sticky footer
- **All/Variances** toggle to filter the view
- **Search** to find specific accounts

## Creating an Adjusting Entry
1. Check the boxes next to the variance accounts you want to correct
2. The AJE panel appears at the bottom
3. Select **Book AJE** or **Tax AJE**
4. Choose an **offset account** (equity accounts listed first)
5. Review the preview table showing the debit/credit lines and offset
6. Click **Create AJE** — the entry is saved and appears in Journal Entries

## Replace and Clear
- Use **Replace (File)** or **Replace (PDF)** to import new PY data (replaces previous)
- **Clear** removes all PY comparison data but does NOT delete any AJEs previously created
- Deleting the period cascades and removes the PY comparison data automatically
