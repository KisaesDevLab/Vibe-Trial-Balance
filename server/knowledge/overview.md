# Vibe Trial Balance — Overview

## What the App Does
Vibe Trial Balance is a full-featured tax preparation and accounting management suite for small accounting firms. It manages clients, chart of accounts, trial balances, journal entries, bank transactions, tax codes, financial statements, PDF reports, and exports to major tax software. It also supports AI-powered features including bank transaction classification, bank statement PDF import, tax code auto-assignment, AI diagnostics, and direct integration with Claude Desktop via MCP (Model Context Protocol).

## Data Privacy
All AI features show a **data disclosure popup** before processing, listing exactly what data will be sent to the AI provider. Client names are never sent to AI. Bank account numbers are masked to show only the last 4 digits. Use a local LLM (Ollama) for maximum privacy — see the AI Providers article for details.

## Navigation Overview
The sidebar contains these main sections:
- **Dashboard**: Period summary, key metrics, TB balance status
- **Setup**: Clients, Chart of Accounts, Periods, Engagement tasks
- **Bookkeeping**: Bank Transactions, Transaction Entry, Journal Entries, Reconciliations
- **Trial Balance**: TB grid editing, PY Tie-Out, Journal Entries, AJE Listing, Tickmarks
- **Tax**: Tax Mapping, Tax-Basis P&L, Tax Return Order, Tax Worksheets, Tax Code Report, Tax Exports
- **Reports**: Period Comparison, Financial Statements, Cash Flow, General Ledger, TB Report, Workpaper Index, Workpaper Package, Custom Reports
- **Tools**: Documents, AI Diagnostics, Settings, MCP Integration
- **Admin** (admin only): Users, Tax Codes, COA Templates, Backup & Restore, Audit Log

## User Roles
- **Admin**: Full access including user management, tax code administration, backup/restore, audit log, period unlocking
- **Preparer**: Standard access to all client work — TB editing, journal entries, bank transactions, tax mapping, reports
- **Reviewer**: Read-only access for reviewing completed work; cannot edit TB or post journal entries
