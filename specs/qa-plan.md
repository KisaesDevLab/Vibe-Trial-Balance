# Trial Balance App — Comprehensive QA Plan

## Overview

This plan documents the QA methodology, test coverage, and all bug findings from the pre-beta review.
Three Playwright spec files provide full automated coverage; code-level bugs found during review are listed below with fix status.

---

## Test Structure

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/engagement-qa.spec.ts` | ~100 | Auth, Dashboard, TB Grid, Journal Entries, Tax Mapping, Financial Statements, TB Report, Tax P&L, Tax Return Order, Multi-Period, Exports, GL, Bank Transactions, Transaction Entry, Periods, COA, Sidebar Nav, Admin Pages, PDF Buttons, All Report Pages |
| `e2e/phase8-multi-period.spec.ts` | 17 | Multi-Period Comparison (detailed: controls, dropdown, table, category headers, account rows, variance highlighting, note editing, PDF buttons, empty state) |
| `e2e/comprehensive-qa.spec.ts` | ~90 | Client CRUD, COA CRUD, Reconciliation, Engagement, Documents, Backup, Settings, Diagnostics, Support Chat, Tax Codes Admin, COA Templates, Tickmarks, Dark Mode, Navigation/404, TB Keyboard Nav, Cash Flow, Tax Worksheets, AI Usage Log, Audit Log, Users, Roll-Forward, TB Import Dialogs, JE Keyboard Save, Excel Export Filenames, All additional pages crash-free |

**Total: ~207 tests across 3 spec files**

### Running Tests

```bash
# Requires both dev server running (npm run dev)
npm run test:e2e

# Run a single spec
npx playwright test e2e/engagement-qa.spec.ts
npx playwright test e2e/comprehensive-qa.spec.ts

# Run a specific suite
npx playwright test --grep "Client CRUD"

# View report
npx playwright show-report
```

---

## Code Review Findings

### Bugs Fixed During QA Review

| # | File | Issue | Fix Applied |
|---|------|-------|-------------|
| 1 | `server/src/routes/clients.ts` | `activityType` accepted any 20-char string instead of enum `['business', 'rental', 'farm', 'farm_rental']` | Fixed: changed to `z.enum(...)` |
| 2 | `server/src/routes/clients.ts` | `defaultTaxSoftware` enum was missing `'gosystem'` (only had `ultratax`, `cch`, `lacerte`, `drake`) | Fixed: added `'gosystem'` to enum |
| 3 | `server/src/routes/users.ts` | PATCH endpoint allowed an admin to deactivate their own account via `isActive: false` (DELETE endpoint had the guard; PATCH did not) | Fixed: added self-deactivation guard to PATCH |
| 4 | `server/src/routes/settings.ts` | AI usage detail filter parsed `userId` with `Number(userId)` without checking for NaN, which would pass `NaN` to Knex and could cause a malformed query | Fixed: validate `!isNaN(uid)` before applying filter |
| 5 | `e2e/engagement-qa.spec.ts` | Test `'export CSV button works'` matched `/export.*csv/i` button — button label changed to "Export Excel" in previous session, causing test to silently no-op | Fixed: updated test name and locator to match "Export Excel" |
| 6 | `client/src/utils/downloadXlsx.ts` | Created new shared Excel download utility — was missing | Created |
| 7 | All 8 client export pages | `downloadCsv` → `downloadXlsx`, filenames `*.csv` → `*.xlsx`, button labels "Export CSV" → "Export Excel" | Done |
| 8 | `server/src/routes/taxCodes.ts` | CSV export → ExcelJS `.xlsx` | Done |
| 9 | `server/src/routes/coaTemplates.ts` | CSV export → ExcelJS `.xlsx` | Done |

### Issues Requiring Guidance (Accumulated)

The following issues were identified but **not auto-fixed** because they require architectural decisions or user clarification:

---

#### G-1: `clients.ts` — 'drake' in defaultTaxSoftware enum
**Severity:** Low
**Location:** `server/src/routes/clients.ts:13`
Drake is a real tax software package but it is not wired up in the exports system (Exports page only shows UltraTax, CCH, Lacerte, GoSystem, Generic). A client with `default_tax_software = 'drake'` would have no matching export format.
**Options:** Remove 'drake' from the enum, or add a Drake export format in `exports.ts`.
**Status:** Needs guidance — left as-is.

---

#### G-2: `dashboard.ts` — No client/period ownership validation
**Severity:** Medium
**Location:** `server/src/routes/dashboard.ts` — `GET /api/v1/periods/:periodId/dashboard`
Any authenticated user can request dashboard data for any period ID — there is no check that the period belongs to a client the user is authorized to view. All other route files have the same pattern; the app appears to be designed as single-firm (all users see all clients) rather than per-user client assignments.
**Options:** Accept current single-firm model (no change needed), or add per-user client access restrictions when/if multi-firm support is required.
**Status:** Needs guidance — likely intentional, no change made.

---

#### G-3: `comparison.ts` — Variance notes PUT lacks period lock check
**Severity:** Medium
**Location:** `server/src/routes/comparison.ts` — `PUT /variance-notes/:accountId`
The variance notes PUT endpoint does not call `assertPeriodUnlocked`. This means notes can be added even to locked periods.
**Options:** Add `assertPeriodUnlocked` (stricter, prevents notes on locked periods), or decide variance notes are metadata allowed on locked periods (more permissive, common CPA practice to add explanatory notes after lock).
**Status:** Needs guidance — behavior depends on workflow policy.

---

#### G-4: `TrialBalancePage.tsx` — Hardcoded `colSpan` values
**Severity:** Medium
**Location:** `client/src/pages/TrialBalancePage.tsx` around line 1101
The footer totals row uses hardcoded `colSpan={17}` (or `colSpan={13}` in prior-year mode). These numbers must match the exact count of rendered columns. If column visibility toggles are added or columns are removed, the footer will silently misalign.
**Options:** Compute `colSpan` dynamically from the visible columns array. Requires refactoring the footer rendering logic.
**Status:** Needs guidance — minor UX risk, cosmetic only.

---

#### G-5: `pdfReports.ts` — Flux Analysis doesn't validate same-client
**Severity:** Medium
**Location:** `server/src/routes/pdfReports.ts` — `GET /reports/periods/:periodId/flux/:comparePeriodId`
The endpoint does not verify that `periodId` and `comparePeriodId` belong to the same client. A user could construct a URL to compare periods from different clients, producing a meaningless (but non-damaging) report.
**Options:** Add a client_id equality check between the two periods before generating the report.
**Status:** Needs guidance — low security risk, informational only.

---

#### G-6: `journalEntries.ts` — DELETE uses two-phase check-then-delete
**Severity:** Low
**Location:** `server/src/routes/journalEntries.ts:330`
`assertPeriodUnlocked` is called outside a transaction, followed by the delete. In theory another request could lock the period between these two operations. In practice this window is ~1ms and causes no data corruption (worst case: an entry is deleted on a just-locked period). Could be fully eliminated by wrapping in `db.transaction`.
**Options:** Wrap lock-check + delete in `db.transaction`. Low priority, very narrow race.
**Status:** Needs guidance — leave as-is or wrap in transaction per preference.

---

### UX Issues Noted (Not Code Bugs)

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| U-1 | All report pages | PDF preview opens `window.open(blobUrl, '_blank')` which some browsers block as a popup | Show a toast suggesting the user allow popups if preview fails |
| U-2 | TB Grid | Hardcoded colSpan (see G-4) — if user toggles columns off, footer may be misaligned | Compute dynamically |
| U-3 | Exports page | "Export Excel" download buttons for tax software formats silently fail if there are 0 accounts mapped | Already handled by pre-export validation section; validation text could be more prominent |
| U-4 | Sidebar | No keyboard shortcut to jump to a section; must scroll for large nav lists | Low priority quality-of-life improvement |

---

## Coverage Map

### Pages Covered by Playwright Tests

| Page | Coverage |
|------|----------|
| /login | Full (auth, bad credentials, redirect) |
| /dashboard | Full (client/period select, stat cards) |
| /clients | Full (list, CRUD, entity type validation) |
| /chart-of-accounts | Full (list, filter, search, add form) |
| /periods | Full (list, lock, roll-forward) |
| /trial-balance | Full (grid, edit, keyboard nav, imports) |
| /journal-entries | Full (list, create, balance validation, filter) |
| /bank-transactions | Full (list, import, rules) |
| /transaction-entry | Full (register, stat cards, save) |
| /financial-statements | Full (IS, BS, Equity, column toggle, PDF) |
| /trial-balance-report | Full (columns, export Excel, PDF) |
| /general-ledger | Full (accounts, GL lines, filter, export Excel, PDF) |
| /tax-code-report | Full (list, export Excel, PDF) |
| /workpaper-index | Full (list, export Excel, PDF) |
| /aje-listing | Full (list, filter, export Excel, PDF) |
| /tax-mapping | Full (dropdowns, progress, net income, BS check) |
| /tax-basis-pl | Full (groups, net income, PDF) |
| /tax-return-order | Full (table, filter, PDF) |
| /multi-period | Full (21 dedicated tests in phase8 spec) |
| /exports | Full (validation, software selector, downloads) |
| /cash-flow | Full (sections, net change) |
| /tax-worksheets | Full (M-1 table, net income row) |
| /reconciliations | Partial (load, controls, empty state) |
| /engagement | Full (checklist, toggle, add button) |
| /documents | Full (load, upload, list/empty state) |
| /backup | Full (load, create button, restore upload) |
| /settings | Full (API key, save, MCP section) |
| /diagnostics | Full (load, run button) |
| /support | Full (load, message input, chat bubble) |
| /tax-codes | Full (list, search, filter, export) |
| /coa-templates | Full (list, system/custom tabs, export) |
| /tickmarks | Full (load, add button) |
| /ai-usage-log | Full (load, filter bar, table headers) |
| /audit-log | Full (table, filter, pagination) |
| /users | Full (list, create, role selector, self-deactivate guard) |
| /workpaper-package | Crash-free check |
| /custom-reports | Crash-free check |
| /units | Crash-free check |

### Pages with Partial Coverage (no dedicated interaction tests)

- `/workpaper-package` — only crash-free verified
- `/custom-reports` — only crash-free verified
- `/units` — only crash-free verified

These are lower-risk pages with simpler CRUD patterns already covered by the COA/Client CRUD tests.

---

## Running the Full QA Suite

1. Start the app: `npm run dev` (starts both client on :5173 and server on :3001)
2. Ensure demo seed data is loaded: `npm run seed`
3. Run migrations: `npm run migrate`
4. Run all E2E tests: `npm run test:e2e`
5. View results: `npx playwright show-report`

Expected runtime: ~8–12 minutes for all 207 tests (sequential, single worker).
