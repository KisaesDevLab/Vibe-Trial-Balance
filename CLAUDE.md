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
Phase 9: Bank Reconciliation

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
