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
  (authoritative `v_adjusted_trial_balance` definition: `migrations/20260828000002_tb_view_lead_sheet.js` —
  a migration adding a column must copy THAT SQL, and must LEFT JOIN or it drops unassigned accounts)
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
  **Keep any one HTTP request's AI work short.** There is a ~100s proxy timeout in front of the
  router; exceed it and the caller gets a 524 with no error from us. Never size one call at
  rows × tokens over an unbounded row count — batch server-side AND let the client page through.
  Both are done for csv+pdf `suggest-numbers` (`SUGGEST_BATCH_SIZE` / `SUGGEST_CHUNK_SIZE`, with
  `reservedNumbers` passed forward so chunks don't hand out the same number) and for
  `POST /tax-lines/auto-assign` (`AUTO_ASSIGN_CHUNK_SIZE` in TaxMappingPage pages by `accountIds`).
- **One task class per major AI step** (`TB_TASK_CLASSES` in `lib/routerProvider.ts`), so the router
  carries a separate sensitivity policy and model choice for each. Adding a step means adding a
  class AND declaring it in `registerTbTaskClasses()`; the router test asserts the declared set and
  the constants are identical, so neither can drift. Steps reached from two entry points share one
  class: account numbering and import chat are each driven from both the CSV and PDF dialogs, but
  send the same shape of data, so splitting them would be two knobs for one decision.
  A class the router has not seen before **starts local_only** until the operator widens it.
  The old catch-alls were retired in v0.1.13 — carry their policy across per step:
  | was | now |
  | --- | --- |
  | `tb_classification` | `tb_csv_analyze`, `tb_account_numbering`, `tb_import_chat`, `tb_bank_classify`, `tb_scanned_sheet_classify`, `tb_tax_code_assign` |
  | `tb_doc_extract` | `tb_pdf_extract`, `tb_pdf_verify`, `tb_scanned_sheet_extract`, `tb_import_chat` |
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
  **Journal-report pages:** the extractor prompt has a `JOURNAL REPORTS` rule and a page-level `layout`
  (`'sheet' | 'journal'`); on a journal page each ENTRY becomes one row carrying `accountRef` /
  `sourceAccountRef` *as printed*, signed from the bank account's point of view. Resolution against the
  COA happens in the dialog (`utils/matchAccountRef.ts`: number, then exact name, then a containment
  match only when unique — a wrong account is worse than an empty one); a resolved category is
  `categorySource: 'journal'`, which the AI categorize pass never touches (not even "re-suggest all"),
  and a resolved bank line overrides the dialog's single source account for that row. The route pushes
  a per-page warning so a journal page is never silently different from a sheet page.
  **Tabular sheets:** the prompt's TABLES rule makes a printed Total Paid / Paid To / Description /
  Category page read as a normal sheet — the Paid To cell IS the description (an empty Description
  column once made every row blank and thus unpostable), and the sheet's own category column comes
  back verbatim as `categoryHint`, resolved via `matchAccountRef` (`categorySource: 'sheet'`, weaker
  than payee/journal — force re-suggest may replace it) or fed to the categorize pass as context.
- **Register drafts survive navigation** (`store/registerDraftStore.ts`, persisted as `register-drafts`,
  keyed `clientId:periodId`). `TransactionEntryPage` mirrors every unsaved non-blank row into it on
  change — but only after the seed effect has run, or the empty initial list would wipe the draft it
  is about to restore — and the seed effect appends the stored rows after the saved ones with a toast.
  Still nothing is written until Save; a `beforeunload` guard covers tab close. The register's saved-row
  query pages through the API (`pageSize: 500`, up to 40 pages) because the API is newest-first and the
  default single page of 100 silently dropped the OLDEST rows of a busy period.
- MCP Integration — @modelcontextprotocol/sdk; HTTP/SSE transport at /mcp/sse + /mcp/messages (mcpAuthMiddleware, Bearer MCP token); stdio transport at server/src/mcp-stdio.ts for Claude Desktop; mcp_agent system user (migration 20260320000001); 8 Resources, 18 Tools (list/get/update across clients/periods/TB/JE/COA/tax/diagnostics/engagement/comparison/reports), 5 Prompts; rate limiting 100 req/min; audit_log for all tool calls; Settings page MCP card (admin) with token generate/rotate/revoke + stdio/HTTP snippet tabs; "MCP Integration" link in sidebar

## Completed — App-Only Features (built before plan adoption, kept and maintained)
- Bank Transactions + AI Classification (OFX/CSV import, AI classify, rules, batch ops, source accounts, import dedup via SHA-256 hash, reclassify audit trail, pagination, sort_order priority)
- Financial Statements (IS, BS, Statement of Equity — CY+PY comparative columns, Change column, header skeleton)
- Cash Flow Statement (indirect method, account mapping config)
- TB Report, General Ledger, Tax Code Report, Workpaper Index, AJE Listing (browser-print — migrating to pdfmake in Plan Phase 6)
- Period Controls + Audit Trail + Dashboard (locking with TB balance check, admin-only unlock, roll-forward copies tickmarks)
- User Management (admin CRUD)
- COA import from CSV with column mapping, copy-from-client
- **Every file-import preview has a per-row include checkbox** so rows can be left out before
  committing: CsvImportDialog / PdfImportDialog (ticking off sets the row's `action` to `'skip'`,
  the same flag the AI puts on headers/subtotals and the server already drops on confirm; the
  pre-skip action is remembered so re-ticking restores it), ChartOfAccountsPage ImportModal
  (`excluded` index set; rows with parse errors are never tickable), plus the checkboxes that
  already existed on BankStatementPdfImportDialog, ScannedSheetImportDialog and the PY tie-out
  dialogs. Preview tables must render every row — you can't untick what isn't drawn.
- TB Import (current + prior year), PY comparison columns
- **PY Tie-Out AJE direction:** the rolled PY (this app's final prior year, AJEs included) is the
  truth and the upload is the bookkeeper's opening balance, so the entry's sign is **rolled − uploaded**
  — the OPPOSITE of the Variance column (uploaded − rolled). `AjePanel` preview and
  `POST .../py-comparison/create-aje` both do this and must stay mirrored. It shipped reversed once.
- **TB grid has FOUR fixed leading columns** (Acct #, Name, Cat., LS) — `FIXED_COLS` in
  `TrialBalancePage.tsx` drives every leading `colSpan` (group header row + subtotal/total rows, both
  view modes). Adding a leading column means bumping that constant, not hunting literals. The
  Single / PY / Tax toggles are `tbView` in the persisted `ui-prefs` store, not component state.
- **Import preview shows the type the confirm writes.** Every match row leaves `/import/{csv,pdf}/analyze`
  (and the chat's `revisedAnalysis`) with `newCategory`/`newNormalBalance` filled by
  `fillNewAccountType()` in `server/src/lib/accountTypeInference.ts`; the confirm falls back to the
  SAME `inferAccountType()`. Before this, the preview displayed a `'expenses'` placeholder while the
  confirm inferred from the account number, so a row read Expense on screen and landed as an Asset.
  Inference is by **leading digit** (1/2/3/4 → assets/liabilities/equity/revenue, 5–9 expenses),
  never a numeric range — `10100` is not `< 2000`. Name keywords only when there is no digit.
- **COA bulk edit** — `POST /clients/:id/chart-of-accounts/bulk-update` (`bulkUpdateColumns()` in
  `routes/chartOfAccounts.ts`, tested). Checkbox column + shift-click range on ChartOfAccountsPage,
  `BulkEditModal` with an opt-in tick per field (category, normal balance, subcategory, unit, tax
  code, lead sheet); unticked fields are never sent, an empty ticked text field clears. Selection
  persists across filter changes and the bar reports how many selected rows are hidden. One audit
  row per account. Number/name are deliberately not bulk-editable.
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
- **Lead Sheets** (`lead_sheets` + `chart_of_accounts.lead_sheet_id` + `lead_sheet_signoffs`).
  One lead sheet per account; membership **persists across periods** because it lives on the COA row,
  so roll-forward carries it with no code and `keepWorkpaperRefs: false` must NOT clear it (a W/P ref
  is a per-year annotation, a lead sheet is structure). Seeded A–O from `DEFAULT_LEAD_SHEETS` in
  `server/src/lib/leadSheets.ts`, but **letters are data, not code** — users rename/reorder/delete/add
  them and `suggestLeadSheet()` returns a *code* the route resolves against the client's own rows.
  That constant's array order is **display** order; a separate `specificity` field drives
  first-match-wins, because this app's `category` has five values where MyBooks had nine (K/N share
  `revenue`; L/M/O share `expenses`). Signals are category + account-name keywords + the
  **leading digit** of the account number (never a numeric range — templates are 5-digit, seeds are
  4-digit). Two traps pinned by tests: rule O must not read `subcategory` (hundreds of template
  accounts carry `subcategory = "Other Expenses"` while being ordinary operating expenses), and its
  name test must be **anchored** (`Car & Truck Other Expenses` is an operating expense; `Other
  Expenses` is not). Auto-assign is **re-runnable** with a preview/confirm modal (default
  `unassigned_only`, so a re-run never stomps a hand-set assignment), not MyBooks' seed-once.
  `copy-from-client` remaps lead sheets **by code**, never by id.
  Sign-off: `preparer`/`reviewer`, **anyone may sign either line — no role gate, no order gate, no
  preparer→reviewer cascade**; a partial unique index `(lead_sheet_id, period_id, role) WHERE
  invalidated_at IS NULL` enforces one live signature per slot and unsign is soft. Staleness is a
  **SHA-256 content hash** of the members' raw TB amounts (`leadSheetBalanceStamp`), not a timestamp —
  a timestamp misses JE deletion (which *lowers* max(updated_at)) and goes false-positive on restore.
  Every stamp producer must use `loadStampRows()` in `lib/leadSheetStamp.ts` (`is_active` only, **no**
  `whereHasActivity`) or the PDF and the screen will disagree. Sign-off **warns, never blocks** —
  balances stay editable and the sheet just goes STALE. The Lead Sheets PDF sits between
  `pdf-wp-index` and `pdf-tb` in both binder arrays.
- **Document storage (pluggable: local disk or Backblaze B2)** — `server/src/lib/storage/`
  (`paths.ts` / `keys.ts` / `localDriver.ts` / `b2Driver.ts` / `sentinel.ts` / `index.ts`), ported from
  Vibe Time & Billing. Resolution is **settings row > env > local**, memoised like `mailService.ts`
  with `invalidateStorageCache()` — credentials are NEVER written into `process.env`. B2 being
  misconfigured is **not** a boot failure (it would brick an appliance over an optional feature): it
  surfaces as `configError`, writes fail 503, reads of existing rows still work.
  **`getStorageDriverFor(backend)` is load-bearing** — reads route by *the row's* `storage_backend`,
  writes by *current* config, so a B2 row keeps working after an admin flips back to local and a
  legacy row keeps working after B2 is switched on. A row with `object_key IS NULL` is LEGACY and is
  read from its absolute `file_path`; never rewrite those implicitly.
  B2 quirks that are load-bearing, each commented at its site: `CopySource` must encode **each path
  segment separately** (`encodeURIComponent` turns `/` into `%2F` and every nested key 404s);
  HEAD on a missing key throws; ETags come quoted and are **not** content hashes (hence the separate
  `sha256` column); the health probe leads with `list()` because a HEAD carries no response body and
  the SDK degrades to a bare `UnknownError`. Operators must set the bucket lifecycle to
  "keep only the last version" — that is B2-native, not settable over S3.
- **Client ↔ folder linking with sentinels** (`client_folder_links` + `lib/clientFolders.ts`).
  Linking is **explicit**: no auto-create, and an upload for an unlinked client is refused with
  `CLIENT_NOT_LINKED`. Identity lives in `<folder>/_Vibe/client.json`, **not the path**, which is what
  lets a folder renamed in the B2 console be re-bound by Verify instead of orphaning every key
  (`clients.name` has no unique index, so the sentinel is also what tells two same-named clients
  apart). `install_id` replaces the reference's `firm_id` — this app is single-tenant. `client_id`
  and `install_id` are immutable through `updateSentinel` (type + runtime throw + re-pin).
  **Storage write comes BEFORE the DB commit** everywhere: a failed DB write leaves an orphan
  sentinel a later verify adopts; the reverse loses the binding. Migration `20260828000004`
  **backfills a legacy link for every existing client**, or requiring a link would make every current
  client un-uploadable on upgrade.
  Key layout is `<prefix>/<client folder>/<Section>/<year>/<file>` — section BEFORE year — which for
  the shipped defaults reads `Clients/Jack Black LLC/Workpapers & Support/2025/file.pdf`. Both the
  client-folder and year patterns are **settings**, not constants (`storage.client_folder_format`,
  default `{name}`, placeholders `{name}`/`{code}`/`{id}`; `storage.year_format`, default `{year}`);
  each is rejected at the route unless it actually places its required placeholder, and that check
  runs BEFORE any `upsertSetting`, since those start their query the moment they are called.
  `{code}` is `clients.client_code` — the firm's own client number, the same idea as Vibe Time &
  Billing's `tax_software_id`; a pattern like `{code} - {name}` tidies its own seams when a client has
  no code. The fiscal year comes from `periods.folder_year` when set, otherwise from
  `periods.end_date` adjusted by `clients.tax_year_end`, never from `period_name` (free text a user
  can rename). `folder_year` exists because derivation cannot know about a short year, a stub period
  or a firm's own naming. Sections come from the editable `storage_folder_template` (seeded as the
  single `Workpapers & Support`), with partial unique indexes enforcing exactly one workpaper target
  and one upload default. Keys are STORED, never re-derived, so renames move nothing.
- **Lead sheet attachments** (`lead_sheet_attachments`) — auto-named `A001`, `A002`, `B001`,
  **period-scoped** so a 12/31 file never surfaces in a 7/31 package. `UNIQUE (period_id, ref_code)`
  is the allocator's source of truth, not the SELECT; a 23505 triggers a compensating object delete
  and a retry. **Deleting an attachment leaves a TOMBSTONE** (`deleted_at`, `document_id` SET NULL) so
  its ref code is never reissued — a reissued code would collide with one already printed in a
  binder. `nextRefCode` therefore counts tombstones too. PDF, PNG and JPEG are accepted; images are
  converted to PDF on upload so every attachment stays stampable and mergeable.
  **Tickmark stamps are BURNED INTO the stored PDF**, not applied at download, because the bucket is
  browsable and an archive whose marks live only in the app is not an archive. The accepted
  consequence is that a stamp **cannot be removed** — the viewer confirms before placing and offers no
  delete. Only the NEW mark is drawn each time (re-drawing would double-ink). **pdf-lib's
  StandardFonts cannot encode the seeded `✓` (U+2713) and throw**, so a real TTF is embedded via
  `@pdf-lib/fontkit`, reusing the `ROBOTO_MEDIUM` buffer exported from `PdfTemplateService` — there is
  a test pinning that StandardFonts genuinely throws on `✓` but not on `†`.
  **But pdfmake's Roboto has no `✓` glyph either, and THAT failure is silent** — fontkit maps an
  unsupported code point to `.notdef`, which has a width and draws a hollow box, so `drawText` and
  `widthOfTextAtSize` both succeed while the stamp comes out as an empty rectangle. Coverage is
  therefore checked against `font.getCharacterSet()`, never by "it didn't throw", and anything Roboto
  lacks falls back to **ZapfDingbats** (a standard PDF font: `✓ ✔ ✗ ✘`, nothing embedded), then to
  `?`. The ZapfDingbats encodability probe runs against a module-level scratch document, because
  `embedFont` writes the font out at save whether or not anything drew with it. Notes stay in Roboto
  with per-character substitution — one stray glyph must not cost the preparer's whole note.
  **Three annotation kinds share one endpoint and one burner** (`POST .../annotations`,
  `burnAnnotation`): `tickmark` (library symbol + optional caption), `note` (free text ≤ 500 chars,
  drawn in a bordered box whose top-left is the click point, wrapped by `wrapText` and slid back
  onto the page near an edge; optional `widthPct` — a fraction of page width set by drag-drawing a
  box in the viewer — overrides the 220pt default that could lie across page text, and old records
  without it keep that default) and `line` (start/end as page fractions, `strokeWidth` in points,
  drag-to-draw in the viewer with an SVG preview overlay). The `annotations` jsonb is a
  discriminated union on `kind`; a record **without `kind` is a tickmark** (rows written before
  notes/lines existed), and the route's `z.preprocess` defaults a missing `kind` for the same
  reason — a `.default()` on the literal would not, because `discriminatedUnion` dispatches on the
  raw input before defaults apply. Notes and lines carry their own `color` from the tickmark
  palette; a tickmark's colour is snapshotted from the library row. All three are permanent.
  An attachment carries an optional `account_id`, so it hangs off **one row of the schedule** — the
  paperclip in each member row's Files cell — or off the schedule as a whole when it is null. The
  sheet-level Supporting files panel lists both, labelling the per-account ones with their account
  number; it is the index, not a second store.
  The workpaper binder can optionally merge attachments (`?includeAttachments=1`, default off), and
  `POST .../workpaper-merged/save` writes the same bytes into the client's workpaper folder.
  `buildWorkpaperPackage` in `lib/workpaperPackage.ts` is the single path both use.
  **pdfjs-dist is double-lazy** (React.lazy + dynamic import inside the effect) — a top-level import
  would add ~1 MB to the initial bundle. Its `?url` worker module is a `.js`, which is what lets
  `deploy/web-entrypoint.sh` rewrite the `__VIBE_BASE_PATH__` sentinel in it; the worker that shim
  points at is a **`.mjs`**, and nginx's bundled `mime.types` has no entry for that extension, so it
  falls through to `default_type application/octet-stream` and the browser refuses to execute the
  module ("Failed to fetch dynamically imported module"). Both nginx configs therefore carry a
  `location ~ \.mjs$ { default_type application/javascript; }` — as a LOCATION, because a
  `types { ... }` block at server level replaces the whole inherited table instead of adding to it.
  Fixing the server was **not enough**, because a browser that cached the bad response keeps its
  stored Content-Type forever: the entry revalidates with `If-Modified-Since` and a 304 carries no
  Content-Type to replace it with. So `LeadSheetPdfViewer` no longer hands pdfjs that URL at all —
  it fetches the worker, re-wraps the bytes in a `Blob` and sets `workerSrc` to the blob: URL, which
  makes the server's label irrelevant. Keep both: the nginx block is what a fresh browser needs, the
  blob is what an already-poisoned one needs. Note also that pdf.js memoizes its fake-worker
  fallback per page load (`PDFWorker._setupFakeWorkerGlobal`), so ONE failure disables the real
  worker for the whole session — a reload is required, and any test of this needs a fresh page.
  `location = /index.html { add_header Cache-Control "no-store" always; }` in both configs is the
  matching rule for the entry point: with no header at all a browser invents a lifetime from
  Last-Modified and can run a previous deploy's bundle for days.
- **Lead schedule notes** (`lead_sheet_notes`) — the review conversation on a lead sheet. **Per
  period**, unlike membership: a query about the 2024 cash reconciliation says nothing about 2025.
  `account_id` NULL means the note is about the schedule as a whole; set, it is the query on that one
  row (the Notes cell shows `open/total`). Notes are **resolved, never deleted** — a closed query is
  the evidence that review happened, which is the point of a workpaper — and both the page and the
  Lead Sheets PDF print resolved notes greyed rather than dropping them. The PDF renders them between
  the schedule's total row and the sign-off block, so a reviewer signs with the open queries in view.
- **QuickBooks Online connector** (`qbo_connections`, `qbo_oauth_states`, `chart_of_accounts.qbo_account_id`;
  `server/src/lib/qbo/*`, routes `qboIntegration.ts` + `qboImport.ts`; `QuickBooksPage.tsx` (Setup, per-client connections) +
  `QuickBooksSettingsPage.tsx` (Admin group, the Intuit credentials — admin-gated in the page AND on every
  `/settings*` route, so a non-admin never even issues the GET),
  **`['qbo-connections']` is fetched ONLY through `hooks/useQboConnections.ts`** — the key is shared by the
  QuickBooks, TB and PY Tie-Out pages and TanStack caches whichever shape the first page stored; when one
  stored `{rows, meta}` and another a bare array, navigating between them crashed with "x.find is not a
  function". **Intuit's production checklist** (EULA + privacy URLs, host domain, launch/disconnect/
  connect URLs, hosting IP) is covered by `intuitAppUrls()` in `lib/qbo/settings.ts` (shown with Copy
  buttons on the admin page and printed in the setup guide), by the PUBLIC, unauthenticated SPA routes
  `/privacy` and `/terms` (`pages/LegalPage.tsx`, operator named from `GET /api/v1/public/legal`), and by
  `?disconnected=1` on `/quickbooks`. `firm_name`/`firm_address`/`firm_email` are set on Settings → Firm
  identity (`GET/PUT /settings/firm`, `FirmIdentityCard`); the first two had been read by PdfTemplateService
  for every PDF header with no UI to set them. `QboImportDialog.tsx` on the TB page). Read-only, **one company per client** (`UNIQUE(client_id)`
  and `UNIQUE(environment, realm_id)` — two rows for one realm would race on refresh-token rotation).
  **Configuration is UI-only by design** (settings rows `qbo.client_id` / `qbo.client_secret` (encrypted) /
  `qbo.environment` / `qbo.redirect_uri` beat the `QBO_*` env fallbacks; `loadQboConfig()` memoised like
  `mailService.ts`, never throws at boot) and the page's "Setup guide (PDF)" is generated by
  `pdf/qboSetupGuide.ts` so it prints THIS instance's effective redirect URI. The OAuth handoff lives on
  the **states row**, not on `qbo_connections`: the callback consumes the nonce atomically, stores the
  encrypted token payload + realm as *pending*, and redirects to `/quickbooks?pending=<id>` where the
  admin who started it confirms the binding — so a re-auth for an already-connected client never collides
  with `UNIQUE(client_id)`, and a wrong company can be discarded (revoked) without touching the client.
  Binding a **different realm** to a client nulls every `qbo_account_id` on its COA; Disconnect keeps them.
  Matching is deterministic — stored qbo id, then QBO `AcctNum` against `account_number`, else
  create-new typed from `Classification` — and **never by name**; anything ambiguous is an `exception`
  the reviewer resolves. `/preview` stores the raw report + sha256 in `document_imports`
  (`import_type:'qbo'`) and **`/confirm` re-derives every cent from that stored report** — decisions only
  route rows (`applyDecisions`, tested), the browser never supplies amounts. QBO omits zero-balance
  accounts, so the preview lists `absentNonzero` and zeroes them by default. Mounted at `/api/v1/import/qbo`
  so nginx's long `/import/` timeout and the upload/ai-step limiters apply; the VerificationPanel's
  `GET /import/pdf/imports` filters to csv/pdf so a QBO row never reaches it. `startQboKeepalive()`
  refreshes every active connection weekly (Intuit refresh tokens lapse from disuse) and prunes expired
  states; token refresh takes `pg_advisory_xact_lock(hashtext(realm_id))` because Intuit rotates the
  refresh token on every refresh. No AI step and no new `TB_TASK_CLASSES` entry — lead sheets come from
  `suggestLeadSheet()`, tax codes from the existing auto-assign. **`target: 'prior'`** on
  `/preview` reuses the whole flow for the PY Tie-Out: dates from `priorYearRange()`
  (`lib/qbo/priorRange.ts` — the adjacent period's own dates when one exists, else slid back a
  year, leap day → 28th), confirm writes `py_comparison_data` (`source:'qbo'`, replacing the
  period's PY data like `confirm-csv`) instead of `trial_balance`, never zeroes absent accounts,
  and still stamps `qbo_account_id`. The dialog warns that QBO reports the prior year
  **before its close**, so the retained-earnings/P&L offset is expected, not a variance. Backups carry the connection row and
  restore re-inserts it **only into the same client**, with the access token nulled.
- **Backups carry rows, not bytes.** `client_documents` was previously missing from backups entirely
  (it appeared only in `deleteClientData`). On restore, a document row whose client id CHANGED has its
  `object_key`/`bucket`/`file_path` nulled and a `client_folder_links` row is skipped altogether —
  otherwise a restored-as-new client would claim the original's objects and folder, and deleting
  either client's copy would destroy the other's bytes. **This applies to `replace` mode too**, which
  takes an arbitrary `targetClientId` and so cannot assume the archive came from that client; without
  the guard the insert dies on the partial unique index over `(bucket, object_key)`. Restoring into
  the SAME client keeps its keys and its link, which is the whole point of that mode.
- Variance notes (per account per period, TB Report inline editing)
- QA Round 1 & 2: 30-item UX audit — period lock enforcement on TB grid, batch op toasts,
  reopen reconciliation feedback, engagement double-submit prevention, FS comparative layout,
  Spinner component, consistent error/success box styles, sidebar workflow ordering,
  demo seed data (003_demo_client.js — Demo Company LLC FY2024)
- QA Round 3: TB AJE column balance fix (ensureTrialBalanceRows helper + backfill migration), bank transaction source account column reorder, Excel import support on TB (exceljs buffer-to-CSV), New JE button on TB grid, JE edit dialog from GL and TB zoom views, AI stop_sequences fix, AI JSON extraction try/catch, LLM provider whitespace stop-sequence filtering, TB Report column visibility toggles (view/PDF/Excel), Financial Statements variance % column + wider layout + consistent column colors, Tax Code column read-only on TB grid, date format cleanup (remove time), font size consistency audit across all report pages, dark mode audit (27 fixes across 9 files), bank statement PDF import (vision + text fallback, account number masking), PII protection (client name removal from AI prompts, account number masking, AI data disclosure consent popups on all 6 AI features), bookkeeper letter preview auth fix, knowledge base updates
