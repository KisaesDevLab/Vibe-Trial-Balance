# Tax Worksheets

## Overview
The Tax Worksheets section provides tools for book-to-tax reconciliation work. Access: **Tax > Tax Worksheets**

## M-1 Adjustments Worksheet
The M-1 Worksheet documents the differences between book income and taxable income (Schedule M-1 on Form 1120/1120S/1065).

Tax AJEs posted in Journal Entries automatically populate the M-1 reconciliation. The M-1 Worksheet lets you add supplemental explanations and categorize each adjustment.

### Viewing M-1 Adjustments
1. Select the client and period
2. Go to **Tax > Tax Worksheets**
3. The M-1 section lists all tax AJEs with their amounts and categories

### Adding Manual M-1 Entries
1. Click **New Adjustment**
2. Enter:
   - **Description**: What the adjustment represents (e.g., "Meals & Entertainment (50% disallowance)")
   - **Category**: Select from standard M-1 categories:
     - Income on books not on return
     - Expenses on return not on books
     - Income on return not on books
     - Deductions on books not on return
   - **Amount**: Dollar amount of the book-to-tax difference (positive or negative)
3. Save

### Validation
The worksheet validates that amounts are reasonable numbers and that required fields are complete. Amounts must be in whole dollars (no fractional cents).

### Excel Export
Click **Export to Excel** to download the M-1 worksheet as an Excel file (.xlsx). The export includes:
- All M-1 adjustments with descriptions, categories, and amounts
- Book income and taxable income totals
- The reconciliation calculation

The Excel file is suitable for attaching to the workpaper package or including in the tax return file.

## Tax Basis Schedule
The Tax Basis Schedule is available as part of the Tax Worksheets page. It shows each account's tax-adjusted balance, derived from the book-adjusted balance plus all tax AJEs.

This is the same data shown on the **Tax > Tax Return Order** report but presented as a worksheet-style grid suitable for workpapers.

## Relationship to Journal Entries
Tax worksheets are closely tied to journal entries:
- **Book AJEs** affect the book-adjusted trial balance and appear in financial statements
- **Tax AJEs** affect the tax-adjusted trial balance and feed the M-1 worksheet
- Both types are entered at **Bookkeeping > Journal Entries**

For a clean M-1 worksheet, post all book-to-tax differences as Tax AJEs rather than adding them as manual M-1 entries — the system will then generate the M-1 schedule automatically from the journal entry data.
