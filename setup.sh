#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Vibe Trial Balance — Single-line install script
#
# Usage (clone + run):
#   git clone https://github.com/kisaesdevlab/vibe-trial-balance.git && cd vibe-trial-balance && ./setup.sh
#
# Or run from an existing checkout:
#   ./setup.sh
#
# Modes:
#   ./setup.sh          — Development setup (Docker DB + local Node)
#   ./setup.sh --docker — Full Docker deployment (no local Node needed)

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

ok()   { printf "${GREEN}  ✔ %s${NC}\n" "$*"; }
info() { printf "${CYAN}  → %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}  ⚠ %s${NC}\n" "$*"; }
fail() { printf "${RED}  ✖ %s${NC}\n" "$*"; exit 1; }

banner() {
  echo ""
  printf "${CYAN}══════════════════════════════════════════════════${NC}\n"
  printf "${CYAN}  Vibe Trial Balance — Setup${NC}\n"
  printf "${CYAN}══════════════════════════════════════════════════${NC}\n"
  echo ""
}

# ── Parse args ───────────────────────────────────────────────
MODE="dev"
if [[ "${1:-}" == "--docker" ]]; then
  MODE="docker"
fi

banner

# ── Pre-flight checks ───────────────────────────────────────
command -v git >/dev/null 2>&1 || fail "git is not installed. Install it first."
ok "git found"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install Docker Desktop or Docker Engine first."
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker and try again."
ok "Docker is running"

# Check docker compose (v2 plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  fail "docker compose is not available. Install Docker Compose v2."
fi
ok "docker compose available"

# ── Full Docker mode ─────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
  info "Starting full Docker deployment (PostgreSQL + API + Nginx)..."

  # Generate secrets if .env doesn't exist
  if [[ ! -f .env ]]; then
    info "Generating .env with random secrets..."
    DB_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SEC=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    cat > .env <<EOF
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SEC}
ALLOWED_ORIGIN=http://localhost
APP_BASE_URL=http://localhost
ANTHROPIC_API_KEY=
EOF
    ok ".env created (edit ANTHROPIC_API_KEY later for AI features)"
  else
    ok ".env already exists"
  fi

  $DC -f docker-compose.prod.yml up -d --build

  echo ""
  ok "All services started!"
  echo ""
  info "App:     http://localhost"
  info "API:     http://localhost/api/v1/health"
  info "Login:   admin / admin  (change immediately)"
  echo ""
  warn "To stop:  $DC -f docker-compose.prod.yml down"
  warn "To reset: $DC -f docker-compose.prod.yml down -v && $DC -f docker-compose.prod.yml up -d --build"
  exit 0
fi

# ── Development mode ─────────────────────────────────────────
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 20+ first: https://nodejs.org"
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if (( NODE_MAJOR < 20 )); then
  fail "Node.js v${NODE_MAJOR} found, but v20+ is required."
fi
ok "Node.js $(node -v)"

command -v npm >/dev/null 2>&1 || fail "npm is not installed."
ok "npm $(npm -v)"

# ── Step 1: Start PostgreSQL ────────────────────────────────
info "Starting PostgreSQL via Docker..."
$DC up -d db

info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker exec vibe-tb-db pg_isready -U vibetb >/dev/null 2>&1; then
    ok "PostgreSQL is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "PostgreSQL did not start in 30 seconds. Check: $DC logs db"
  fi
  sleep 1
done

# ── Step 2: Install dependencies ────────────────────────────
info "Installing dependencies (root)..."
npm install --silent 2>&1 | tail -1 || true
ok "Root dependencies"

info "Installing server dependencies..."
(cd server && npm install --silent 2>&1 | tail -1) || fail "npm install failed in server/"
ok "Server dependencies"

info "Installing client dependencies..."
(cd client && npm install --silent 2>&1 | tail -1) || fail "npm install failed in client/"
ok "Client dependencies"

# ── Step 3: Create .env if missing ──────────────────────────
if [[ ! -f server/.env ]]; then
  info "Creating server/.env with dev defaults..."
  cat > server/.env <<EOF
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=localdev123
JWT_SECRET=local-dev-secret-$(date +%s)
JWT_EXPIRY=8h
ALLOWED_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:3001
ANTHROPIC_API_KEY=
EOF
  ok "server/.env created"
else
  ok "server/.env already exists"
fi

# ── Step 4: Migrate + Seed ──────────────────────────────────
info "Running database migrations..."
npm run migrate 2>&1 | tail -3
ok "Migrations complete"

info "Seeding database..."
npm run seed 2>&1 | tail -3
ok "Database seeded (admin/admin + demo data)"

# ── Done ─────────────────────────────────────────────────────
echo ""
printf "${GREEN}══════════════════════════════════════════════════${NC}\n"
printf "${GREEN}  Setup complete!${NC}\n"
printf "${GREEN}══════════════════════════════════════════════════${NC}\n"
echo ""
info "Start the app:  npm run dev"
info "Frontend:       http://localhost:5173"
info "API health:     http://localhost:3001/api/v1/health"
info "Login:          admin / admin"
info "pgAdmin:        $DC up -d pgadmin  →  http://localhost:5050"
echo ""
