# Reports

## Available PDF Reports
All standard reports use server-side pdfmake for professional, branded PDFs with a consistent header and footer. Each report page has **Download PDF** and **Preview PDF** buttons.

**Preview** opens the PDF in a new browser tab. **Download** saves it directly to your computer.

---

### Trial Balance Report
- Lists all accounts with unadjusted, book-adjusted, and tax-adjusted balance columns
- Includes workpaper references (WP Ref) and tickmark superscripts
- Tickmark legend appears at the bottom of the report
- Inline variance notes are editable directly on the report page
- Access: **Reports > TB Report**

---

### Financial Statements
Three statements on one page: Income Statement, Balance Sheet, and Statement of Equity.
- Current year and prior year comparative columns with a change column
- The prior year column comes from the prior year balances imported via **Import PY**
- Access: **Reports > Financial Statements**

---

### Cash Flow Statement
- Indirect method cash flow statement
- Organized into Operating, Investing, and Financing activities
- Account mapping configuration determines which accounts appear in which section — if accounts are missing from the statement, check the cash flow account mapping
- Access: **Reports > Cash Flow**

---

### General Ledger
- Full transaction-level detail for all accounts in the period
- Shows every bank transaction and journal entry line that hit each account
- Filter by a specific account using the account dropdown at the top
- Access: **Reports > General Ledger**

---

### Tax Code Report
- Groups all accounts by their assigned tax code
- Shows each account's tax-adjusted balance under its tax code grouping
- Useful for reviewing the completeness of tax code assignments before exporting
- Unmapped accounts appear in a separate section at the bottom
- Access: **Reports > Tax Code Report**

---

### Tax-Basis P&L
- Income and expense accounts grouped by tax code, in sort order
- Per-code subtotals with a net income row at the bottom
- Represents the taxable income/loss from operations
- Access: **Tax > Tax-Basis P&L**

---

### Tax Return Order
- All accounts listed in tax return filing order (by sort_order on tax codes)
- Filter by category to focus on income, expense, asset, liability, or equity accounts
- Access: **Tax > Tax Return Order**

---

### AJE Listing
- All adjusting journal entries for the period
- Filter by entry type: all, book, or tax
- Access: **Trial Balance > AJE Listing**

---

### Workpaper Index
- Summary index of all accounts that have a workpaper reference (WP Ref) assigned
- Sorted by WP Ref, showing account name and book-adjusted balance
- Serves as the table of contents for the engagement workpaper file
- Accounts without WP Refs do not appear — assign WP Refs in the TB grid
- Access: **Reports > Workpaper Index**

---

### Workpaper Package
- Bundles multiple reports into a single, downloadable PDF
- Select which reports to include from a checklist (TB Report, Financial Statements, AJE Listing, etc.)
- Suitable for client delivery, engagement file archiving, or sending to a reviewer
- Access: **Reports > Workpaper Package**

---

### Period Comparison (Flux Analysis)
- Compares two periods side by side with $ variance and % variance columns
- Accounts exceeding the significance threshold are highlighted
- Inline variance notes explain why balances changed
- **Download Flux PDF** generates a professional variance report with notes included
- Access: **Reports > Period Comparison**

---

### Custom Reports
- User-defined report layouts with custom account selection, column choices, and groupings
- Created and managed at **Reports > Custom Reports**
- See the Custom Reports knowledge article for details

---

## Export to Tax Software
For exporting final account balances to UltraTax, CCH, Lacerte, GoSystem, or Generic CSV/Excel, go to **Reports > Exports**. See the Exports knowledge article.
