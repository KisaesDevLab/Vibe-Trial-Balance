# Exports

## Supported Software Exports
The app can export tax data formatted for major tax preparation software:
- **UltraTax CS** (Thomson Reuters)
- **CCH Axcess / ProSystem fx**
- **Lacerte** (Intuit)
- **GoSystem Tax RS** (Thomson Reuters)
- **Generic CSV/Excel** (universal format)

## How to Export
1. Select your client and period in the sidebar
2. Go to **Reports > Exports**
3. Choose the target software from the dropdown
4. Choose format (CSV or Excel where available)
5. Click **Export** to download the file

## Pre-Export Validation
Before generating an export, the system checks:
1. **Unmapped accounts**: All accounts must have a tax code assigned. Unmapped accounts are listed — you can assign codes without leaving the page using the quick-assign panel, or navigate to Tax Mapping.
2. **TB out of balance**: The book-adjusted trial balance must balance (total debits = total credits). If out of balance, an admin override is required to proceed.

## Admin Override
If the TB is out of balance, only an **admin** user can override and force the export. A note is added to the audit log recording the override.

## Export Format Details
Each software expects a specific format:
- **UltraTax**: tab-delimited with Schedule/Line columns matching UltraTax input codes
- **CCH**: CSV with CCH line reference codes
- **Lacerte**: comma-delimited with Lacerte screen/field codes
- **GoSystem**: XML or CSV depending on version
- **Generic**: standard CSV with account number, name, tax line, and balance columns

## Bookkeeper Letter
A professional PDF letter summarizing proposed book adjusting journal entries.
- Click **Download (PDF)** to save the letter
- Click **Preview** to view it in a new browser tab
- The letter includes all book AJEs for the selected period formatted as a client-ready document

## Working Trial Balance Export
Downloads a comprehensive Excel workbook with all TB columns, suitable for workpaper documentation.

## Validation Errors
- "X accounts are unmapped" — go to Tax Mapping and assign codes first
- "Trial balance is out of balance by $X" — post correcting JEs or have an admin override
