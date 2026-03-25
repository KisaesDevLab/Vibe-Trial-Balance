# Getting Started

## Logging In
1. Open the app in your browser (typically `http://localhost:5173` in development, or your firm's server address)
2. Enter your username and password
3. Click **Login**

If you see "Token expired", log out and log back in. Contact your admin if you need a password reset.

Default credentials for a fresh installation: **admin / admin** — change this immediately in production.

## Step 0: Configure AI Provider (Admin)
Before using AI features (diagnostics, auto-assign, classification, PDF import):
1. Go to **Admin > Settings**
2. In the **AI Provider** card, choose your provider:
   - **Claude** (default): Enter your Anthropic API key
   - **Ollama**: Enter your Ollama server URL and model names
   - **OpenAI-compatible**: Enter the server URL, model name, and optional API key
3. Click **Save**, then **Test Connection** to verify
4. See the **AI Providers** knowledge article for detailed setup instructions

## Step 1: Create a Client
1. Go to **Setup > Clients**
2. Click **New Client**
3. Enter:
   - **Client Name**
   - **Entity Type**: 1040 (individual), 1065 (partnership), 1120 (C-corp), 1120S (S-corp)
   - **Activity Type**: business, rental, farm, or farm_rental — this affects which tax codes are suggested during AI tax mapping
   - **Tax Year End**: The month the client's fiscal year ends
4. Save the client

## Step 2: Set Up the Chart of Accounts
1. Select the client from the dropdown in the sidebar
2. Go to **Setup > Chart of Accounts**
3. Choose one of:
   - **New Account**: Add accounts one by one
   - **Import from CSV**: Upload a CSV — the AI maps columns automatically
   - **Copy from Client**: Copy all accounts from another client
   - **Apply Template**: Use a pre-built industry template (Admin > COA Templates)

For each account: account number, name, category (Asset/Liability/Equity/Income/Expense), and normal balance (Dr/Cr) are required.

## Step 3: Create a Period
1. Go to **Setup > Periods**
2. Click **New Period**
3. Enter period name (e.g., "FY 2024"), start date, end date
4. Check **Mark as Current** if this is the active working period
5. The period starts unlocked and ready for data entry

## Step 4: Import or Enter the Trial Balance
1. Select the period from the sidebar dropdown
2. Go to **Trial Balance**
3. Choose your method:
   - **Manual entry**: Click any balance cell and type the dollar amount
   - **Import from CSV**: Click **Import TB** — the AI maps your CSV columns to accounts automatically
   - **Import from PDF**: Click **Import from PDF** to extract balances from a PDF trial balance using AI
   - **Import PY**: Load prior year balances for comparative columns

## Step 5: Post Journal Entries (Optional)
1. Go to **Bookkeeping > Journal Entries**
2. Click **New Entry**
3. Choose type: **Book AJE** (affects financial statements) or **Tax AJE** (book-to-tax difference)
4. Enter date, description, and lines (must balance: total debits = total credits)
5. Post — the TB adjustments appear immediately in the TB grid

## Step 6: Assign Tax Codes
1. Go to **Tax > Tax Mapping**
2. Use the **Auto-Assign** button to let AI suggest tax codes for all accounts
3. Review suggestions and confirm high-confidence ones
4. Manually assign codes for any remaining accounts using the dropdown on each row
5. The progress bar shows % of accounts mapped — aim for 100% before exporting

## Step 7: Review and Close the Period
1. Go to **AI Diagnostics** to run an automated review (balance check, variance analysis)
2. Review the **Dashboard** for any remaining issues
3. Check engagement tasks at **Setup > Engagement**
4. When ready, lock the period at **Setup > Periods** — requires the TB to be balanced

## Quick Start Tips
- Configure an AI provider before using diagnostics, auto-assign, or PDF import
- Always select both a **Client** and a **Period** in the sidebar before navigating to work pages
- The Dashboard shows a quick health check (TB balanced?, open AJEs, unclassified transactions)
- The lock icon on the Dashboard tells you if the period is locked and who locked it
- Roll forward a completed period to set up the next year: **Setup > Periods > Roll Forward**
