# Vibe Trial Balance - Claude Code Project Memory

## License Compliance (PolyForm Small Business 1.0.0)

This project is licensed under the **PolyForm Small Business License 1.0.0**. Enforce these rules in every coding session:

### When adding dependencies
- Check the license before running `npm install`. Allowed: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0, Unlicense.
- Review required before adding: LGPL-*, MPL-2.0, GPL-3.0-or-later, CC-BY-4.0.
- Never add: GPL-2.0-only, SSPL-1.0, AGPL-3.0 (copyleft incompatible with our license), Proprietary, Commercial.
- After installing, run `npx license-checker --excludePrivatePackages --summary` in the relevant workspace and confirm no new denied licenses appear.
- Update `scripts/license-policy.json` if a new package needs a `knownIssues` entry.

### Source file headers
- Every new `.ts` or `.tsx` file created under `client/src/` or `server/src/` must begin with:
  ```
  // Copyright 2025-2026 Kisaes LLC
  // Licensed under the PolyForm Small Business License 1.0.0.
  // Use is limited to qualifying small businesses. See LICENSE for terms.
  ```
- Do not add headers to generated files, migration files, or config files.

### Use limitation and notices
- The PolyForm Small Business License permits use only by companies with **fewer than 100 total individuals** (employees + contractors) and **under $1,000,000 USD (2019, inflation-adjusted) total revenue** in the prior tax year. Larger organizations need a Commercial License from Kisaes LLC — see `COMMERCIAL_LICENSE.md`.
- Distribution IS permitted under this license, but anyone who distributes copies must pass along the license terms (or their URL) and the `Required Notice: Copyright 2025-2026 Kisaes LLC` line from the LICENSE file. Do not remove or alter that Required Notice line, and preserve it in any packaging/build artifacts that ship license metadata.
- Official Docker images publish to `ghcr.io/kisaesdevlab/vibe-tb-*` via `.github/workflows/docker-publish.yml`; keep the image license label in that workflow in sync with LICENSE.
- Client-facing access (clients getting their own login to a hosted instance) requires a Commercial License from Kisaes LLC — see `COMMERCIAL_LICENSE.md`.

### Known open issues (see scripts/license-policy.json for detail)
- `buffers@0.1.1` — no license; transitive via exceljs. Do not upgrade exceljs without verifying this resolves.
- Run `./scripts/license-audit.sh` after adding dependencies or before tagging a release.
- Full audit: use `docs/LICENSE-AUDIT-PROMPT.md` with Claude Code before major releases.

## Workflow Rules
- Work autonomously through the full plan before stopping
- After each change, run tests and fix failures before proceeding
- Only stop to ask me if you hit a true ambiguity you can't resolve
- At the end, provide a summary of changes and testing instructions

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
- **Dormant accounts are hidden on reports:** an account with no beginning balance (`prior_year_*`),
  no activity (`unadjusted_*`, `trans_adj_*`, `book_adj_*`, `tax_adj_*` all zero) and therefore no
  ending balance is dropped from every report view, PDF and export. Shared predicate:
  `server/src/lib/tbActivity.ts` (`whereHasActivity` knex modifier + `hasReportableActivity`) and
  `client/src/utils/tbActivity.ts` (`hasReportableActivity` / `filterReportableRows`) — keep the two
  in sync. NOT applied to the editable TB grid, Tax Mapping, COA, JEs or PY Tie-Out: you can't type a
  balance into a row that isn't rendered.
- **Report amounts are signed by `category`, never by `normal_balance`:** use `categoryNet()` /
  `netIncomeContribution()` from `lib/accounting.ts` (client and server copies). `normal_balance` is a
  per-account COA flag the user can set independently of category, so signing by it inverts contra
  accounts and any account whose flag disagrees with its category.
- API routes return: { data, error, meta }
- Named exports, PascalCase components, camelCase utilities, snake_case DB columns

## Key Architecture Decisions
- **AI dual-mode (MIG-1, permanent posture):** mode is `direct|router`, resolved with
  precedence DB setting (`ai.mode` row, admin-set via Settings UI / PUT /settings/ai-mode)
  > `VIBE_AI_MODE` env > `direct`. Router URL/token likewise: `ai.router_url`/`ai.router_token`
  (encrypted) rows > `VIBE_AI_ROUTER_URL`/`VIBE_AI_TOKEN` env (see
  `server/src/lib/aiModeSettings.ts` + `routerConnection()` in routerProvider.ts). `router`
  sends ALL AI traffic through the appliance's Vibe AI Router via
  `server/src/lib/routerProvider.ts` (`RouterLLMProvider` behind `getLLMProvider()`); every
  provider/model setting in the DB is then inert and the Settings UI shows a managed-by-router
  banner. Boot refuses env-set `router` without env URL+token; a DB-set mode must never brick
  boot (load failures only log). Mode switches are explicit only: admin-confirmed in the UI,
  router health-checked BEFORE persisting, audit-logged. NEVER add a silent fallback from
  router to direct — it would ship prompts around the router's scrubber and ledger. Every AI call site
  must pass `taskClass` (see `TB_TASK_CLASSES`); the router driver fails closed without it.
  `server/src/lib/vibeAiClient.ts` is VENDORED from the router repo — don't edit in place.
  Tests: `npm run test:router` (server/).
- Trial Balance Grid = editing balances ONLY, no category subtotals
- Tax Mapping View (Plan Phase 5) = SEPARATE page: assign tax codes, read-only balances, category subtotals, net income, balance check
- tax_line VARCHAR on chart_of_accounts: legacy field kept for compat. New system uses tax_code_id FK → tax_codes table. Dual-write: when tax_code_id assigned, also write tax_code string to tax_line.
- activity_type on clients: business / rental / farm / farm_rental (added Plan Phase 4)
- PDF strategy: server-side pdfmake (Plan Phase 6). All browser window.print() replaced with download/preview PDF endpoints.
- Tax codes: two tables — tax_codes (canonical) + tax_code_software_maps (per-software UltraTax/CCH/Lacerte/GoSystem/Generic)

## Phase Numbering
Canonical phases from NEXT_PHASE.md (master plan). App-only features built before plan adoption are tracked separately.

## Current Phase
All planned phases complete. App is feature-complete.

## Completed — Plan Phases
- Plan Phase 1: Foundation — Auth, Clients, Chart of Accounts, Periods
- Plan Phase 2: Trial Balance Grid — inline editing, keyboard nav, v_adjusted_trial_balance view, CSV import
- Plan Phase 3: Journal Entries — Book & Tax AJEs, balance validation, filter by type
- Plan Phase 4: Tax Code Management — tax_codes + tax_code_software_maps tables, 500+ seeded codes (1065/1120/1120S/1040/common), full CRUD API, TaxCodesPage (admin) with software mappings, CSV import/export; activity_type on clients
  - System tax codes are **numeric only** and live in migrations (crosswalk set from `20260321000007` on). The legacy alpha seed files (`seeds/004–006`) were deleted and migration `20260817000002` purges any alpha system codes they left behind (they duplicated every line). `88888` = reporting only / no mapping (was `REPORTING_ONLY`). The same cleanup is available on demand via `server/src/lib/legacyTaxCodes.ts` (Settings → Tax Code Cleanup; `GET/POST /tax-codes/legacy-alpha/{status,purge}`, admin) — keep it in sync with the migration. Never re-add alpha system codes.
- Plan Phase 5: Tax Mapping View — TaxMappingPage (separate page): account table with tax code dropdowns, progress bar, category subtotals, net income row, balance sheet check, optimistic updates with flash; dual-write COA PATCH (tax_code_id → also sets tax_line for compat)
- Plan Phase 6: PDF Report Generation — pdfmake server-side PDFs for all 8 report types, PdfTemplateService (Roboto fonts, branded header/footer, formatCents), 8 PDF endpoints; client PDF buttons replace window.print() on all report pages
- Plan Phase 7: Financial Statements — Tax-Basis P&L (income/expense grouped by tax code AND category — a code holding both, e.g. 88888, splits into "code — Revenue"/"code — Expenses" so subtotals don't add revenue and expenses together; sort_order, per-code subtotals, net income), Tax Return Order (all accounts in tax return order with category filter); PDF + frontend for both; IS/BS/CashFlow already complete from prior phases
- Plan Phase 8: Multi-Period Comparison — comparison API (GET /periods/:id/compare/:compareId) with book-adjusted variance rows; per-account variance notes (PUT with compare_period_id); Flux Analysis PDF; MultiPeriodPage with category grouping, $ and % variance, significance threshold highlighting, inline note editing; added to Reports group in sidebar
- Plan Phase 9: Exports — UltraTax/CCH/Lacerte/GoSystem/Generic CSV+Excel exports, Working TB Excel export, Bookkeeper Letter PDF, ExportDialog with pre-export validation (unmapped accounts, out-of-balance check), ExportsPage under Reports sidebar group
- Plan Phase 11: AI Tax Line Auto-Assignment — POST /tax-lines/auto-assign (5-step waterfall: existing→prior-period→cross-client→AI→unmappable), bulk-confirm with dual-write, GET patterns endpoint, AssignmentPreviewModal with confidence color coding and override dropdowns, "Auto-assign Tax Codes" button wired to TaxMappingPage
- Plan Phase 13: Smart CSV Import — document_imports migration, POST /import/csv/analyze (AI column mapping + account matching), POST /import/csv/confirm (upsert TB rows), CsvImportDialog with drag-and-drop, confidence-coded preview table, "Import from CSV" button on TrialBalancePage
- Plan Phase 14: PDF Import with AI Extraction — pdf-parse installed, POST /import/pdf/analyze (text extraction → Claude AI extraction), POST /import/pdf/confirm, PdfImportDialog with consent dialog, "Import from PDF" button on TrialBalancePage
- Plan Phase 15: PDF Verification Engine — POST /import/pdf/verify (AI line-by-line comparison), GET verify/:importId (cached), GET imports?periodId, VerificationPanel component on TrialBalancePage showing match/discrepancy detail
- Plan Phase 16: Document Storage — client_documents CRUD API, file storage in server/uploads/, DocumentsPage with drag-and-drop upload, download, delete, link-to-account/JE modal
- Plan Phase 17: Backup & Restore — backup_history + restore_history migration, .tbak ZIP archives (full/settings/client/period), ID-remapping restore engine (as_new/replace/settings modes), nightly node-cron scheduler, BackupPage with history table and restore upload UI
- Plan Phase 18: Polish & Integration — audit_log viewer page (admin only, paginated, filterable), deploy scripts (setup-pi.sh, deploy.sh, nginx.conf, ecosystem.config.js)
- Plan Phase 23: AI Support Chat — support_conversations + support_messages tables, SSE streaming chat endpoint, knowledge base (16 .md files in server/knowledge/), ChatBubble floating widget, SupportPage with conversation history and bookmarks
- Plan Phase 24: COA Template Management — coa_templates + coa_template_accounts + coa_template_tax_codes tables, 7 system templates seeded (General Business/Retail/Restaurant/Professional Services/Real Estate/Construction/Farm), full CRUD API (from-client, apply merge/replace, CSV import/export), CoaTemplatesPage with System/Custom tabs and apply modal
- Plan Phase 25: Manual Transaction Entry Register — bank_transactions.entry_source column (migration Batch 26), GET /clients/:id/payees + /search + /:payee/categories endpoints, POST /bank-transactions/manual (batch with rule upsert + JE sync), TransactionEntryPage with spreadsheet-style register, smart payee combo dropdown, smart category select (previously-used section), stat cards (debits/credits/net), unsaved row tint, duplicate/delete row actions, "Transaction Entry" added to Bookkeeping sidebar group
- Scanned-sheet import (Transaction Entry) — `POST /import/scanned-sheet/analyze` (`server/src/routes/scannedSheetImport.ts`): renders each PDF page (poppler), one `aiComplete` per page with `TB_TASK_CLASSES.DOC_EXTRACT` (vision), returns rows with per-row confidence + `uncertain` fields plus 100-dpi JPEG page previews; falls back to OCR text / PDF text layer / 422 `SCANNED_PDF` like the bank-statement route. `POST /import/scanned-sheet/categorize` = second pass with `TB_TASK_CLASSES.CLASSIFICATION` (same COA + rules prompt shape as bank ai-classify; returns per-row account suggestions, nothing written). Client: `ScannedSheetImportDialog` (side-by-side page image + editable rows; free-text payee = the transcription verbatim (known payees only suggested, never substituted); `utils/matchPayee.ts` for payee→category, AI fills the rest and never overwrites hand-set categories), `insertImportedRows` in `TransactionEntryPage` drops accepted rows in as unsaved rows — nothing is written until the register's Save.
- MCP Integration — @modelcontextprotocol/sdk; HTTP/SSE transport at /mcp/sse + /mcp/messages (mcpAuthMiddleware, Bearer MCP token); stdio transport at server/src/mcp-stdio.ts for Claude Desktop; mcp_agent system user (migration 20260320000001); 8 Resources, 18 Tools (list/get/update across clients/periods/TB/JE/COA/tax/diagnostics/engagement/comparison/reports), 5 Prompts; rate limiting 100 req/min; audit_log for all tool calls; Settings page MCP card (admin) with token generate/rotate/revoke + stdio/HTTP snippet tabs; "MCP Integration" link in sidebar

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
- Workpaper Package + Tickmarks (tickmark_library + tb_tickmarks, TB superscripts + legend).
  PDF report options live in `PDF_REPORT_SECTIONS` (WorkpaperPackagePage) and `REPORT_GENERATORS`
  (routes/pdfReports.ts) — keep ids and labels in step. That array's order is binder order: it drives
  both the checkbox list and the merge sequence, and the Workpaper Index leads. `workpaper-merged`
  prepends a generated Table of Contents (`generateWorkpaperTocPdf`) listing each selected report and
  its page range in the merged file; the TOC counts itself as page 1, so the route rebuilds it if its
  own length changes the numbers.
- Variance notes (per account per period, TB Report inline editing)
- QA Round 1 & 2: 30-item UX audit — period lock enforcement on TB grid, batch op toasts,
  reopen reconciliation feedback, engagement double-submit prevention, FS comparative layout,
  Spinner component, consistent error/success box styles, sidebar workflow ordering,
  demo seed data (003_demo_client.js — Demo Company LLC FY2024)
- QA Round 3: TB AJE column balance fix (ensureTrialBalanceRows helper + backfill migration), bank transaction source account column reorder, Excel import support on TB (exceljs buffer-to-CSV), New JE button on TB grid, JE edit dialog from GL and TB zoom views, AI stop_sequences fix, AI JSON extraction try/catch, LLM provider whitespace stop-sequence filtering, TB Report column visibility toggles (view/PDF/Excel), Financial Statements variance % column + wider layout + consistent column colors, Tax Code column read-only on TB grid, date format cleanup (remove time), font size consistency audit across all report pages, dark mode audit (27 fixes across 9 files), bank statement PDF import (vision + text fallback, account number masking), PII protection (client name removal from AI prompts, account number masking, AI data disclosure consent popups on all 6 AI features), bookkeeper letter preview auth fix, knowledge base updates
