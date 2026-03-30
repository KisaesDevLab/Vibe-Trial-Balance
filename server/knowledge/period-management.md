# Period Management

## Creating a Period
1. Select the client in the sidebar
2. Go to **Setup > Periods**
3. Click **+ Add Period**
4. Enter: Period Name (e.g., "FY 2025"), Start Date, End Date
5. Check **Mark as current period** if this is the active working period
6. Save — the period is unlocked and ready for data entry

## Editing a Period
Click the **Edit** button on any period row to update the name, dates, or current status.

## Deleting a Period
Click **Delete** on the period row. Locked periods must be unlocked first. Deleting a period cascades — all TB data, journal entries, PY comparison data, and tickmark assignments are removed.

## Roll Forward (Creating Next Year's Period)
Roll forward copies data from a prior period into a new period, saving setup time.

1. Go to **Setup > Periods**
2. Click **Roll Forward** on the source period
3. Enter the new period name, start date, and end date
4. Choose a **balance mode**:
   - **Roll forward all balances** — all book-adjusted balances become the new period's unadjusted opening balances
   - **Close income/expense to retained earnings** — balance sheet accounts carry forward, income statement accounts zero out, net income closes to a selected equity account
   - **Create new period with zero balances** — all accounts start at zero (useful for fresh starts)
5. Optionally check **Copy recurring journal entries** and **Keep workpaper references**
6. Check **Mark new period as current** if desired
7. Click **Create New Period**

### Balance Checks
- The **source period must be balanced** (book-adjusted debits = credits) before rolling forward — if out of balance, the roll forward is blocked with an error message showing the dollar difference
- After the roll forward, the new period is also verified to be balanced — if not, the entire operation is rolled back

### What Gets Copied
- Trial balance rows with book-adjusted balances as new unadjusted balances
- **Prior year columns** populated from the source period's adjusted balances
- Tickmark assignments
- Recurring journal entries (if option selected)
- Workpaper references on COA accounts (if option selected)

### What Does NOT Get Copied
- Non-recurring journal entries
- Bank transactions
- Variance notes
- Engagement tasks
- PY comparison data

## Period Lock and Unlock

### Locking a Period
Locking prevents all edits: no TB changes, no journal entries, no bank transactions, no PY tie-out changes.

1. Go to **Setup > Periods**
2. Click **Lock** on the period
3. The system verifies the TB is balanced before allowing the lock
4. If out of balance, the lock is refused

Locking creates an audit log entry.

### Unlocking a Period
Only **admin** users can unlock a period.

1. Go to **Setup > Periods**
2. Click **Unlock** (only visible to admins on locked periods)
3. Confirm the unlock

### Why Lock Periods?
- Prevents accidental edits after work is complete
- Provides a clear audit trail for review
- Required before generating final export files

## Current Period Indicator
The period marked **Current** (shown with a ★ star in the period selector) is the default when navigating. Only one period per client can be current at a time.

## Period Dashboard
After selecting a period, the Dashboard shows:
- Lock status (locked/unlocked, who locked it)
- TB balance status (balanced/out of balance with amount)
- Count of book and tax journal entries
- Count of bank transactions by status
- Recent audit log activity
