# QuickBooks Online Connector

## Overview
Vibe Trial Balance can pull a client's trial balance straight from QuickBooks Online (QBO). The connection is read-only — nothing is ever written back to QuickBooks. Each client is bound to one QuickBooks company, and "Import from QuickBooks" on the Trial Balance page loads that company's Trial Balance report for the period into the unadjusted columns.

Everything is configured inside the app: **Setup > QuickBooks** holds the Intuit app credentials (admin only) and the per-client connections. The same page has a **Setup guide (PDF)** button that prints this walkthrough with the instance's own redirect URI filled in.

## One-time setup (administrator)

### 1. Create an Intuit developer account and an app
1. Go to https://developer.intuit.com and sign in with an Intuit account owned by the firm (not a personal login).
2. Open the Dashboard, choose **Create an app**, and pick **QuickBooks Online and Payments**.
3. Name the app after the firm — that name appears on the consent screen clients see.
4. Select only the **Accounting** scope (`com.intuit.quickbooks.accounting`).

### 2. Sandbox vs. production keys
- Every Intuit app has two credential sets under **Keys & credentials**: the **Development** tab (sandbox companies only) and the **Production** tab (real companies, unlocked after Intuit's app assessment).
- The **Environment** setting on the QuickBooks page must match the key set entered.
- Switching environments invalidates every client connection; each client must be reconnected.

### 3. Add the redirect URI
1. On Keys & credentials, find **Redirect URIs** and choose **Add URI**.
2. Paste the redirect URI shown on the QuickBooks page (use the **Copy** button). It ends in `/api/v1/integrations/qbo/callback`.
3. Add it under Development now, and again under Production once those keys are unlocked.
4. Sandbox accepts `http://localhost`; production requires a public HTTPS address.

### 4. Enter the credentials in Vibe Trial Balance
1. Open **Setup > QuickBooks** as an administrator.
2. Choose the Environment, paste the Client ID and Client Secret, and **Save**. The secret is stored encrypted and never shown again; leaving the field blank on a later save keeps the stored value.
3. Use **Redirect URI override** only when the derived address is not what the browser actually reaches (reverse proxy, different hostname). Whatever is shown as the effective redirect URI is what must be registered at Intuit.
4. Press **Test credentials**. Green means Intuit accepted them.

Environment variables `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT` and `QBO_REDIRECT_URI` are an optional fallback; values saved on the page take precedence and the page shows a notice when the environment is supplying them.

### 5. Going to production
- Complete the **App assessment questionnaire** on the Production tab. This is a private, unlisted app used by one firm with a read-only accounting scope; it is not published to the App Store.
- Intuit requires a public HTTPS redirect URI, a privacy policy URL and an end-user licence URL. A short page on the firm's website satisfies both.
- Set `APP_BASE_URL` on the server to the public HTTPS address (or set the redirect URI override), register that redirect URI under Production, switch Environment to Production and enter the production keys.

## Connecting a client company
1. On **Setup > QuickBooks**, find the client in the Connections table and press **Connect**.
2. The browser goes to Intuit. Sign in with a QuickBooks login that has admin-level access to the client's company — a QuickBooks Online Accountant (QBOA) login that lists the client works, as does the client's own admin login.
3. Pick the company and approve. Intuit sends the browser back to the app.
4. The app shows the company name it received and asks you to confirm the binding to the client you started from. Press **Bind**, or **Discard** if the wrong company was picked (the authorization is revoked at Intuit).

Rules:
- **One QuickBooks company per client.** Reconnect on a client that already has a company replaces the binding; if a *different* company is chosen, the stored QuickBooks account links on the chart of accounts are cleared so nothing from the old company matches the new one.
- A company already bound to another client cannot be bound again until it is disconnected there.
- **Needs re-authorization** means Intuit no longer accepts the stored token (revoked in QuickBooks, expired after long disuse, or the environment changed). Press **Reconnect**.
- **Disconnect** revokes the token at Intuit and removes the binding. The chart of accounts keeps its QuickBooks account links, so reconnecting the same company later matches immediately.
- **Test** on a connection does a live round trip to the company.

## Importing a trial balance
1. Select the client and period, open **Trial Balance**, and press **Import from QuickBooks** (visible when the connector is configured; enabled when the client's connection is active and the period is unlocked).
2. Choose the accounting method — the company's default report basis is preselected — and press **Fetch trial balance**.
3. Review the preview:
   - **linked** — matched by the stored QuickBooks account id from a previous import.
   - **by number** — matched by QuickBooks account number to the chart of accounts; the link is saved on confirm.
   - **New** — no match; a new account is created, typed from QuickBooks' classification (Asset/Liability/Equity/Revenue/Expense), with a lead sheet suggested automatically. Number, name, category and normal balance can be edited.
   - **Needs review** (red) — the row could not be placed: no account id on the line, its number is already linked to a different QuickBooks account, or two QuickBooks accounts share a number. Pick an account, create a new one, or leave it skipped.
   - Untick a row to leave it out.
4. **Accounts QuickBooks no longer reports** lists accounts that carry a balance here but are missing from the report. QuickBooks omits zero-balance accounts, so leaving the box ticked zeroes them.
5. If QuickBooks reported debits that do not equal credits, the import requires an explicit acknowledgement.
6. Press **Confirm import**. New accounts without a tax code are counted in the result — use **Auto-assign Tax Codes** on Tax Mapping afterwards.

What lands:
- Balances go into the **unadjusted** columns exactly as QuickBooks states them. Anything already posted in QuickBooks — including adjusting entries made there — is part of that balance; adjustments recorded in Vibe Trial Balance stay separate.
- Names are **never** used to match accounts.
- Amounts are always taken from the report the server stored at preview time; the browser only sends decisions.
- The raw report is kept with the import record so every balance traces back to what QuickBooks returned.

## Prior year for the PY Tie-Out
**PY Tie-Out > Import from QuickBooks** (or **Replace (QuickBooks)** once data exists) pulls the *prior* year's Trial Balance report as the bookkeeper's final prior-year balances, so the tie-out against the rolled-forward figures needs no file.

- Date range: the adjacent period's own dates when this client has one in the app (so a short or stub year is honoured); otherwise the current period's dates moved back one year. The preview header states which.
- The same matching and review as a current-year import; links made here are kept for the next import.
- It replaces any prior year data already uploaded for the period. Accounts QuickBooks omits simply show a variance against their rolled balance — nothing is zeroed.
- **Expect the closing entry as a variance.** QuickBooks reports the prior year before its close: net income still sits in the income and expense accounts, while the rolled balances have already closed it into equity. The offsetting variance in retained earnings and the P&L accounts is the close, not a bookkeeping difference; create the true-up AJE for the real differences only.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `redirect_uri mismatch` or "Something went wrong" at Intuit | The effective redirect URI on the QuickBooks page is not registered on the Intuit app for the selected environment. Copy it exactly. |
| `invalid_grant` / Needs re-authorization | The refresh token was revoked, expired, or belongs to a different environment. Press Reconnect. |
| Environment mismatch on a connection | The connection was authorized under the other environment. Reconnect after switching. |
| Client Secret rejected on Test | Secrets are shown once at Intuit. Generate a new one on Keys & credentials and paste it again. |
| HTTP 429 / throttled | Intuit rate-limits per company. The server retries with backoff; wait a minute and try again. |
| "Report totals do not add up" on preview | The report format changed or contains a row the parser could not read. The import is refused rather than importing a partial balance. |
| Import button missing | The connector is not configured (no credentials saved) — administrators still see the QuickBooks page to set it up. |
| Import button disabled | The period is locked, or this client has no active connection. |

Weekly, the server refreshes every active connection so refresh tokens do not lapse from disuse, and logs a warning when a token is within two weeks of expiry.

## Backups
Backups carry the connection row (company, environment, refresh token) for a client. Restoring **into the same client** brings the connection back and it refreshes on next use; restoring **as a new client** never carries a connection — reconnect it on the QuickBooks page.
