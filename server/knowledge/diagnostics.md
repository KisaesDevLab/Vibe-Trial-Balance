# AI Diagnostics

## Overview
The AI Diagnostics page uses the configured AI provider to automatically analyze a period's trial balance and flag potential issues. It provides a fast second opinion before finalizing client work.

## Running Diagnostics
1. Select your client and period in the sidebar
2. Go to **Tools > AI Diagnostics**
3. Click **Run Diagnostics**
4. A **data disclosure popup** shows what data will be sent to the AI (account names, balances, entity type — client name is NOT sent)
5. Click **Confirm & Proceed** to continue
6. Wait 10–30 seconds while the AI analyzes the data (local models may take longer)
7. Results appear as a list of observations with severity ratings

## Observation Types
Each observation has:
- **Severity**: `error` (red), `warning` (yellow), or `info` (blue)
- **Category**: short label like "Balance Check", "Prior Year Variance", "Unusual Balance", etc.
- **Message**: specific description with account names and dollar amounts

## What the AI Checks
1. **Balance Check**: Is the TB in balance? If not, shows the out-of-balance amount
2. **Prior Year Variances**: Flags accounts with >20% change or >$10,000 absolute change from prior year
3. **Unusual Balances**: Accounts with a balance in the opposite direction from normal (e.g., a credit-balance expense)
4. **Unclassified Bank Transactions**: Count of transactions still awaiting classification
5. **Missing Data**: Zero-balance accounts in key categories that may indicate missing data
6. **Other Notable Issues**: Any other patterns the AI identifies as worth reviewing

## Navigating to Flagged Accounts
- Click an observation's account reference to jump directly to that account in the Trial Balance grid
- Fix the issue, then re-run diagnostics to confirm the warning is resolved

## AI Provider Requirement
Diagnostics works with any configured AI provider (Claude, Ollama, or OpenAI-compatible). Configure your provider at **Admin > Settings > AI Provider**. If you see an error about the provider not being configured, ask your admin to set up the AI provider in Settings.
