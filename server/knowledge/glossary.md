# Glossary

## AJE (Adjusting Journal Entry)
A journal entry used to adjust account balances. See also Book AJE and Tax AJE.

## Activity Type
A classification of the client's business activity that affects which tax codes are suggested during AI auto-assignment. Values: business, rental, farm, farm_rental.

## Audit Log
A permanent, append-only record of all write operations in the system — who did what, when, and to which record. Accessible at Admin > Audit Log (admin only).

## Book Adjustment
A journal entry that affects the book (GAAP/accrual) trial balance. Book adjustments show up in financial statements. Entry type = 'book'.

## Book-Adjusted Balance
The trial balance balance after applying all book AJEs. Computed from the `v_adjusted_trial_balance` database view — never stored directly.

## Classification Rule
A pattern-matching rule that automatically assigns an account category to bank transactions. Rules match on payee name, amount range, or transaction type, in priority order.

## COA (Chart of Accounts)
The master list of accounts for a client. Each account has a number, name, category, and normal balance direction. The COA is shared across all periods for a client.

## Confidence Score
A percentage (0–100%) indicating how certain the AI is about a suggested classification or tax code assignment. Scores above 85% are considered high-confidence and highlighted in green.

## Current Period
The period marked as the default active period for a client. When you navigate to a work page, the current period is pre-selected. Only one period per client can be current.

## Dual-Write
When a tax code is assigned, the system writes both the `tax_code_id` FK (new system) and the legacy `tax_line` VARCHAR field. This ensures compatibility with both new exports and older export formats.

## Engagement Checklist
A per-period task list used to track the work steps required to complete an engagement (data collection, review, tax mapping, final sign-off, etc.).

## Entity Type
The tax form type for the client:
- **1040**: Individual (Schedule C, E, F)
- **1065**: Partnership
- **1120**: C Corporation
- **1120S**: S Corporation

## Flux Analysis
A comparison of balances between two periods showing the change in dollars and percentage. Used to explain significant variances in audit or review engagements. The Flux Analysis PDF includes variance notes.

## Import Deduplication
When importing bank transactions, each transaction is fingerprinted with a SHA-256 hash. If the same transaction is imported again (same file or overlapping date range), it is automatically skipped. This prevents duplicate entries.

## LLM Provider
The AI backend that powers all intelligent features in the app. Three providers are supported: **Claude** (Anthropic cloud API), **Ollama** (self-hosted local models), and **OpenAI-compatible** (any server implementing the OpenAI chat completions API, such as vLLM or LM Studio). Configured at Admin > Settings > AI Provider.

## Lock (Period Lock)
A flag on a period that prevents any further edits to the TB, journal entries, or bank transactions. Only admins can lock or unlock a period. Locking requires the TB to be in balance.

## M-1 Adjustment
A book-to-tax difference documented on Schedule M-1 of tax returns. In the app, M-1 adjustments are created by posting Tax AJEs in Journal Entries, or manually entered in the Tax Worksheets page.

## MCP (Model Context Protocol)
An open standard from Anthropic that lets Claude Desktop connect directly to the app. Once connected, Claude can read data and take actions (run diagnostics, assign tax codes, create journal entries, etc.) on your behalf.

## MCP Agent
The `mcp_agent` system user created by the MCP migration. All actions taken via an MCP (Claude Desktop) connection are attributed to this user in the audit log. It cannot log in through the web UI.

## Ollama
A self-hosted AI model runner. Install it on any machine (including Raspberry Pi), pull models locally, and point the app at its URL. All data stays on your network. The app communicates with Ollama via its OpenAI-compatible API at `http://<host>:11434/v1/chat/completions`.

## Normal Balance
The direction of balance (Debit or Credit) that increases an account. Assets and Expenses normally have debit balances. Liabilities, Equity, and Income normally have credit balances.

## OFX
Open Financial Exchange — a standard file format used by most banks for exporting transaction history. The preferred import format for bank transactions.

## Payee
The name of the other party in a bank transaction (vendor, customer, etc.). The app tracks payee history to power the smart payee dropdown in Transaction Entry and to build classification rules.

## Period
A fiscal reporting period for a client (e.g., FY2024, Q1 2024). Each period has its own TB balances, journal entries, and reports. Periods can be locked to prevent edits.

## Prior Year (PY) Balance
A balance column imported via **Import PY** on the Trial Balance page. PY balances appear alongside current year balances for comparison and are used in financial statement comparative columns and flux analysis.

## Reconciliation
The process of matching the bank account balance in the app against the bank statement. A completed reconciliation confirms that all transactions are accounted for with no unexplained differences.

## Roll-Forward
The process of creating a new period by copying configuration (COA, tax code assignments, tickmarks) from a prior period. The new period starts with zero TB balances, and the source period's ending balances become the new period's Prior Year comparison column.

## Sort Order
A numeric field that controls the display order of tax codes in tax-return-ordered reports. Lower numbers appear first. Tax codes are sorted by sort_order within each category.

## Tax Adjustment
A journal entry that represents a book-to-tax difference. Tax adjustments affect the tax-adjusted TB but not book balances. Entry type = 'tax'. These populate the M-1 worksheet.

## Tax-Adjusted Balance
The trial balance balance after applying all book AJEs and all tax AJEs. This is the taxable balance used in tax exports.

## Tax Code
A structured reference to a specific line on a tax form (e.g., "1065-L1" = Form 1065, Line 1 Gross Receipts). Tax codes have canonical records in the `tax_codes` table and software-specific mappings for UltraTax, CCH, Lacerte, GoSystem, and Generic.

## Tax Line
The legacy VARCHAR field on the chart of accounts (`tax_line`) that stores a text reference to the tax form line. Now supplemented by `tax_code_id` FK. Kept for backward compatibility with older export formats.

## TB (Trial Balance)
A list of all account balances for a specific period. Total debits must equal total credits. The app distinguishes:
- **Unadjusted TB**: imported or manually entered balances
- **Book-Adjusted TB**: after book AJEs
- **Tax-Adjusted TB**: after both book and tax AJEs

## System Tickmarks
Firm-wide default tickmark symbols managed by administrators at Admin > Default Tickmarks. These can be copied into any client's tickmark library using the **Load Defaults** button on the client's Tickmarks page. The system ships with 12 pre-seeded defaults (A through T, plus check mark and dagger).

## Tickmark
A color-coded symbol applied to a TB account to indicate that a specific audit or review procedure was performed. Tickmarks appear in the TB grid and on TB Report PDFs with a legend.

## Transaction Entry Register
A spreadsheet-style screen for manually entering bank transactions in bulk. Features a smart payee dropdown that pre-fills the account based on the payee's history. Access: Bookkeeping > Transaction Entry.

## Variance Note
A text explanation added to an account in the Period Comparison view explaining why a balance changed between periods. Notes appear on the Flux Analysis PDF.

## Vision Mode
A PDF import mode used for scanned documents that have no text layer. The app renders each page to a PNG image using `pdftoppm` and sends the images to a vision-capable AI model for extraction. Requires: (1) a vision-capable model (Claude, or an Ollama/OpenAI-compat model with vision), and (2) `poppler-utils` installed on the server.

## Workpaper Package
A bundled PDF containing multiple selected reports (TB report, financial statements, AJE listing, etc.) for client delivery or engagement file archiving.

## Workpaper Ref (WP Ref)
A short reference string (e.g., "A-1", "TB-5") that links an account or journal entry to a physical or digital workpaper. Appears in the TB grid, TB Report, and Workpaper Index.
