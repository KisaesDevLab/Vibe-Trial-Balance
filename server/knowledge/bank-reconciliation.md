# Bank Reconciliation

## Overview
The Bank Reconciliation workspace lets you reconcile the client's bank statement against the transactions recorded in the app. Access: **Bookkeeping > Reconciliations**

## Starting a Reconciliation
1. Go to **Bookkeeping > Reconciliations**
2. Click **New Reconciliation**
3. Enter:
   - **Statement Date**: The ending date on the bank statement
   - **Ending Balance**: The closing balance from the bank statement
   - **Beginning Balance**: The opening balance (auto-populated from the prior reconciliation if one exists)
4. Save — the reconciliation workspace opens

## The Reconciliation Workspace
The workspace shows all confirmed bank transactions that haven't been cleared in a prior reconciliation.

- **Check off** each transaction that appears on the bank statement
- The **Cleared Balance** updates as you check items
- The **Difference** shows how far you are from reconciling (goal: $0.00)

When the difference reaches zero, the reconciliation is complete.

## Completing a Reconciliation
When the difference is $0.00:
1. Add any notes in the **Notes** field
2. Click **Complete Reconciliation**
3. The status changes to "completed" and all checked transactions are marked as cleared
4. The completed reconciliation is saved and visible in the reconciliation history

## Reconciliation History
All completed reconciliations are listed at **Bookkeeping > Reconciliations**. Each row shows the statement date, ending balance, and status.

Click any completed reconciliation to view the details and which transactions were cleared.

## Reopening a Reconciliation (Admin Only)
If an error is discovered in a completed reconciliation, an admin can reopen it:
1. Go to **Bookkeeping > Reconciliations**
2. Click the **Reopen** button on the completed reconciliation
3. Make corrections — clear or unclear transactions as needed
4. Complete again when done

Only **admins** can reopen completed reconciliations. Reopening is logged in the audit trail.

## Common Reconciliation Issues

**Difference won't reach zero:**
- Check for transactions that appear on the statement but haven't been imported/entered yet
- Look for duplicate transactions (the import deduplication catches most, but manual entries could create duplicates)
- Verify the beginning balance matches the prior reconciliation's ending balance

**Transaction appears on statement but not in the app:**
- Import the transaction using Bank Transactions > Import, or use Transaction Entry to add it manually
- Return to the reconciliation and check it off

**Outstanding items (not on statement):**
- Transactions in the app that don't appear on the statement (checks not yet cleared, deposits in transit) should be left unchecked
- These will appear in the next reconciliation

## Tips
- Reconcile monthly for the cleanest workflow
- Complete reconciliations before locking the period
- The reconciliation's ending balance should match the bank account balance in the trial balance
