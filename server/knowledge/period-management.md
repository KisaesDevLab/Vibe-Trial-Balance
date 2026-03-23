# Period Management

## Creating a Period
1. Select the client in the sidebar
2. Go to **Setup > Periods**
3. Click **New Period**
4. Enter: Period Name (e.g., "FY 2025"), Start Date, End Date
5. Check **Mark as Current** if this is the active working period
6. Save — the period is unlocked and ready for data entry

## Editing a Period
Click the edit icon on any period row to update the name, dates, or current status.

## Deleting a Period
Click the delete icon. A period can only be deleted if it has no trial balance data or journal entries. Locked periods cannot be deleted.

## Roll-Forward (Creating Next Year's Period)
Roll-forward copies configuration from a prior period into a new period, saving setup time for returning clients.

1. Go to **Setup > Periods**
2. Click the **Roll Forward** icon on the period you want to copy from
3. In the dialog, enter the new period name, start date, and end date
4. Click **Roll Forward**

**What gets copied:**
- Chart of accounts structure (all accounts)
- Tax code assignments (tax_code_id on each account)
- Tickmarks from the library
- The source period's ending balances become the new period's **Prior Year** comparison column

**What does NOT get copied:**
- Trial balance balances (the new period starts at zero — import or enter fresh balances)
- Journal entries
- Bank transactions
- Variance notes
- Engagement tasks

## Period Lock and Unlock

### Locking a Period
Locking prevents all further edits: no TB changes, no journal entries, no bank transaction imports.

To lock:
1. Go to **Setup > Periods**
2. Click the **Lock** icon on the period
3. The system verifies the TB is balanced (total debits = total credits) before allowing the lock
4. If out of balance, the lock is refused — fix the imbalance first

Locking creates an audit log entry recording who locked the period and when.

### Unlocking a Period
Only **admin** users can unlock a period. Preparers and reviewers cannot.

1. Go to **Setup > Periods**
2. Click the **Unlock** icon (only visible to admins on locked periods)
3. Confirm the unlock

**Important:** Unlocking for corrections is fine, but remember to re-lock when done. The Dashboard shows the lock status prominently.

### Why Lock Periods?
- Prevents accidental edits after work is complete
- Required before generating final export files for tax software
- Provides a clear audit trail for review

## Current Period Indicator
The period marked **Current** is the default when navigating to a page that requires a period. You can mark any period as current — only one period per client can be current at a time.

## Period Dashboard
After selecting a period, the Dashboard shows:
- Lock status (locked/unlocked, who locked it)
- TB balance status (balanced/out of balance with amount)
- Count of book and tax journal entries
- Count of bank transactions by status (unclassified, confirmed)
- Recent audit log activity
