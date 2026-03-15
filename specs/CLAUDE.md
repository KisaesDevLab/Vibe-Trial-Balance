# Trial Balance App — Claude Code Project Memory

## Project
Full-stack accountant's trial balance and tax workpaper tool.
Self-hosted on Raspberry Pi 5 (8GB) with PostgreSQL.
Multi-user, per-client, with AI-assisted features.

## Stack
- **Frontend**: React 18 + TypeScript (strict) + Vite + TanStack Table v8 + TanStack Query + Tailwind CSS + Zustand (UI state only)
- **Backend**: Node.js 20 + Express + TypeScript + Knex.js + PostgreSQL 16
- **AI**: Anthropic SDK (@anthropic-ai/sdk) for bank transaction classification + diagnostic analysis
- **Hosting**: Nginx (static files + reverse proxy) + PM2 (process manager) on Raspberry Pi 5

## Project Structure
- `client/` — React frontend
- `server/` — Express API backend
- `shared/` — TypeScript types shared by both (imported by both client and server)
- `specs/plan.md` — Master specification and task checklist
- `deploy/` — Pi setup script, nginx config, deploy script

## Technical Standards

### General
- TypeScript strict mode everywhere (`strict: true` in tsconfig)
- Named exports preferred over default exports
- PascalCase for components, camelCase for utilities and variables
- snake_case for database column names (Knex handles conversion)

### Money
- ALL monetary values stored as **BIGINT cents** in the database (e.g., $1,234.56 = 123456)
- NEVER use float, decimal, or Number for money calculations
- Use `shared/types.ts` → `centsToDisplay()` and `displayToCents()` for conversion
- Display formatting (commas, decimal places) happens ONLY in the frontend

### Database
- Knex.js for all queries and migrations — no raw SQL in route handlers
- Adjusted balances are NEVER stored — always computed from unadjusted + journal entry sums
- Use `v_adjusted_trial_balance` view as the primary read path for the trial balance grid
- Parameterized queries only — never concatenate user input into SQL
- Migrations are sequential, timestamped files in `server/migrations/`

### API
- All routes under `/api/v1/`
- JWT auth middleware on all routes except `/api/v1/auth/login`
- Request validation with Zod schemas
- Consistent response shape: `{ data, error, meta }`
- See `shared/types.ts` for `ApiResponse<T>` and `ApiError`

### Frontend Data
- **TanStack Query** for all server state (fetching, caching, mutations)
- **Zustand** ONLY for UI state (selected client ID, open panel, grid edit state)
- Optimistic updates for inline grid editing (mutate cache immediately, sync to server)
- Query keys follow pattern: `['trialBalance', periodId]`, `['clients']`, etc.

### Journal Entry Rules
- Every JE must balance: SUM(debit lines) = SUM(credit lines) — enforced in API before save
- Book AJEs affect book-adjusted columns; Tax AJEs affect tax-adjusted columns
- The database view handles the aggregation automatically

### Testing
- Vitest for frontend unit tests
- Supertest for backend API integration tests
- Test database: separate `trialbalance_test` database, migrated fresh for each test run

## Current Phase
Phase 1: Foundation — Scaffold + Auth + Client + COA

## Completed
(none yet)

## Known Gotchas
(none yet — add issues here as they're discovered)
