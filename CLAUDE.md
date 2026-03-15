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
Phase 1: Foundation - Scaffold + Auth + Client + COA

## Completed
(none yet)
