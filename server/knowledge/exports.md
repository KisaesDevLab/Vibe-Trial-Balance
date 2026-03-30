# Tax Exports

## Location
Access: **Tax > Tax Exports**

## Supported Tax Software
The app exports tax data formatted for major tax preparation software:
- **UltraTax CS** (Thomson Reuters)
- **CCH Axcess / ProSystem fx**
- **Lacerte** (Intuit)
- **GoSystem Tax RS** (Thomson Reuters)
- **Generic** (universal Excel format)

## How to Export
1. Select your client and period in the sidebar
2. Go to **Tax > Tax Exports**
3. Choose the target software from the dropdown
4. Review the pre-export validation results
5. Optionally configure consolidation (see below)
6. Click the download button

## Pre-Export Validation
Before generating an export, the system checks:
- **Balance status**: Whether the unadjusted trial balance is balanced
- **Unmapped accounts**: Accounts without a tax code assigned (link to Tax Mapping)
- **Missing software codes**: Accounts with a tax code but no software-specific mapping

Warnings are informational — exports are always allowed.

## Book and Tax Basis
All tax exports include **both** Book Basis and Tax Basis amount columns, clearly labeled in the header. This allows the tax preparer to see both the book-adjusted and tax-adjusted balances for each account.

## Consolidation by Tax Code
When multiple accounts share the same tax code (e.g., 10 revenue accounts all mapped to "Gross Receipts"), you can consolidate them into a single export line.

### How to Consolidate
1. Expand the **Consolidation Options** section on the Tax Exports page
2. Check the tax codes you want to consolidate (or click **Select all multi-account**)
3. Each checked tax code shows an editable **Export as** row with Account # and Description fields
4. These default to the first account in the group — edit them to set the account identity for the consolidated line
5. The **Book Basis** and **Tax Basis** totals preview shows the summed amounts
6. Click the expand arrow to see which individual accounts are being rolled up

### Consolidation Settings
- Settings are saved **per client per software** — they persist across sessions and users
- Click **Save Settings** to store, or settings auto-save before download
- Changing to a different tax software loads that software's saved settings
- Unconsolidated tax codes export as individual account lines (no change from default)

### Override Fields
For permanent overrides, go to **Tax > Tax Codes**, expand a tax code's software mappings, and set the **Export Acct # Override** and **Export Desc Override** fields. These are used when no inline override is set on the Exports page.

## Bookkeeper Letter
The bookkeeper letter has moved to the **Trial Balance > AJE Listing** page. It includes both preview and download buttons for the professional PDF letter summarizing proposed book adjusting journal entries.
