# System Default Tickmarks

## Overview
System tickmarks are firm-wide default tickmark symbols and descriptions managed by administrators. They serve as a template that can be copied into any client's tickmark library, ensuring consistent workpaper notation across all engagements.

## Managing System Defaults (Admin Only)
1. Go to **Admin > Default Tickmarks**
2. You'll see the current list of default tickmarks with their symbols, descriptions, colors, and sort orders
3. Use the form at the top to **add** new defaults
4. Click **Edit** on any row to modify its symbol, description, color, or sort order
5. Click **Delete** to remove a default (this does not affect tickmarks already copied to clients)

## Pre-Seeded Defaults
A fresh installation includes 12 standard firm tickmarks:

| Symbol | Description | Color |
|--------|-------------|-------|
| &#10003; | Verified and agreed | Gray |
| A | Agreed to bank statement | Green |
| B | Agreed to prior year tax return | Blue |
| C | Agreed to client-provided schedule | Blue |
| D | Agreed to depreciation schedule | Blue |
| F | Footed / cross-footed | Gray |
| G | Agreed to general ledger | Green |
| P | Agreed to prior year workpapers | Purple |
| R | Reviewed by preparer | Purple |
| T | Traced to supporting schedule | Purple |
| N | See preparer note | Amber |
| &dagger; | See footnote / explanation required | Red |

## Loading Defaults into a Client
1. Select a client in the sidebar
2. Go to **Trial Balance > Tickmarks**
3. Click the **Load Defaults** button (visible to admins only)
4. The system copies any default tickmarks whose symbols are not already in the client's library
5. A toast confirms how many were applied and how many were skipped (already present)

This operation is safe to run multiple times — it never creates duplicates.

## How It Works
- System defaults live in their own table (`system_tickmarks`), separate from per-client tickmark libraries
- The **Load Defaults** button calls the apply endpoint, which compares symbols and inserts only missing ones
- Symbols are unique per client — if a client already has a tickmark with symbol "A", the default "A" is skipped
- Editing or deleting a system default does not retroactively change any client's existing tickmarks
