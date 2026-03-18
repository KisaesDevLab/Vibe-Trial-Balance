# Trial Balance App - Claude Code Project Memory

## Stack
- Frontend: React 18 + TypeScript + Vite + TanStack Table + TanStack Query + Tailwind
- Backend: Node.js 20 + Express + TypeScript + Knex.js + PostgreSQL 16
- AI: Anthropic SDK for bank classification, diagnostics, tax assignment
- Hosting: Raspberry Pi 5 (8GB), Nginx, PM2

## Technical Standards
- TypeScript strict mode everywhere
- All money as BIGINT cents (never float)
- Knex.js for all DB queries and migrations (JS migration files for Windows compat)
- TanStack Query for server state in React, Zustand only for UI state
- Adjusted balances are NEVER stored, always computed via DB view
- API routes return: { data, error, meta }
- Named exports, PascalCase components, camelCase utilities, snake_case DB columns

## Key Architecture Decisions
- Trial Balance Grid = editing balances ONLY, no category subtotals
- Tax Mapping View (Plan Phase 5) = SEPARATE page: assign tax codes, read-only balances, category subtotals, net income, balance check
- tax_line VARCHAR on chart_of_accounts: legacy field kept for compat. New system uses tax_code_id FK → tax_codes table. Dual-write: when tax_code_id assigned, also write tax_code string to tax_line.
- activity_type on clients: business / rental / farm / farm_rental (added Plan Phase 4)
- PDF strategy: server-side pdfmake (Plan Phase 6). All browser window.print() replaced with download/preview PDF endpoints.
- Tax codes: two tables — tax_codes (canonical) + tax_code_software_maps (per-software UltraTax/CCH/Lacerte/GoSystem/Generic)

## Phase Numbering
Canonical phases from NEXT_PHASE.md (master plan). App-only features built before plan adoption are tracked separately.

## Current Phase
Plan Phase 8: Multi-Period Comparison (next)

## Completed — Plan Phases
- Plan Phase 1: Foundation — Auth, Clients, Chart of Accounts, Periods
- Plan Phase 2: Trial Balance Grid — inline editing, keyboard nav, v_adjusted_trial_balance view, CSV import
- Plan Phase 3: Journal Entries — Book & Tax AJEs, balance validation, filter by type
- Plan Phase 4: Tax Code Management — tax_codes + tax_code_software_maps tables, 500+ seeded codes (1065/1120/1120S/1040/common), full CRUD API, TaxCodesPage (admin) with software mappings, CSV import/export; activity_type on clients
- Plan Phase 5: Tax Mapping View — TaxMappingPage (separate page): account table with tax code dropdowns, progress bar, category subtotals, net income row, balance sheet check, optimistic updates with flash; dual-write COA PATCH (tax_code_id → also sets tax_line for compat)
- Plan Phase 6: PDF Report Generation — pdfmake server-side PDFs for all 8 report types, PdfTemplateService (Roboto fonts, branded header/footer, formatCents), 8 PDF endpoints; client PDF buttons replace window.print() on all report pages
- Plan Phase 7: Financial Statements — Tax-Basis P&L (income/expense grouped by tax code, sort_order, per-code subtotals, net income), Tax Return Order (all accounts in tax return order with category filter); PDF + frontend for both; IS/BS/CashFlow already complete from prior phases

## Completed — App-Only Features (built before plan adoption, kept and maintained)
- Bank Transactions + AI Classification (OFX/CSV import, AI classify, rules, batch ops, source accounts, import dedup via SHA-256 hash, reclassify audit trail, pagination, sort_order priority)
- Financial Statements (IS, BS, Statement of Equity — CY+PY comparative columns, Change column, header skeleton)
- Cash Flow Statement (indirect method, account mapping config)
- TB Report, General Ledger, Tax Code Report, Workpaper Index, AJE Listing (browser-print — migrating to pdfmake in Plan Phase 6)
- Period Controls + Audit Trail + Dashboard (locking with TB balance check, admin-only unlock, roll-forward copies tickmarks)
- User Management (admin CRUD)
- COA import from CSV with column mapping, copy-from-client
- TB Import (current + prior year), PY comparison columns
- AI Diagnostics page (Claude Haiku) with Spinner loading state
- Bank Reconciliation (full workspace, admin reopen)
- Tax Workpapers: M-1 Worksheet (with input validation), Tax Basis Schedule (SheetJS Excel)
- Engagement Management: Period Checklist, All Open Items with drill-down "View Checklist →"
- Custom Report Builder (saved_reports table)
- Workpaper Package + Tickmarks (tickmark_library + tb_tickmarks, TB superscripts + legend)
- Variance notes (per account per period, TB Report inline editing)
- QA Round 1 & 2: 30-item UX audit — period lock enforcement on TB grid, batch op toasts,
  reopen reconciliation feedback, engagement double-submit prevention, FS comparative layout,
  Spinner component, consistent error/success box styles, sidebar workflow ordering,
  demo seed data (003_demo_client.js — Demo Company LLC FY2024)
