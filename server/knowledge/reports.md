# Reports

## Available PDF Reports
All standard reports use server-side pdfmake for professional PDFs with the **company name** as the primary header (not the accounting firm name). Each report page has **Download PDF** and **Preview PDF** buttons.

**Preview** opens the PDF in a new browser tab. **Download** saves it directly to your computer.

---

### Trial Balance Report
- Lists all accounts with configurable column groups: Prior Year, Unadjusted, Book AJE, Book Adjusted, Tax AJE, Tax Adjusted, and CY vs PY variance
- Use the **column checkboxes** at the top to show/hide column groups — the selection applies to the on-screen view, Excel export, and PDF download
- Includes workpaper references (WP Ref) and tickmark superscripts
- Tickmark legend appears at the bottom of the report
- Inline variance notes are editable directly on the report page
- Access: **Trial Balance > Trial Balance** (then use Export Excel or PDF buttons)

---

### Financial Statements
Three statements on tabbed pages: **Income Statement**, **Balance Sheet**, and **Statement of Equity**. All PDFs render in **portrait** orientation.

- **Income Statement**: Revenue shows as positive (credit balance), expenses as positive (debit balance), Net Income = Revenue − Expenses. Traditional presentation with subtotals and double-line totals.
- **Balance Sheet**: Assets positive (debit balance), Liabilities and Equity positive (credit balance). Includes a Net Income line in the Equity section. Shows A = L + E balance check.
- **Statement of Equity**: Opening equity, net income activity, and closing equity with comparative columns.
- All statements show Current Year, Prior Year, $ Change, and % Variance columns
- Select the balance basis: Unadjusted, Book Adjusted, or Tax Adjusted
- Subtotal and total rows have **double underlines** on all value columns
- Access: **Reports > Financial Statements**

---

### Cash Flow Statement
- Indirect method cash flow statement
- Organized into Operating, Investing, and Financing activities
- Account mapping configuration determines which accounts appear in which section
- Access: **Reports > Cash Flow**

---

### General Ledger
- Full transaction-level detail for all accounts in the period
- Click any journal entry row to open an edit dialog
- Filter by entry type (All, Book AJE, Tax AJE, Trans)
- Access: **Reports > General Ledger**

---

### Tax Code Report
- Groups all accounts by their assigned tax code with **tax code description** in each group header
- Shows each account's balance using consistent sign convention (dr − cr)
- Category subtotals and grand total
- **Portrait** PDF orientation
- Access: **Tax > Tax Code Report**

---

### Tax-Basis P&L
- Income and expense accounts grouped by tax code, in sort order
- Per-code subtotals with a net income row at the bottom
- Portrait PDF orientation
- Access: **Tax > Tax-Basis P&L**

---

### Tax Return Order
- All accounts listed in tax return filing order (by sort_order on tax codes)
- Filter by category
- Access: **Tax > Tax Return Order**

---

### AJE Listing
- All adjusting journal entries for the period
- Filter by entry type: all, book, or tax
- **Bookkeeper Letter** buttons: Preview and Download PDF for the professional letter summarizing proposed book AJEs
- Access: **Trial Balance > AJE Listing**

---

### Workpaper Index
- Groups all accounts by **workpaper reference** (WP Ref) with section headers and subtotals
- Columns: Account #, Name, Category, Tax Line, Book Adj, Tax Adj, **Tickmarks**, **Preparer Notes**, **Reviewer Notes**
- All groups share consistent column widths in a single table layout
- **Page per group** toggle: when checked, each WP ref group starts on a new page in PDF and a new worksheet tab in Excel; when unchecked, all groups flow continuously
- **Tickmark legend** at the bottom shows all tickmarks used in the report
- Unassigned accounts (no WP Ref) appear in a separate group at the end
- Access: **Reports > Workpaper Index**

---

### Workpaper Package
- Bundles multiple reports into either individual PDF downloads or a **single merged PDF**
- Select which reports to include from a checklist (10 available reports)
- **Download Individual PDFs**: downloads each selected report as a separate file
- **Merge into Single PDF**: generates one combined PDF with all selected reports concatenated, suitable for client delivery or archiving
- Access: **Reports > Workpaper Package**

---

### Period Comparison (Flux Analysis)
- Compares two periods side by side with $ variance and % variance columns
- Accounts exceeding the significance threshold are highlighted
- Inline variance notes explain why balances changed
- Access: **Reports > Period Comparison**

---

### Custom Reports
- User-defined report layouts with custom account selection, column choices, and groupings
- **Print / PDF** button opens a clean print window with just the report table (no app chrome)
- Access: **Reports > Custom Reports**
