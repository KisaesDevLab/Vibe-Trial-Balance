#!/usr/bin/env bash
# Vibe Trial Balance — One-line installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-Trial-Balance/main/setup.sh | bash
#
# Or after cloning:
#   bash setup.sh
#
# Prerequisites: git, node 20+, npm, docker (for PostgreSQL)

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Vibe Trial Balance — Quick Setup       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check prerequisites ─────────────────────────────────────────────────────

command -v git  >/dev/null 2>&1 || fail "git is required. Install it first."
command -v node >/dev/null 2>&1 || fail "node is required (v20+). Install from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "npm is required (comes with node)."

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  fail "Node 18+ required (found $(node -v)). Please upgrade."
fi
log "Node $(node -v), npm $(npm -v)"

# ── Clone if needed ──────────────────────────────────────────────────────────

REPO="https://github.com/KisaesDevLab/Vibe-Trial-Balance.git"
APP_DIR="Vibe-Trial-Balance"

if [ -f "package.json" ] && grep -q "vibe-tb" package.json 2>/dev/null; then
  info "Already in project directory, skipping clone."
  APP_DIR="."
elif [ -d "$APP_DIR" ]; then
  info "Directory $APP_DIR exists, using it."
else
  info "Cloning repository..."
  git clone "$REPO" "$APP_DIR"
  log "Cloned."
fi

cd "$APP_DIR"

# ── Install dependencies ─────────────────────────────────────────────────────

info "Installing root dependencies..."
npm install
log "Root deps installed."

info "Installing client dependencies..."
(cd client && npm install)
log "Client deps installed."

info "Installing server dependencies..."
(cd server && npm install)
log "Server deps installed."

# ── Database ─────────────────────────────────────────────────────────────────

if command -v docker >/dev/null 2>&1; then
  info "Starting PostgreSQL via Docker..."
  docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null || {
    warn "Docker compose failed. Start PostgreSQL manually."
  }

  # Wait for Postgres to be ready
  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec vibe-tb-db pg_isready -U vibetb >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  log "PostgreSQL is ready."

  info "Running migrations..."
  npm run migrate
  log "Migrations complete."

  info "Seeding database..."
  npm run seed
  log "Database seeded."
else
  warn "Docker not found. You need PostgreSQL 16 running with:"
  warn "  Host: 127.0.0.1:5432"
  warn "  Database: vibe_tb_db"
  warn "  User: vibetb / Password: localdev123"
  warn ""
  warn "Then run:  npm run migrate && npm run seed"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup Complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start the app:  ${CYAN}npm run dev${NC}"
echo ""
echo -e "  Client:  ${CYAN}http://localhost:5173${NC}"
echo -e "  Server:  ${CYAN}http://localhost:3001${NC}"
echo -e "  pgAdmin: ${CYAN}http://localhost:5050${NC}  (admin@local.dev / admin)"
echo ""
echo -e "  Default login:  ${CYAN}admin / admin123${NC}"
echo ""
