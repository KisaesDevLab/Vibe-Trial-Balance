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

# ── Port configuration defaults ─────────────────────────────────────────────
PORT_DB=5432
PORT_PGADMIN=5050
PORT_SERVER=3001
PORT_CLIENT=5173

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

# ── Port conflict detection ─────────────────────────────────────────────────

check_port() {
  local PORT=$1
  local NAME=$2
  local DEFAULT=$3

  # Check if something is listening on the port
  local IN_USE=false
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -q ":${PORT} " && IN_USE=true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1 && IN_USE=true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep -q ":${PORT} " && IN_USE=true
  fi

  if [ "$IN_USE" = true ]; then
    # Find the process using the port
    local PROC=""
    if command -v lsof >/dev/null 2>&1; then
      PROC=$(lsof -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null | head -1)
      if [ -n "$PROC" ]; then
        PROC=$(ps -p "$PROC" -o comm= 2>/dev/null || echo "unknown")
      fi
    fi

    # Find next available port
    local SUGGESTED=$((PORT + 1))
    while true; do
      local TAKEN=false
      if command -v ss >/dev/null 2>&1; then
        ss -tlnp 2>/dev/null | grep -q ":${SUGGESTED} " && TAKEN=true
      elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"${SUGGESTED}" -sTCP:LISTEN >/dev/null 2>&1 && TAKEN=true
      fi
      [ "$TAKEN" = false ] && break
      SUGGESTED=$((SUGGESTED + 1))
    done

    echo ""
    warn "Port ${PORT} (${NAME}) is already in use${PROC:+ by '${PROC}'}."
    info "Suggested alternative: ${SUGGESTED}"

    # Check if stdin is a terminal (not piped from curl)
    if [ -t 0 ]; then
      read -rp "  Enter port for ${NAME} [${SUGGESTED}]: " USER_PORT
      USER_PORT=${USER_PORT:-$SUGGESTED}
    else
      USER_PORT=$SUGGESTED
      info "Non-interactive mode — using port ${USER_PORT}"
    fi

    echo "$USER_PORT"
  else
    log "Port ${PORT} (${NAME}) is available"
    echo "$PORT"
  fi
}

info "Checking for port conflicts..."

PORT_DB=$(check_port "$PORT_DB" "PostgreSQL" 5432)
PORT_PGADMIN=$(check_port "$PORT_PGADMIN" "pgAdmin" 5050)
PORT_SERVER=$(check_port "$PORT_SERVER" "Backend API" 3001)
PORT_CLIENT=$(check_port "$PORT_CLIENT" "Frontend" 5173)

echo ""
info "Ports: PostgreSQL=$PORT_DB  pgAdmin=$PORT_PGADMIN  Server=$PORT_SERVER  Client=$PORT_CLIENT"

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

# ── Create server/.env with resolved ports ──────────────────────────────────

if [ ! -f "server/.env" ]; then
  info "Creating server/.env with generated secrets..."
  # The server rejects JWT_SECRET shorter than 32 chars, so generate full 64-hex
  # secrets from a real CSPRNG. Fall back gracefully if openssl isn't available.
  gen_hex() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex "$1"
    elif [ -r /dev/urandom ]; then
      head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
    else
      # Last-resort fallback — still long enough to pass the 32-char floor.
      date +%s%N | sha256sum | head -c $(( $1 * 2 ))
    fi
  }
  gen_admin_pw() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -base64 18 | tr -d '=+/' | head -c 24
    else
      head -c 18 /dev/urandom | base64 | tr -d '=+/' | head -c 24
    fi
  }
  JWT_SECRET_VAL=$(gen_hex 32)
  ENC_KEY_VAL=$(gen_hex 32)
  INITIAL_ADMIN_PW=$(gen_admin_pw)
  cat > server/.env <<ENVEOF
# Database (matches docker-compose.yml)
DB_HOST=127.0.0.1
DB_PORT=$PORT_DB
DB_NAME=vibe_tb_db
DB_USER=vibetb
DB_PASSWORD=localdev123

# Auth — generated at setup time. Keep secret; do not commit.
JWT_SECRET=$JWT_SECRET_VAL
JWT_EXPIRY=8h
ENCRYPTION_KEY=$ENC_KEY_VAL

# Bootstrap admin password — used once on first seed. You'll be forced to change
# it on first login. Safe to leave here; only used when the DB is empty.
INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PW

# Anthropic API (optional — can also configure in Admin > Settings)
ANTHROPIC_API_KEY=

# Server
PORT=$PORT_SERVER
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:$PORT_CLIENT
ENVEOF
  log "Created server/.env with random JWT_SECRET, ENCRYPTION_KEY, and admin password"
else
  info "server/.env already exists — updating ports if changed..."
  # Update PORT, DB_PORT, and ALLOWED_ORIGIN if ports differ from defaults
  if [ "$PORT_SERVER" != "3001" ]; then
    sed -i "s/^PORT=.*/PORT=$PORT_SERVER/" server/.env
  fi
  if [ "$PORT_DB" != "5432" ]; then
    sed -i "s/^DB_PORT=.*/DB_PORT=$PORT_DB/" server/.env
  fi
  if [ "$PORT_CLIENT" != "5173" ]; then
    sed -i "s|^ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=http://localhost:$PORT_CLIENT|" server/.env
  fi
fi

# ── Update docker-compose ports if non-default ──────────────────────────────

if [ "$PORT_DB" != "5432" ] || [ "$PORT_PGADMIN" != "5050" ]; then
  info "Adjusting docker-compose.yml port mappings..."
  if [ "$PORT_DB" != "5432" ]; then
    sed -i "s/\"5432:5432\"/\"$PORT_DB:5432\"/" docker-compose.yml
  fi
  if [ "$PORT_PGADMIN" != "5050" ]; then
    sed -i "s/\"5050:5050\"/\"$PORT_PGADMIN:5050\"/" docker-compose.yml
  fi
  log "docker-compose.yml updated with custom ports"
fi

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
  warn "  Host: 127.0.0.1:$PORT_DB"
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
echo -e "  Client:  ${CYAN}http://localhost:${PORT_CLIENT}${NC}"
echo -e "  Server:  ${CYAN}http://localhost:${PORT_SERVER}${NC}"
echo -e "  pgAdmin: ${CYAN}http://localhost:${PORT_PGADMIN}${NC}  (admin@local.dev / admin)"
echo ""

# Surface the first-boot admin password. The password also lives in server/.env
# as INITIAL_ADMIN_PASSWORD, but asking a non-technical user to read a hidden
# dotfile is unreasonable, so we also write a plain FIRST_LOGIN.txt at the
# project root and try to open it in the default text editor.
if [ -f "server/.env" ]; then
  ADMIN_PW=$(grep -E '^INITIAL_ADMIN_PASSWORD=' server/.env | head -1 | cut -d= -f2-)
else
  ADMIN_PW=""
fi
if [ -n "$ADMIN_PW" ]; then
  cat > FIRST_LOGIN.txt <<EOF
Vibe Trial Balance - one-time login
-----------------------------------

URL:       http://localhost:${PORT_CLIENT}
Username:  admin
Password:  ${ADMIN_PW}

You will be required to choose your own password on first sign-in.
This file can be safely deleted after you change the password.
EOF

  echo -e "  ${YELLOW}──────────────────────────────────────────────────────${NC}"
  echo -e "    ${YELLOW}First-time login (change required on first sign-in):${NC}"
  echo -e "      Username:  ${CYAN}admin${NC}"
  echo -e "      Password:  ${CYAN}${ADMIN_PW}${NC}"
  echo -e "  ${YELLOW}──────────────────────────────────────────────────────${NC}"
  echo -e "    Saved to ${CYAN}FIRST_LOGIN.txt${NC} in the project folder."

  # Try to open the file in whatever text viewer the OS has a default for.
  # Fails silently on headless servers / CI — the terminal banner above is
  # still enough for technical users.
  if command -v open >/dev/null 2>&1; then
    open FIRST_LOGIN.txt 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open FIRST_LOGIN.txt >/dev/null 2>&1 || true
  fi
else
  echo -e "  ${YELLOW}The app prints the admin password on its first run — watch${NC}"
  echo -e "  ${YELLOW}the server console output when you run 'npm run dev'.${NC}"
fi
echo ""
