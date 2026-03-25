#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Vibe Trial Balance — Update script
#
# Pulls the latest code and rebuilds without losing data.
# Database, uploads, and backups are stored in Docker volumes
# and are preserved across updates.
#
# Usage:
#   ./update.sh            — Update a Docker deployment
#   ./update.sh --dev      — Update a dev (local Node) setup

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

ok()   { printf "${GREEN}  ✔ %s${NC}\n" "$*"; }
info() { printf "${CYAN}  → %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}  ⚠ %s${NC}\n" "$*"; }
fail() { printf "${RED}  ✖ %s${NC}\n" "$*"; exit 1; }

# Check docker compose availability
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  DC=""
fi

MODE="docker"
if [[ "${1:-}" == "--dev" ]]; then
  MODE="dev"
fi

echo ""
printf "${CYAN}══════════════════════════════════════════════════${NC}\n"
printf "${CYAN}  Vibe Trial Balance — Update${NC}\n"
printf "${CYAN}══════════════════════════════════════════════════${NC}\n"
echo ""

# ── Step 1: Pull latest code ────────────────────────────────
info "Pulling latest code..."
git pull origin "$(git branch --show-current)" || fail "git pull failed. Commit or stash local changes first."
ok "Code updated"

# ── Docker mode ──────────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
  [[ -z "$DC" ]] && fail "Docker Compose not found."

  info "Rebuilding containers (database volume preserved)..."
  $DC -f docker-compose.prod.yml up -d --build
  ok "Containers rebuilt and restarted"

  echo ""
  info "Migrations run automatically on server startup."
  info "Your data (database, uploads, backups) is intact."
  echo ""
  info "App: http://localhost"
  echo ""
  exit 0
fi

# ── Dev mode ─────────────────────────────────────────────────
info "Installing any new dependencies..."
npm install --silent 2>&1 | tail -1 || true
(cd server && npm install --silent 2>&1 | tail -1) || fail "npm install failed in server/"
(cd client && npm install --silent 2>&1 | tail -1) || fail "npm install failed in client/"
ok "Dependencies up to date"

info "Running database migrations..."
npm run migrate 2>&1 | tail -3
ok "Migrations complete — your data is intact"

echo ""
printf "${GREEN}══════════════════════════════════════════════════${NC}\n"
printf "${GREEN}  Update complete!${NC}\n"
printf "${GREEN}══════════════════════════════════════════════════${NC}\n"
echo ""
info "Restart with: npm run dev"
echo ""
