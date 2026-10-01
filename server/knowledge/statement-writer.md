# Statement Writer

## Overview
The Statement Writer produces report-ready financial statements — the set you hand to a client or a bank: a cover page, a table of contents, the accountant's report, the balance sheet, income statement, statement of changes in equity, statement of cash flows, and supplementary schedules. Access: **Reports > Statement Writer**

It is separate from **Reports > Financial Statements**, which is the fixed-layout working view of the same balances. Use Financial Statements to look at the numbers; use the Statement Writer to issue them.

## What It Is Built On
Statements are built on the client's **lead sheets** (Trial Balance > Lead Sheets). The built-in layout puts lead sheets A–O where they belong: A Cash, B Accounts Receivable, C Inventory, D Fixed Assets, E Other Assets, F Accounts Payable, G Accrued Liabilities, H Debt, I Other Liabilities, J Equity, K Revenue, L Cost of Goods Sold, M Operating Expenses, N Other Income, O Other Expenses.

Before you start, set up the client's lead sheets and assign every account that has a balance. An account with a balance and no lead sheet shows as an issue ("not on any lead sheet") and the balance sheet will not balance until it is placed.

## Creating a Statement Set
1. Select the client and the period in the sidebar. The period must have a start date and an end date (Setup > Periods) — the statements are headed by them.
2. Go to **Reports > Statement Writer** and click **New statements**.
3. Choose:
   - **Reporting basis** — GAAP or Cash basis (both use the book-adjusted balances; the choice sets the titles and the accountant's report wording), or Income tax basis (uses the tax-adjusted balances).
   - **Entity** — sets the equity wording (Stockholders' Equity, Partners' Capital, Member's Equity, Owner's Equity). It defaults from the client's entity type; choose LLC by hand.
   - **Columns** — this period alone, or this period beside the prior year. The prior year comes from the period's prior-year balances. Optional: % of revenue, $ change, % change.
   - **Layout** — the built-in layout, a layout this client already has, or one of the firm's templates.
   - **Style** — the firm default or another saved style.
4. Click **Create**. The editor opens.

A statement set belongs to one period. The layout and style belong to the client and are shared by all of the client's statement sets, in every year.

## The Editor
The left side has five tabs; the right side is a live preview that updates as you type.

- **Statements** — turn each statement on or off, reorder them, override a title, set paper and orientation per statement. For the balance sheet and income statement, the outline below lists every line:
  - Drag a line to reorder it; drag onto the middle of a section to move it inside.
  - Add a section, a lead sheet line, an account line, a total, text, a blank line or a page break.
  - Click a line to edit it. A lead sheet line can show as one summary line, as detail (every account on the statement), or as a summary line with a supporting schedule.
  - In a schedule you can reorder accounts, combine several into one captioned line, split them again, or pull one account out onto the statement as its own line.
  - A total adds up other lines with + and −.
- **Style** — typeface (eight bundled fonts), sizes, bold/italic/caps per element, whole dollars or cents, dollar signs, how negatives and zeros print, margins, footer text and page numbers.
- **Report** — cover page, table of contents, and the accountant's report: pick a letter from the firm library, set the report date, and optionally customize the wording for this engagement.
- **Classify** — how each balance sheet account flows into the statement of cash flows, and which equity accounts are retained earnings, contributions and distributions.
- **Checks** — everything that does not tie. Click a check to jump to the line.

**Live** shows the statements as pages. **Exact PDF** renders the real PDF, so page breaks and page numbers are exactly what will print.

## Whole-Dollar Rounding
In whole dollars, each line is rounded and the difference is placed on one line so that every total still foots and the statements agree with each other: total assets equals total liabilities and equity, net income is the same on the income statement, the equity statement and the cash flow statement, and ending cash equals the balance sheet. By default the rounding goes to the largest line that is not cash; you can choose the line on any checked total ("Rounding goes to").

## Checks You May See
- **The balance sheet is out of balance** — the trial balance itself does not balance, or an account with a balance is not on any lead sheet.
- **An account is not on any lead sheet** — assign it on the Lead Sheets page.
- **A line is not linked to a lead sheet** — the layout names a lead sheet letter this client does not have. Link it to one of the client's lead sheets in the editor, or delete the line.
- **Net income differs from the trial balance** — a revenue or expense lead sheet is missing from the income statement or counted twice.
- **Cash flows do not reconcile** — an account is classified "Excluded" on the Classify tab.
- **The equity and cash flow statements show this period only** — with prior-year columns, those two statements also need the prior year's opening balances, which exist only when the period before it is in the app. The balance sheet and income statement still show both years.
- **The prior-year column shows book balances** (income tax basis) — the prior period is not in the app, so its tax adjustments are unknown.

## Finalizing
Click **Finalize** to issue the statements. Finalizing freezes a **version**: the numbers, the layout, the style, the letter and the PDF. A final statement set is locked.

- If there are errors, finalizing is blocked. You can fix them, or finalize anyway with a written reason, which is recorded on the version and in the audit log.
- **Reopen** makes the set a draft again. Finalizing again creates version 2; version 1 is kept as superseded.
- **Versions** lists every version with PDF, Word and Excel downloads, and **Save to client folder**, which files the PDF in the client's linked document folder.
- If balances change after finalizing, the set is marked **Balances changed**. The editor then tells you whether the issued numbers would actually differ now, or whether the change did not affect them.
- Finalizing does not require the period to be locked, but locking it first is what keeps the issued statements from going stale.

## Downloads
- **PDF** — the complete set. A draft PDF carries a DRAFT watermark.
- **Word (.docx)** — editable, with the same page setup and column widths.
- **Excel (.xlsx)** — one sheet per statement, with live formulas for subtotals and totals.

Files are named `<period>_<client>_financial-statements-…`.

## Rolling Forward
On the Statement Writer list, **Roll forward** starts a new draft of a statement set in another of the client's periods, on the same layout, basis and columns. The report date and any wording customized for the old year are not carried.

## Statement Library (Admin)
**Admin > Statement Library** holds what every statement set draws on. Everyone can view it; administrators edit it.

- **Letterhead** — firm name, address, signature line and logo (PNG or JPEG, up to 700 KB), with alignment and logo size including an edge-to-edge banner.
- **Accountant's reports** — the letters. Two are provided: Accountant's Compilation Report (AR-C 80) and Preparation of Financial Statements (AR-C 70). Wording uses variables such as `{{client_name}}`, `{{period_description}}`, `{{basis_of_accounting}}` and `{{financial_statement_titles}}`, filled in for each statement set.
- **Styles** — Classic Serif and Modern Sans are built in; save your own and choose the firm default.
- **Layout templates** — a client's layout saved for reuse with other clients ("Save this layout as a firm template" in the editor). A template keeps the outline and its lead sheet letters, never a client's own accounts.

## PDF Engine (Admin)
PDFs are printed by the Chromium browser installed on the server, so the PDF matches the preview. **Tools > Settings > PDF engine** shows whether it was found and lets an administrator set its path or run a test.

If Chromium is not installed, the editor, the live preview and the Word and Excel downloads still work; PDF download, the Exact PDF view and Finalize report that the PDF engine is unavailable. The official Docker image includes Chromium. On a Raspberry Pi or other Debian server: `sudo apt install chromium`.

## Backups
Client and period backups include the layouts, statement sets and finalized versions. The issued PDF files themselves are not in a backup; after a restore, a version's PDF is produced again from the frozen version the first time it is downloaded, and is marked as regenerated. Settings and full backups include the Statement Library.

## What It Does Not Do
- Month, quarter, year-to-date or side-by-side columns — a statement set covers one period, optionally beside its prior year.
- Notes to the financial statements.
- A review report (AR-C 90).
- Budget columns.
