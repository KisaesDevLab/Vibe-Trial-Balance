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

**Fix**: An AI provider must be configured. Ask an admin to go to **Admin > Settings > AI Provider** and configure one of: Claude (Anthropic API key starting with `sk-ant-`), Ollama (local server URL), or an OpenAI-compatible server. Click **Test Connection** to verify.

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
- Passwords must be at least 8 characters with an uppercase letter, a lowercase letter, and a number
- Contact your admin to reset your password at **Admin > Users**
- If you see "Token expired", log out and log back in
- If you see "Rate limited", wait 15 minutes — the login endpoint limits to 10 attempts per 15 minutes per IP

## Server Won't Start ("Port already in use")
The server exits with a helpful message if the port is already in use. Either:
1. Stop the other process using the port
2. Set a different port in `server/.env`: `PORT=3002`
3. Use the setup scripts (`setup.sh` / `setup.ps1`) which automatically detect port conflicts and suggest alternatives

## Production Startup Failures
In production (`NODE_ENV=production`), the server requires these environment variables or it will refuse to start:
- `JWT_SECRET` — set to a random 64+ character string
- `ENCRYPTION_KEY` — set to a separate random string (not the same as JWT_SECRET)
- `ALLOWED_ORIGIN` — set to your exact domain (e.g., `https://tb.yourfirm.com`)

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

## OCR Pre-processing: "Test OCR Connection" Fails
**Symptom**: The OCR Base URL is set, but clicking **Test OCR Connection** returns a connection error.

**Causes and fixes**:
- **Backend not running**: Start `llama-server` (for llama.cpp) or `ollama serve` (for Ollama) on the configured host/port. Verify by hitting `<baseUrl>/v1/models` in a browser — both backends surface a model list at that endpoint.
- **Wrong port**: llama.cpp defaults to `:8080`, Ollama to `:11434`. Double-check the Base URL matches the backend actually running.
- **Firewall / bind address**: If the OCR server is on another machine, it must bind to `0.0.0.0` (not `127.0.0.1`) and the firewall must allow inbound traffic on the port.
- **Wrong model name**: If the `/v1/models` response comes back OK but the configured model isn't in the list, the server logs a warning. Requests still work on llama.cpp (which typically serves one model per process regardless of the `model` field), but fix the name for clarity. On Ollama, `ollama pull <model>` to install it.

## OCR Pre-processing: Each Page Takes Forever or Times Out
**Symptom**: OCR import runs for minutes without progress, or pages show "OCR processing failed" warnings.

**Causes and fixes**:
- **Per-page timeout too low**: Default is 120,000 ms (2 min). Raise it at **Admin > Settings > OCR Pre-processing > Per-page timeout** if your model takes longer on first load or on complex pages.
- **CPU-only inference**: OCR on consumer CPUs routinely takes 60+ seconds per page. GPU acceleration (CUDA on NVIDIA, Metal on Apple Silicon, ROCm on AMD) is dramatically faster — enable it in your llama.cpp or Ollama build.
- **Model not loaded into RAM yet**: The first page of a session bears the cold-start load cost. Subsequent pages are much faster. Consider warming the model before import by running `Test OCR Connection`.
- **Swap thrashing**: Models larger than available RAM will swap, reducing throughput 10–100×. Use a quantized model that fits in memory (Q4/Q5 GGUFs for llama.cpp).

## OCR Pre-processing: Pages Return Warning "OCR may have stopped early (token limit)"
**Cause**: The OCR model hit the 16,384-token output ceiling before finishing the page.

**Fix**: The per-page output cap is sized for dense business credit card statements (~120 transactions) and should be sufficient for any realistic single page. If you're actually hitting it, your page likely has unusual content (multi-page tables collapsed onto one rendered page, extreme column density). Split the source PDF into smaller chunks before importing, or open an issue with a sample.

## OCR Pre-processing: "OCR produced very little text — falling back"
**Cause**: The OCR model ran but returned less than ~50 characters of usable output. Usually means the image was blank, the model refused to OCR (non-document content), or the model is misconfigured.

**Fix**:
- Open the source PDF and confirm each page actually contains document content (not a blank separator)
- Try a different OCR model (e.g., switch from `glm-ocr` to `minicpm-v` or `qwen3-vl`)
- If the model is genuinely text-capable but new to you, run `Test OCR Connection` to confirm the backend recognizes it

The import still completes — the app automatically falls back to the standard (non-OCR) extraction flow when OCR produces no usable text.

## Transaction Entry: Posted Rows Not Appearing in Bank Transactions
**Cause**: The client selector in the sidebar may differ from the client in Transaction Entry, or the date filter on Bank Transactions is excluding the newly posted transactions.

**Fix**: Verify the correct client is selected in the sidebar, then check the date filter on the Bank Transactions page matches the transaction dates you entered.
