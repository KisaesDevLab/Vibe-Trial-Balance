# Vibe Trial Balance — Setup, Installation & Usage Guide

A complete guide to installing, configuring, and using the Vibe Trial Balance application. This covers system requirements, three deployment methods (Windows development, Raspberry Pi, Docker), first-run configuration, and day-to-day usage.

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation](#3-installation)
   - [Windows Development Setup](#31-windows-development-setup)
   - [Raspberry Pi Production Setup](#32-raspberry-pi-production-setup)
   - [Docker Setup](#33-docker-setup)
4. [Configuration](#4-configuration)
   - [Environment Variables](#41-environment-variables)
   - [AI Provider Setup](#42-ai-provider-setup)
   - [MCP Integration (Claude Desktop)](#43-mcp-integration-claude-desktop)
5. [First-Run Walkthrough](#5-first-run-walkthrough)
6. [Usage Guide](#6-usage-guide)
   - [Dashboard & Navigation](#61-dashboard--navigation)
   - [Client Management](#62-client-management)
   - [Chart of Accounts](#63-chart-of-accounts)
   - [Periods](#64-periods)
   - [Trial Balance](#65-trial-balance)
   - [Journal Entries](#66-journal-entries)
   - [Bank Transactions](#67-bank-transactions)
   - [Bank Reconciliation](#68-bank-reconciliation)
   - [Tax Codes & Tax Mapping](#69-tax-codes--tax-mapping)
   - [Financial Statements](#610-financial-statements)
   - [Reports & Exports](#611-reports--exports)
   - [Multi-Period Comparison](#612-multi-period-comparison)
   - [Document Storage](#613-document-storage)
   - [Engagement Management](#614-engagement-management)
   - [Workpaper Package & Tickmarks](#615-workpaper-package--tickmarks)
   - [COA Templates](#616-coa-templates)
   - [Transaction Entry Register](#617-transaction-entry-register)
   - [Custom Report Builder](#618-custom-report-builder)
   - [AI Features](#619-ai-features)
   - [AI Support Chat](#620-ai-support-chat)
7. [Administration](#7-administration)
   - [User Management](#71-user-management)
   - [Settings](#72-settings)
   - [Backup & Restore](#73-backup--restore)
   - [Audit Log](#74-audit-log)
8. [Maintenance & Updates](#8-maintenance--updates)
9. [Troubleshooting](#9-troubleshooting)
10. [Security Checklist](#10-security-checklist)

---

## 1. Overview

Vibe Trial Balance is a self-hosted tax preparation and accounting workpaper application designed for small CPA firms. It manages trial balances, journal entries, bank transactions, tax code assignments, financial statements, and client engagements — with optional AI-powered diagnostics, classification, and PDF import.

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query/Table |
| Backend | Node.js 20, Express, TypeScript, Knex.js |
| Database | PostgreSQL 16 |
| AI (optional) | Anthropic Claude, Ollama (self-hosted), or OpenAI-compatible |
| PDF Generation | pdfmake (server-side) |
| Hosting | Raspberry Pi 5, Docker, or any Linux/Windows server |

**License:** PolyForm Internal Use 1.0.0 — free for personal and internal firm use; distribution is not permitted. See [LICENSE](../LICENSE) for full text.

---

## 2. System Requirements

### Minimum Hardware

| Deployment | CPU | RAM | Storage |
|-----------|-----|-----|---------|
| Development (Windows/Mac/Linux) | Any modern x64 | 8 GB | 2 GB free |
| Production (Raspberry Pi) | Raspberry Pi 5 | 8 GB | 32 GB SD + external SSD recommended |
| Production (Docker/VPS) | 2 vCPU | 4 GB | 20 GB |

### Software Prerequisites

| Software | Version | Purpose | Required? |
|----------|---------|---------|-----------|
| **Node.js** | 20+ (LTS) | Runtime for server and build tools | Yes |
| **npm** | 10+ | Package manager (ships with Node.js) | Yes |
| **PostgreSQL** | 16 | Database | Yes (via Docker or native) |
| **Docker Desktop** | Latest | Runs PostgreSQL in development | Recommended for dev |
| **Git** | 2.40+ | Source code management | Yes |

**Optional software:**

| Software | Purpose |
|----------|---------|
| Ollama | Self-hosted AI (no cloud dependency) |
| poppler-utils | Scanned PDF import (vision-mode extraction) |
| Nginx | Reverse proxy (production deployments) |
| PM2 | Process manager (Raspberry Pi production) |

### Network Requirements

- Port **5173** — frontend dev server (development only)
- Port **3001** — backend API server
- Port **5432** — PostgreSQL
- Port **80/443** — production web access (via Nginx or Docker)
- Port **5050** — pgAdmin (development only, optional)
- Outbound HTTPS to `api.anthropic.com` if using Claude AI features

---

## 3. Installation

### 3.1 Windows Development Setup

#### Option A: Automated Setup (Recommended)

Open **PowerShell as Administrator** and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

If you haven't cloned the repository yet:

```powershell
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git
cd Vibe-Trial-Balance
```

Run the setup script:

```powershell
.\setup.ps1
```

This script will:
- Install Git, Node.js 20 LTS, and Docker Desktop (via winget, skipping any already installed)
- Install all npm dependencies (root, server, client)
- Start PostgreSQL via Docker Compose
- Run all database migrations
- Seed the database with the admin user and tax code reference data

#### Option B: Manual Setup

1. **Install prerequisites:**
   - [Node.js 20 LTS](https://nodejs.org/) — verify with `node --version`
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) — verify with `docker --version`
   - [Git](https://git-scm.com/) — verify with `git --version`

2. **Clone the repository:**
   ```bash
   git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git
   cd Vibe-Trial-Balance
   ```

3. **Start the database:**
   ```bash
   docker compose up -d
   ```
   This starts PostgreSQL 16 and pgAdmin. Wait 5–10 seconds for PostgreSQL to initialize.

4. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

5. **Create the server environment file** (`server/.env`):
   ```ini
   PORT=3001
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=vibe_tb_db
   DB_USER=vibetb
   DB_PASSWORD=localdev123
   JWT_SECRET=local-dev-secret-12345
   JWT_EXPIRY=8h
   ALLOWED_ORIGIN=http://localhost:5173
   ```

6. **Run database migrations and seed:**
   ```bash
   npm run migrate
   npm run seed
   ```

7. **Start the application:**
   ```bash
   npm run dev
   ```

8. **Open the app:**
   - Frontend: http://localhost:5173
   - API: http://localhost:3001
   - pgAdmin (optional): http://localhost:5050 (login: `admin@local.dev` / `admin`)

#### Daily Startup (Windows)

After the initial setup, start the app each day with:

```powershell
.\start.ps1
```

Or manually:

```bash
docker compose up -d      # Start PostgreSQL
npm run dev               # Start frontend + backend
```

#### Linux / macOS One-Liner

```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git && cd Vibe-Trial-Balance && bash setup.sh
```

---

### 3.2 Raspberry Pi Production Setup

Designed for Raspberry Pi 5 (8GB) with Raspberry Pi OS (64-bit). An external SSD is recommended for the database and file storage.

#### Step 1: Clone and Run Initial Setup

```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git /opt/vibe-tb
cd /opt/vibe-tb
chmod +x deploy/setup-pi.sh
./deploy/setup-pi.sh
```

This installs:
- Node.js 20 (from NodeSource)
- PostgreSQL 16
- Nginx
- PM2 (global)
- Creates application directories (`/opt/vibe-tb`, `/var/www/vibe-tb`, `/mnt/ssd/uploads`, `/mnt/ssd/backups`)
- Creates the PostgreSQL user `vibetb` and database `vibe_tb_db`
- Configures Nginx as a reverse proxy

#### Step 2: Configure Environment

```bash
cat > /opt/vibe-tb/server/.env << 'EOF'
NODE_ENV=production
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
JWT_SECRET=YOUR_RANDOM_64_CHAR_SECRET_HERE
ENCRYPTION_KEY=YOUR_SEPARATE_RANDOM_SECRET_HERE
ALLOWED_ORIGIN=http://YOUR_PI_IP_OR_HOSTNAME
EOF
```

Set the matching PostgreSQL password:

```bash
sudo -u postgres psql -c "ALTER USER vibetb WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';"
```

#### Step 3: Deploy

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

This builds the TypeScript server, builds the React client, copies the frontend to Nginx's web root (`/var/www/vibe-tb/`), runs migrations, and starts PM2.

#### Step 4: Verify

```bash
curl http://localhost:3001/api/v1/health    # {"status":"ok"}
pm2 status                                   # "vibe-tb-server" should be online
sudo nginx -t                                # Syntax check should pass
```

Access the app at `http://YOUR_PI_IP` (port 80).

#### Step 5: Enable Auto-Start on Boot

```bash
pm2 save
pm2 startup     # Follow the printed command (copy-paste and run it)
sudo systemctl enable nginx
sudo systemctl enable postgresql
```

#### Updating

```bash
cd /opt/vibe-tb && git pull && ./deploy/deploy.sh
```

---

### 3.3 Docker Setup

Works on any machine with Docker installed — office servers, NAS devices, or cloud VPS.

#### Step 1: Clone the Repository

```bash
git clone https://github.com/KisaesDevLab/Vibe-Trial-Balance.git
cd Vibe-Trial-Balance
```

#### Step 2: Create a Production `.env` File

Create a `.env` file in the project root:

```ini
NODE_ENV=production
DB_PASSWORD=your_strong_password_here
JWT_SECRET=your_random_64_char_secret_here
ENCRYPTION_KEY=your_separate_random_secret_here
ALLOWED_ORIGIN=http://your-server-ip
ANTHROPIC_API_KEY=sk-ant-...
```

The `ANTHROPIC_API_KEY` is optional — it can also be set later in the app's Admin Settings.

#### Step 3: Build and Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts three containers:
- **db** — PostgreSQL 16 with a health check
- **server** — Node.js backend (runs migrations on startup)
- **client** — Nginx serving the React frontend

#### Step 4: Seed the Admin User (First Time Only)

```bash
docker compose -f docker-compose.prod.yml exec server \
  sh -c "cd server && npx knex seed:run --knexfile knexfile.js"
```

#### Step 5: Verify

```bash
docker compose -f docker-compose.prod.yml ps    # All services should be "Up"
curl http://localhost:3001/api/v1/health          # {"status":"ok"}
```

Access the app at `http://YOUR_SERVER_IP`.

#### Updating

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

#### Cloud / VPS Additional Steps

For internet-facing deployments, add HTTPS. The simplest option is **Caddy** for automatic TLS. See the main [README.md](../README.md#deployment-docker-cloud--vps) for Caddy and Certbot configurations, firewall rules, and the full security checklist.

---

## 4. Configuration

### 4.1 Environment Variables

All environment variables are set in `server/.env`. Here is the complete reference:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | *(none)* | Set to `production` for production deployments — enforces `JWT_SECRET` requirement |
| `PORT` | `3001` | Backend server listen port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host (`db` in Docker) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `vibe_tb_db` | Database name |
| `DB_USER` | `vibetb` | Database user |
| `DB_PASSWORD` | `localdev123` | Database password — **change in production** |
| `JWT_SECRET` | `local-dev-secret-12345` | JWT signing key — **required in production** (server refuses to start without it when `NODE_ENV=production`) |
| `JWT_EXPIRY` | `8h` | JWT token lifetime (e.g., `8h`, `1d`) |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | CORS allowed origin — see [ALLOWED_ORIGIN details](#allowed_origin-details) below |
| `ENCRYPTION_KEY` | *(falls back to JWT_SECRET)* | Encryption key for API keys stored in the database — set a separate value for best security |
| `ANTHROPIC_API_KEY` | *(none)* | Anthropic API key — can also set in Admin > Settings |
| `APP_BASE_URL` | `http://localhost:3001` | Used for MCP integration and self-referencing URLs |

#### ALLOWED_ORIGIN Details

`ALLOWED_ORIGIN` controls which browser origins the server accepts cross-origin requests from (CORS). The browser sends the page's origin with every API request, and the server rejects requests that don't match.

**What to set it to:**

| Deployment | Value |
|-----------|-------|
| Local development | `http://localhost:5173` (the default — no change needed) |
| Raspberry Pi on LAN | `http://192.168.1.50` or `http://your-pi-hostname` (the URL users type in their browser) |
| Docker on LAN | `http://your-server-ip` |
| Cloud with HTTPS | `https://yourdomain.com` |

**Format rules:**
- Must include the **scheme** (`http://` or `https://`)
- Must include the **host** (IP address or domain name)
- Must include the **port** if it is non-standard (not 80 for HTTP or 443 for HTTPS) — e.g., `http://192.168.1.50:8080`
- Must **not** include a trailing slash — `http://example.com` not `http://example.com/`
- Must **not** include a path — `http://example.com` not `http://example.com/app`
- Is **case-sensitive** — `http://Example.com` will not match `http://example.com`

**Multiple origins are not supported** in the current configuration. The app accepts exactly one origin. If you need to allow access from multiple origins (e.g., both `http://` and `https://`, or both a domain and an IP), you would need to modify `server/src/app.ts` to pass an array or function to the `cors()` middleware.

**Common mistakes:**

| Wrong | Right | Why |
|-------|-------|-----|
| `https://example.com/` | `https://example.com` | No trailing slash |
| `example.com` | `https://example.com` | Must include scheme |
| `http://example.com:80` | `http://example.com` | Port 80 is implicit for HTTP |
| `*` | `https://example.com` | Wildcards are not supported and would be treated as a literal string |

**What happens if it's wrong:** The browser will block all API requests with a CORS error, and the app will appear to load but show errors or a blank page. Check the browser developer console (F12 > Console) for messages like `Access to XMLHttpRequest ... has been blocked by CORS policy`.

### 4.2 AI Provider Setup

AI features are optional. If no AI provider is configured, all non-AI features work normally.

Configure your provider at **Admin > Settings > AI Provider** in the app:

| Provider | Setup | Best For |
|----------|-------|----------|
| **Claude (Anthropic)** | Enter your API key in Settings or as `ANTHROPIC_API_KEY` env var | Highest quality results, native vision for PDF extraction |
| **Ollama (self-hosted)** | Install Ollama, pull models, enter base URL `http://localhost:11434` | Full data privacy, no cloud calls, free |
| **OpenAI-compatible** | Enter server URL and model name (for vLLM, LM Studio, etc.) | Use your own GPU infrastructure |

**Ollama quick start (Raspberry Pi or Linux):**

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen3-vl:8b       # Vision model for PDF extraction
ollama pull qwq:32b            # Reasoning model for support chat
```

Then in the app: **Admin > Settings > AI Provider > Ollama**, and set Base URL to `http://localhost:11434`.

**AI features that use the provider:**
- AI Diagnostics — analyzes trial balance for anomalies and issues
- Tax Code Auto-Assignment — suggests tax codes for unmapped accounts
- Bank Transaction Classification — categorizes imported transactions
- Smart CSV Import — AI-powered column mapping and account matching
- PDF Import with AI Extraction — extracts trial balance data from PDFs
- AI Support Chat — context-aware help using the built-in knowledge base

### 4.3 MCP Integration (Claude Desktop)

The app includes a Model Context Protocol (MCP) server that lets Claude Desktop interact directly with your accounting data.

1. Go to **Admin > Settings > MCP Integration**
2. Click **Generate Token** to create an MCP access token
3. Copy the connection snippet (choose **stdio** or **HTTP/SSE** transport)
4. Paste it into your Claude Desktop configuration file

**Available MCP capabilities:**
- 8 Resources (read clients, periods, trial balances, etc.)
- 18 Tools (create journal entries, run diagnostics, assign tax codes, etc.)
- 5 Prompts (guided workflows for common accounting tasks)

**Note:** MCP tokens are stored as bcrypt hashes. If upgrading from a prior version, regenerate your token in Admin > Settings > MCP Integration and update your Claude Desktop configuration.

---

## 5. First-Run Walkthrough

After installation, follow these steps to get started:

### Step 1: Log In

Open the app in your browser and log in with the default credentials:
- **Username:** `admin`
- **Password:** `admin`

**Change this password immediately** via the user menu in the top-right corner.

### Step 2: Create Additional Users (Optional)

If other staff will use the app, go to **Admin > Users** and create accounts. Assign roles:
- **admin** — full access including settings, user management, and audit logs
- **user** — standard access to client data and workflows

### Step 3: Create Your First Client

1. Click **Clients** in the sidebar
2. Click **New Client**
3. Enter the client name, tax ID (optional), entity type, and activity type (business / rental / farm / farm_rental)
4. Save

### Step 4: Set Up the Chart of Accounts

For the new client:
1. Go to **Chart of Accounts**
2. Choose one of:
   - **Import from CSV** — upload an existing chart of accounts
   - **Copy from another client** — reuse a chart from an existing client
   - **Apply a template** — use one of the 7 built-in templates (General Business, Retail, Restaurant, Professional Services, Real Estate, Construction, Farm)
   - **Add accounts manually** — enter accounts one at a time

### Step 5: Create a Period

1. Go to **Periods** for the client
2. Click **New Period**
3. Enter the fiscal year start and end dates (e.g., 2025-01-01 to 2025-12-31)
4. Save

### Step 6: Enter Trial Balance Data

Navigate to the **Trial Balance** for the period. You can:
- **Type directly** into the grid (inline editing with keyboard navigation)
- **Import from CSV** — click "Import from CSV" and use the AI-powered column mapping
- **Import from PDF** — click "Import from PDF" to extract data from a scanned or digital trial balance

### Step 7: Configure AI (Optional)

If you want AI features, go to **Admin > Settings > AI Provider** and configure your preferred provider (see [Section 4.2](#42-ai-provider-setup)).

---

## 6. Usage Guide

### 6.1 Dashboard & Navigation

The **Dashboard** is the landing page after login. It shows a summary of open clients, recent activity, and quick links.

The **Sidebar** organizes features into groups:
- **Clients** — client list and management
- **Bookkeeping** — bank transactions, reconciliation, transaction entry
- **Tax** — tax codes, tax mapping
- **Reports** — financial statements, exports, multi-period comparison, custom reports
- **Engagement** — checklists, open items
- **Admin** — settings, users, audit log, backup, documents, COA templates

Navigation is context-sensitive — select a client and period first, then access features that operate on that data.

### 6.2 Client Management

**Clients** are the top-level organizational unit. Each client has:
- Name, tax ID, entity type
- Activity type: business, rental, farm, or farm_rental (affects available tax codes)
- One or more periods (fiscal years)
- Their own chart of accounts
- Associated bank accounts, documents, and engagement checklists

**Actions:** Create, edit, delete clients from the Clients page.

### 6.3 Chart of Accounts

Each client has an independent chart of accounts (COA). Accounts have:
- Account number, name, and type (Asset, Liability, Equity, Revenue, Expense)
- Optional sub-type and description
- Tax code assignment (for tax mapping)

**Populating the COA:**
- **Manual entry** — add accounts one at a time
- **CSV import** — upload a CSV with column mapping
- **Copy from client** — duplicate another client's COA
- **Apply template** — choose from 7 industry templates (General Business, Retail, Restaurant, Professional Services, Real Estate, Construction, Farm) via Admin > COA Templates

### 6.4 Periods

Periods represent fiscal years or reporting periods for a client. Each period contains:
- Start and end dates
- Trial balance data
- Journal entries (book and tax adjustments)
- Bank transactions and reconciliations

**Period controls:**
- **Lock** — prevents edits to the trial balance and journal entries. Requires the TB to be in balance before locking.
- **Unlock** — admin-only action to reopen a locked period.
- **Roll forward** — creates a new period copying forward the COA and ending balances as beginning balances. Tickmarks are carried forward.

### 6.5 Trial Balance

The **Trial Balance Grid** is the core workspace. It displays all accounts with:
- Account number and name
- Unadjusted (book) balances (debit/credit)
- Book AJE totals
- Tax AJE totals
- Adjusted balance (computed, never stored)
- Prior year balance (if imported)
- Variance from prior year
- Notes and tickmarks

**Editing:** Click any editable cell to type. Use Tab/Enter to move between cells. The grid supports full keyboard navigation.

**Column visibility:** Toggle which columns appear using the column visibility controls. These settings also apply to PDF and Excel exports.

**Importing data:**
- **Import from CSV** — AI-powered column mapping for automatic matching
- **Import from PDF** — extracts data from scanned or digital PDFs using AI
- **Import Prior Year** — load PY balances for comparison

**Verification:** After PDF import, the **Verification Panel** shows a line-by-line comparison between the imported PDF and the entered data, highlighting any discrepancies.

### 6.6 Journal Entries

Create adjusting journal entries of two types:
- **Book AJEs** — standard adjustments
- **Tax AJEs** — tax-only adjustments (M-1 differences)

Each journal entry has:
- Date, description, type (Book/Tax)
- Line items with account, debit, and credit amounts
- Balance validation — entries must balance (debits = credits) to save

**Access:** From the Trial Balance grid (click "New JE"), from the Journal Entries page, or from the General Ledger view.

**Editing:** Click any existing JE to open the edit dialog. Available from the Journal Entries list, the General Ledger, and the Trial Balance zoom view.

### 6.7 Bank Transactions

Import and classify bank transactions:

**Importing:**
- **OFX files** — standard bank download format
- **CSV files** — with column mapping
- **Manual entry** — via the Transaction Entry Register

**AI Classification:** After import, use the "Classify" button to have AI categorize transactions based on payee patterns and descriptions. The AI learns from your previous classifications.

**Classification rules:** The app builds rules from confirmed classifications. Transactions matching existing rules are auto-classified on future imports.

**Deduplication:** Imported transactions are hashed (SHA-256) to prevent duplicate imports.

**Batch operations:** Select multiple transactions for bulk classify, approve, or delete.

### 6.8 Bank Reconciliation

A full reconciliation workspace for matching bank transactions to book balances:
- Select a bank account and statement date
- Mark transactions as cleared
- The app calculates and displays the reconciling difference
- Admin can reopen completed reconciliations if needed

### 6.9 Tax Codes & Tax Mapping

**Tax Codes** (Admin > Tax Codes):
- 500+ pre-seeded tax codes for 1040, 1065, 1120, and 1120S entity types
- Each code maps to specific lines on tax returns
- Software-specific mappings for UltraTax, CCH, Lacerte, GoSystem, and Generic
- Full CRUD management, CSV import/export

**Tax Mapping** (per client/period):
- A dedicated page for assigning tax codes to accounts
- Dropdown selectors filtered by entity type and activity type
- Progress bar showing mapping completion percentage
- Category subtotals and net income calculation
- Balance sheet check (assets = liabilities + equity)
- Optimistic updates with visual flash feedback

**AI Auto-Assignment:**
- Click "Auto-assign Tax Codes" on the Tax Mapping page
- Uses a 5-step waterfall: existing mappings, prior period, cross-client patterns, AI suggestion, or unmappable
- Preview modal shows confidence-coded suggestions with override dropdowns
- Confirm to apply with dual-write (sets both `tax_code_id` and legacy `tax_line` field)

### 6.10 Financial Statements

The app generates these financial statements:

| Statement | Description |
|-----------|-------------|
| **Income Statement** | Revenue and expenses with current year, prior year, change, and variance % |
| **Balance Sheet** | Assets, liabilities, and equity with comparative columns |
| **Statement of Equity** | Changes in equity accounts |
| **Cash Flow Statement** | Indirect method with configurable account mapping |
| **Tax-Basis P&L** | Income and expenses grouped by tax code with sort order and per-code subtotals |
| **Tax Return Order** | All accounts in tax return filing order with category filter |

All statements are available as:
- On-screen views with formatting and subtotals
- Downloadable PDF (server-side pdfmake, branded header/footer)

### 6.11 Reports & Exports

**Reports available:**
- Trial Balance Report (with column visibility toggles)
- General Ledger
- Tax Code Report
- AJE Listing
- Workpaper Index
- Bookkeeper Letter (PDF)
- Flux Analysis (multi-period variance report)

**Tax software exports:**
- UltraTax, CCH, Lacerte, GoSystem, Generic
- CSV and Excel formats
- Pre-export validation checks for unmapped accounts and out-of-balance conditions

**Working Trial Balance Excel:**
- Full TB data export to Excel with formatting

**Export dialog** includes validation warnings and format selection. Access from the Reports sidebar group or the Exports page.

### 6.12 Multi-Period Comparison

Compare two periods side by side:
- Book-adjusted balances for both periods
- Dollar and percentage variance columns
- Significance threshold highlighting (flag large variances)
- Inline variance note editing (per account, per comparison)
- Category grouping (assets, liabilities, equity, revenue, expense)
- Flux Analysis PDF export

Access from **Reports > Multi-Period Comparison**.

### 6.13 Document Storage

Upload and manage client documents:
- Drag-and-drop file upload
- Download and delete documents
- Link documents to specific accounts or journal entries
- Files stored in `server/uploads/` (or Docker volume)
- Allowed file types: PDF, CSV, plain text, Excel (.xls/.xlsx), Word (.doc/.docx), and images (PNG, JPEG, GIF, WebP, TIFF). Executable files and scripts are blocked.

Access from the **Documents** page.

### 6.14 Engagement Management

Track engagement progress:
- **Period Checklist** — a configurable checklist for each period's workflow steps
- **All Open Items** — aggregated view of incomplete items across all clients with "View Checklist" drill-down

### 6.15 Workpaper Package & Tickmarks

**Tickmarks:**
- A tickmark library with customizable symbols and descriptions
- Apply tickmarks to individual TB rows as superscripts
- Tickmark legend appears on TB reports
- Tickmarks carry forward during period roll-forward

**Workpaper references:**
- Tag accounts with workpaper reference numbers
- Workpaper Index report lists all references

### 6.16 COA Templates

Manage reusable chart of accounts templates:

**System templates** (7 built-in, read-only):
- General Business, Retail, Restaurant, Professional Services, Real Estate, Construction, Farm

**Custom templates:**
- Create from an existing client's COA
- Import from CSV
- Apply to a client with merge or replace mode
- Templates include account numbers, names, types, and tax code mappings

Access from **Admin > COA Templates**.

### 6.17 Transaction Entry Register

A spreadsheet-style register for manual transaction entry:
- Add rows with date, payee, memo, account, debit/credit
- Smart payee combo dropdown with previously-used suggestions
- Smart category select showing previously-used categories first
- Stat cards showing total debits, credits, and net
- Unsaved rows are tinted for visual distinction
- Duplicate and delete row actions
- Entries sync to journal entries and bank transactions

Access from **Bookkeeping > Transaction Entry**.

### 6.18 Custom Report Builder

Create and save custom report definitions:
- Select which accounts, columns, and groupings to include
- Save report configurations for reuse
- Run saved reports at any time

### 6.19 AI Features

All AI features require a configured AI provider (see [Section 4.2](#42-ai-provider-setup)).

| Feature | What It Does | Where to Find It |
|---------|-------------|-----------------|
| **AI Diagnostics** | Analyzes your trial balance and flags anomalies, unusual balances, and potential issues | Diagnostics page |
| **Tax Auto-Assignment** | Suggests tax codes for unmapped accounts using a 5-step confidence waterfall | Tax Mapping page > "Auto-assign Tax Codes" |
| **Bank Classification** | Categorizes imported bank transactions by payee and description | Bank Transactions page > "Classify" |
| **Smart CSV Import** | AI-powered column mapping and account matching for CSV files | Trial Balance > "Import from CSV" |
| **PDF Import** | Extracts trial balance data from scanned or digital PDFs | Trial Balance > "Import from PDF" |
| **PDF Verification** | Compares imported PDF data against entered trial balance line by line | Verification Panel on Trial Balance page |

**Privacy:** AI features include data disclosure consent dialogs. Client names are removed from AI prompts. Account numbers are masked before sending to the AI provider.

### 6.20 AI Support Chat

A context-aware help system powered by AI:
- Floating chat bubble accessible from any page
- Ask questions about the app's features, accounting concepts, or your data
- Draws on a 16-article knowledge base covering all app features
- Conversation history with bookmarking
- Dedicated Support page for longer conversations

---

## 7. Administration

### 7.1 User Management

**Admin > Users:**
- Create, edit, and deactivate user accounts
- Assign roles: `admin` (full access) or `user` (standard access)
- Admins can access settings, user management, audit logs, and period unlock

### 7.2 Settings

**Admin > Settings:**
- **AI Provider** — configure Claude, Ollama, or OpenAI-compatible provider
- **MCP Integration** — generate/rotate/revoke MCP tokens, view connection snippets
- **Backup Schedule** — configure automatic nightly backups

### 7.3 Backup & Restore

**Admin > Backup & Restore:**

**Backup types:**
| Type | What's Included |
|------|----------------|
| Full | All clients, periods, data, settings, and users |
| Client | Single client with all periods and associated data |
| Period | Single period with TB, JEs, and transactions |
| Settings | App settings, users, and tax code configuration only |

**Backup format:** `.tbak` ZIP archives containing JSON data exports.

**Scheduled backups:** Automatic nightly backups via node-cron (configurable).

**Restore modes:**
| Mode | Behavior |
|------|----------|
| As New | Creates new client(s) with remapped IDs — no existing data affected |
| Replace | Overwrites matching client data |
| Settings Only | Restores settings, users, and tax codes only |

**External backups:** For additional safety, set up `pg_dump` as a cron job (see [README.md](../README.md#deployment-docker-cloud--vps)).

### 7.4 Audit Log

**Admin > Audit Log:**
- Tracks all significant actions: logins, data changes, period locks/unlocks, imports, exports
- Paginated and filterable by user, action type, and date range
- Admin-only access
- MCP tool calls are also logged

---

## 8. Maintenance & Updates

### Updating the Application

**Windows (development):**
```bash
git pull
npm install && cd server && npm install && cd ../client && npm install && cd ..
npm run migrate
npm run dev
```

**Raspberry Pi:**
```bash
cd /opt/vibe-tb && git pull && ./deploy/deploy.sh
```

**Docker:**
```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on server startup (Docker) or via the deploy script (Pi).

### Database Maintenance

**Reset database to clean state (development only):**
```bash
npm run db:reset
```
This rolls back all migrations, re-runs them, and re-seeds the database.

**Full database wipe (development only):**
```bash
docker compose down -v      # Destroys the database volume
docker compose up -d        # Recreates a fresh database
npm run migrate
npm run seed
```

**Database shell access:**
```bash
# Docker development
docker exec -it vibe-tb-db psql -U vibetb -d vibe_tb_db

# Raspberry Pi
sudo -u postgres psql -d vibe_tb_db
```

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Docker Desktop is not running"** | Open Docker Desktop from the Start Menu. Wait for the whale icon to stop animating. |
| **"Port 5432 already in use"** | Another PostgreSQL instance is running. Stop it, or edit `docker-compose.yml` to use port 5433. |
| **"Cannot find module" errors** | Run `npm install` in the failing directory (root, `server/`, or `client/`). |
| **Database tables are missing** | Run `npm run migrate` from the project root. |
| **Frontend shows blank page or API errors** | Verify the backend is running: `curl http://localhost:3001/api/v1/health` |
| **Login fails with correct credentials** | Run `npm run seed` to re-create the admin user. |
| **AI features return errors** | Check your AI provider configuration in Admin > Settings. Verify the API key or Ollama server is accessible. |
| **PDF import fails** | Ensure `poppler-utils` is installed for scanned PDFs. Digital PDFs work without it. |
| **Migrations fail** | Check that PostgreSQL is running and the `server/.env` credentials are correct. |
| **"CORS error" in browser console** | Set `ALLOWED_ORIGIN` in `server/.env` to match your frontend URL exactly. |
| **"Too many login attempts"** | Login is rate-limited to 10 attempts per 15 minutes per IP. Wait 15 minutes and try again. |
| **Server refuses to start in production** | `JWT_SECRET` is required when `NODE_ENV=production`. Set it in `server/.env`. |

**View server logs:**
```bash
# Development
# Server output appears in the terminal running npm run dev

# Raspberry Pi
pm2 logs vibe-tb-server

# Docker
docker compose -f docker-compose.prod.yml logs -f server
```

---

## 10. Security Checklist

Before exposing the app to any network beyond localhost:

- [ ] **Set `NODE_ENV=production`** in your `server/.env` file — enables security enforcement
- [ ] **Change the default admin password** — `admin` / `admin` must be changed on first login
- [ ] **Set a strong `JWT_SECRET`** — at least 64 random characters (server refuses to start without it in production)
- [ ] **Set a strong `ENCRYPTION_KEY`** — separate from JWT_SECRET, used to encrypt API keys stored in the database
- [ ] **Set a strong `DB_PASSWORD`** — do not use the development default
- [ ] **Set `ALLOWED_ORIGIN`** to your exact domain (no wildcards)
- [ ] **Enable HTTPS** for any non-localhost deployment (Caddy, Certbot, or cloud load balancer)
- [ ] **Configure a firewall** — allow only ports 22, 80, and 443
- [ ] **Set up external database backups** — `pg_dump` cron job in addition to in-app backups
- [ ] **Regenerate your MCP token** after upgrading (Admin > Settings > MCP Integration) — tokens are now stored as hashes
- [ ] **Review the LICENSE file** is present and the source code link in the app footer is visible
- [ ] **Keep dependencies updated** — run `npm audit` periodically
- [ ] **Review AI data consent** — understand what data is sent to AI providers (client names are stripped, account numbers are masked)
