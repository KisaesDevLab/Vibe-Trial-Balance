# Tickmarks and Workpaper References

## Overview
Tickmarks are color-coded symbols applied to accounts in the trial balance to indicate that a specific audit or review procedure was performed. They appear in the TB grid and on printed TB reports.

Access: **Trial Balance > Tickmarks** to manage the library; tickmarks are assigned directly in the TB grid.

## The Tickmark Library
Each client has its own tickmark library — a set of named symbols you can assign to accounts.

### Creating a Tickmark
1. Go to **Trial Balance > Tickmarks**
2. Click **New Tickmark**
3. Enter:
   - **Symbol**: A short identifier (1–3 characters, e.g., "A", "✓", "F")
   - **Description**: What the tickmark means (e.g., "Agreed to bank statement", "Footed", "Confirmed with client")
   - **Color**: Choose from gray, blue, green, red, purple, or amber

### Editing and Deleting Tickmarks
Click the edit icon to change a tickmark's description or color. The symbol itself cannot be changed (it's used as the identifier).

Deleting a tickmark removes it from the library and from all TB accounts where it was assigned.

## Assigning Tickmarks to Accounts
1. Go to **Trial Balance** (the TB grid)
2. Click the tickmark column for any account row
3. Select one or more tickmarks from the dropdown
4. The selected tickmarks appear as colored superscripts in the account row

Multiple tickmarks can be assigned to the same account.

## Workpaper References (WP Ref)
Workpaper references are short text codes (e.g., "A-1", "B-4", "TB-12") that link an account to a specific workpaper in the engagement file.

- Edit WP refs directly in the TB grid by clicking the WP Ref column
- WP refs appear on the TB Report PDF and in the Workpaper Index report
- Use a consistent naming convention: letter prefix for the section (A=Cash, B=AR, C=Inventory) and number for the page

## How Tickmarks and WP Refs Appear in Reports

**TB Grid**: Tickmarks appear as small colored superscripts next to the account name.

**TB Report PDF**: Both tickmarks and WP refs are included. A legend at the bottom of the report lists each tickmark symbol with its description.

**Workpaper Index**: Lists all accounts with WP refs assigned, sorted by WP ref. This serves as the index to your engagement file.

**Workpaper Package**: Includes the TB report (with tickmarks and WP refs), workpaper index, and any other selected reports bundled into a single PDF.

## Roll-Forward Behavior
Tickmark library entries are copied when you roll forward a period. The tickmark assignments on individual accounts are also preserved. This means your standard tickmark set carries forward year to year without re-setup.

## Best Practices
- Define your standard tickmarks at the start of each engagement (or roll them forward from the prior year)
- Use colors consistently: green = confirmed, blue = agreed to source, red = exception noted, amber = follow up
- Assign WP refs before generating the Workpaper Index — accounts without WP refs won't appear in the index
