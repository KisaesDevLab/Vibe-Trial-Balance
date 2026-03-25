# Troubleshooting

## Trial Balance Out of Balance
**Symptom**: The TB report shows debits ≠ credits, or a red "Out of Balance" banner appears.

**Steps to resolve**:
1. Check journal entry totals — go to AJE Listing and verify each entry balances
2. Look for unposted entries — any draft entries not yet saved may be missing
3. If the period was recently unlocked and re-locked, verify no edits were made out of sequence
4. Check if a prior-year balance import added a non-balancing entry
5. Use AI Diagnostics to get a specific out-of-balance amount and affected accounts

## Can't Export (Export Button Disabled or Error)
**Causes and fixes**:
- **Unmapped accounts**: One or more accounts don't have a tax code assigned. The error message lists them. Go to Tax Mapping to assign codes.
- **TB out of balance**: The book-adjusted TB must balance. Fix the imbalance first (see above). Admin users can override this check if needed.
- **No period selected**: Make sure a period is selected in the sidebar.

## PDF Report is Blank or Shows No Data
**Causes and fixes**:
- **No period selected**: Select a client and period in the sidebar before generating reports
- **No data in period**: The TB may have no accounts with balances — check the TB grid
- **Filter too narrow**: Some reports have date or category filters — check that your filter isn't excluding all data
- **Period not finalized**: For financial statements, confirm the TB is balanced and JEs are all posted

## AI Classification Not Working
**Symptom**: Clicking "Classify with AI" does nothing, or shows an error.

**Fix**: The Claude API key must be configured. Ask an admin to go to **Admin > Settings** and enter a valid Anthropic API key. The key should start with `sk-ant-`.

## Can't Unlock Period (Unlock Button Missing)
**Cause**: Only **admin** users can unlock a period. Preparers and reviewers do not have this permission.

**Fix**: Contact your admin user and ask them to unlock the period at **Setup > Periods**.

## Import Button is Greyed Out
**Cause**: The selected period is **locked**. Locked periods prevent all data imports and edits.

**Fix**: Have an admin unlock the period, or create a new period for the import.

## App is Slow or Unresponsive
- Try refreshing the page (F5 or Ctrl+R)
- The app runs on a Raspberry Pi server — response times >3 seconds for large operations (1000+ account TBs) are normal
- If consistently slow, check server load via the health endpoint: `GET /api/v1/health`

## Login Issues
- Ensure Caps Lock is off
- Contact your admin to reset your password at **Admin > Users**
- If you see "Token expired", log out and log back in

## MCP / Claude Desktop Connection Issues

**Symptom**: Claude Desktop shows "connection failed" or tools don't appear.

**For HTTP/SSE mode**:
1. Confirm the MCP token is configured — go to **Settings > MCP / Claude Desktop Integration** and check the token status badge. If it shows "No token configured", click **Generate Token**.
2. Verify the URL in your Claude Desktop config points to the correct server (`http://your-server:3001/mcp/sse`).
3. Check that the `Authorization` header uses the exact token value (copy it fresh from Settings if unsure).
4. If the token was recently rotated, update the `Authorization` header in your Claude Desktop config with the new token.

**For stdio mode**:
1. Verify the path in `args` points to the compiled file: `.../server/dist/mcp-stdio.js`. Run `npm run build` in the server directory if the file doesn't exist.
2. Confirm `DATABASE_URL` in the env block is correct and the database is reachable.

**Symptom**: Tools return "Rate limit exceeded".
- The MCP integration allows 100 tool calls per minute. Wait 60 seconds and try again.

**Symptom**: `auto_assign_tax_codes` tool returns an error.
- The MCP agent user (`mcp_agent`) must exist in the database. This is created by migration `20260320000001_mcp_support`. If the migration hasn't run, ask your admin to run `npm run migrate` on the server.

**Symptom**: `lock_period` tool returns "out of balance".
- The trial balance must be balanced before locking. Use the `get_trial_balance` tool to check the `is_balanced` field and `run_diagnostics` to find the discrepancy.

## Data Seems Missing After Period Roll-Forward
When rolling forward a period, the new period gets:
- Chart of accounts (copied)
- Tickmarks and WP references (copied)
- Tax code assignments (copied)
- Prior year balances populated from the source period's ending balances

The new period does NOT copy: TB balances (start at zero — import or enter fresh), journal entries, bank transactions, engagement tasks, or variance notes.

If prior year columns are missing after roll-forward, check that the source period had balances entered before rolling forward.

## Can't Complete a Reconciliation (Difference Won't Reach Zero)
**Common causes:**
- A transaction appears on the bank statement but hasn't been imported/entered yet → Import the missing transaction and return to the reconciliation
- A duplicate transaction was deleted but it was the one that cleared → Verify transaction history in Bank Transactions
- The beginning balance doesn't match the prior reconciliation's ending balance → Check the prior reconciliation's ending balance and correct the beginning balance field

**Fix**: Identify the difference amount and search for a transaction of that exact dollar amount that may have been missed.

## Reconciliation Shows Transactions That Were Already Cleared
**Cause**: The reconciliation is using a beginning balance from before a previous reconciliation, causing already-cleared transactions to re-appear.

**Fix**: Set the correct beginning balance to match the prior reconciliation's ending balance.

## Can't Apply a COA Template (Replace Mode Blocked)
**Cause**: Replace mode cannot remove accounts that have trial balance data, journal entry lines, or bank transactions.

**Fix**: Use **Merge** mode instead, which only adds new accounts and leaves existing ones unchanged. If you truly need to replace the COA, clear all data from the period first (or use a brand-new client with no data).

## Engagement Tasks Not Copied to New Period
This is intentional — engagement tasks are not copied during roll-forward. Each period starts with a blank checklist. Create tasks fresh for each period, or copy them manually.

## Transaction Entry: Posted Rows Not Appearing in Bank Transactions
**Cause**: The client selector in the sidebar may differ from the client in Transaction Entry, or the date filter on Bank Transactions is excluding the newly posted transactions.

**Fix**: Verify the correct client is selected in the sidebar, then check the date filter on the Bank Transactions page matches the transaction dates you entered.
