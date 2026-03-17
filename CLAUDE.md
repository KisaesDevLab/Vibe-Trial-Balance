# Trial Balance App - Claude Code Project Memory

## Stack
- Frontend: React 18 + TypeScript + Vite + TanStack Table + TanStack Query + Tailwind
- Backend: Node.js 20 + Express + TypeScript + Knex.js + PostgreSQL 16
- AI: Anthropic SDK for bank classification and diagnostics
- Hosting: Raspberry Pi 5 (8GB), Nginx, PM2

## Technical Standards
- TypeScript strict mode everywhere
- All money as BIGINT cents (never float)
- Knex.js for all DB queries and migrations
- TanStack Query for server state in React, Zustand only for UI state
- Adjusted balances are NEVER stored, always computed via DB view
- API routes return: { data, error, meta }

## Current Phase
Phase 13: Workpaper Package & Tickmarks (complete)

## Completed
- Phase 1: Foundation — Auth, Clients, Chart of Accounts, Periods
- Phase 2: Trial Balance + Journal Entries (book AJE, tax AJE, v_adjusted_trial_balance view)
- Phase 3: Bank Transactions + AI Classification (CSV/OFX import, AI classify via Claude,
  classification rules, batch ops, source accounts, trans JEs, Settings page)
- Phase 4: Reports — Financial Statements, TB Report, General Ledger, Tax Code Report,
  Workpaper Index, AJE Listing (all with CSV export and print)
- Phase 5: Period Controls, Audit Trail & Dashboard — period locking, audit_log table,
  Dashboard page with stats + activity feed
- Phase 6: Workflow & Collaboration — period roll-forward, user management (admin CRUD),
  workpaper notes on TB rows (preparer/reviewer), COA import from CSV with column mapping,
  COA copy-from-client
- Phase 7: Trial Balance Import & Prior Year Comparison — prior_year_debit/credit columns,
  import endpoints (current + PY), 2-step CSV import modals on TrialBalancePage,
  PY columns in TB Report, Prior Year ColSet in Financial Statements
- Phase 8: Diagnostics & Polish — EIN on clients, report headers (client name/EIN/dates),
  TB Report variance columns (CY vs PY), AI Diagnostics page (Claude Haiku), TB filter bar
- Phase 9: Bank Reconciliation — reconciliations + reconciliation_items tables, full CRUD,
  reconciliation workspace (outstanding/cleared panels, balance summary, complete workflow)
- Phase 10: Tax Workpapers & Schedules — m1_adjustments table, M-1 Worksheet (book-to-tax
  reconciliation with summary, Excel/PDF export), Tax Basis Schedule (account-level book vs
  tax comparison with Excel/PDF export), SheetJS (xlsx) for Excel generation
- Phase 11: Engagement Management — engagement_tasks table, Period Checklist (CRUD, status
  workflow open→in_progress→review→completed→n_a, assignees, progress bar, templates modal
  with 10 common tasks), All Open Items cross-client summary view grouped by client/period
- Phase 12: Reporting Enhancements — cash_flow_category on COA, Cash Flow Statement (indirect
  method; operating/investing/financing sections, net change reconciliation, Configure Mapping
  tab for per-account category assignment), Custom Report Builder (saved_reports table, section
  management, account picker, column selector book/tax/prior-year, inline preview)
- Phase 13: Workpaper Package & Tickmarks — tickmark_library + tb_tickmarks tables, tickmark
  library CRUD per client (symbol/description/color), TB page tickmarks column with toggle modal,
  TB Report tickmark superscripts + legend, Workpaper Package page (cover + TOC + selectable
  report sections: TB, Balance Sheet, Income Statement, Cash Flow; firm/preparer config, print)
