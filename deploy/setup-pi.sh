#!/bin/bash
set -e

echo "=== Vibe Trial Balance — Pi Setup ==="

# All secrets come from env or are generated here. The server refuses to boot
# unless DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, and ALLOWED_ORIGIN are set —
# so this script must produce all of them. The caller can pre-seed any of them
# by exporting the var; anything unset is generated fresh.

require_openssl() {
  command -v openssl >/dev/null 2>&1 || {
    echo "ERROR: openssl is required to generate secrets. Install it and retry:"
    echo "       sudo apt-get install -y openssl"
    exit 1
  }
}

if [ -z "${PG_PASSWORD:-}" ]; then
  require_openssl
  PG_PASSWORD="$(openssl rand -hex 24)"
  echo "[setup] Generated random PG_PASSWORD"
  GENERATED_PG_PASSWORD=1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  require_openssl
  JWT_SECRET="$(openssl rand -hex 32)"
  echo "[setup] Generated random JWT_SECRET"
fi

if [ -z "${ENCRYPTION_KEY:-}" ]; then
  require_openssl
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  echo "[setup] Generated random ENCRYPTION_KEY"
fi

if [ -z "${INITIAL_ADMIN_PASSWORD:-}" ]; then
  require_openssl
  # Readable chars, no ambiguous ones. User will be forced to rotate on first login.
  INITIAL_ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '=+/' | head -c 20)"
  echo "[setup] Generated random INITIAL_ADMIN_PASSWORD"
fi

if [ -z "${ALLOWED_ORIGIN:-}" ]; then
  # Reasonable Pi default — the operator can edit .env later if they put the Pi
  # behind a DNS name.
  ALLOWED_ORIGIN="http://$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -z "$ALLOWED_ORIGIN" ] || [ "$ALLOWED_ORIGIN" = "http://" ] && ALLOWED_ORIGIN="http://localhost"
  echo "[setup] Defaulted ALLOWED_ORIGIN to $ALLOWED_ORIGIN (edit /opt/vibe-tb/.env to change)"
fi

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 16
sudo apt-get install -y postgresql postgresql-contrib

# Install nginx
sudo apt-get install -y nginx

# Install PM2
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/vibe-tb
sudo mkdir -p /opt/vibe-tb
sudo mkdir -p /mnt/ssd/uploads
sudo mkdir -p /mnt/ssd/backups

# Set up PostgreSQL. Password is passed through an env var so it is never
# visible on the command line (would otherwise show in `ps` and shell history).
sudo -u postgres PG_PASSWORD="$PG_PASSWORD" psql \
  -v "pg_pw=$PG_PASSWORD" \
  -c "CREATE USER vibetb WITH PASSWORD :'pg_pw';" \
  -c "CREATE DATABASE vibe_tb_db OWNER vibetb;"

# Persist all generated secrets to .env so deploy.sh / ecosystem.config.js can
# read them. Overwrites any prior generated values but leaves a manually-edited
# .env alone by writing to a fresh file only when we actually generated
# passwords in this run.
if [ "${GENERATED_PG_PASSWORD:-0}" = "1" ] || [ ! -f /opt/vibe-tb/.env ]; then
  sudo install -m 600 -o "$USER" -g "$USER" /dev/null /opt/vibe-tb/.env
  {
    echo "NODE_ENV=production"
    echo "DB_HOST=127.0.0.1"
    echo "DB_PORT=5432"
    echo "DB_NAME=vibe_tb_db"
    echo "DB_USER=vibetb"
    echo "DB_PASSWORD=$PG_PASSWORD"
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_EXPIRY=8h"
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
    echo "INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD"
    echo "ALLOWED_ORIGIN=$ALLOWED_ORIGIN"
    echo "APP_BASE_URL=$ALLOWED_ORIGIN"
    echo "ANTHROPIC_API_KEY="
  } >> /opt/vibe-tb/.env
  echo "[setup] Credentials written to /opt/vibe-tb/.env (chmod 600)"

  # Also drop a FIRST_LOGIN.txt alongside so whoever logs into the Pi over SSH
  # (or browses the Samba share) can find the one-time password without reading
  # a dotfile.
  sudo install -m 644 -o "$USER" -g "$USER" /dev/null /opt/vibe-tb/FIRST_LOGIN.txt
  cat > /opt/vibe-tb/FIRST_LOGIN.txt <<EOF
Vibe Trial Balance - one-time login
-----------------------------------

URL:       $ALLOWED_ORIGIN
Username:  admin
Password:  $INITIAL_ADMIN_PASSWORD

You will be required to choose your own password on first sign-in.
This file can be safely deleted after you change the password.
EOF
  echo "[setup] One-time login saved to /opt/vibe-tb/FIRST_LOGIN.txt"
fi

# Copy nginx config
sudo cp /opt/vibe-tb/deploy/nginx.conf /etc/nginx/sites-available/vibe-tb
sudo ln -sf /etc/nginx/sites-available/vibe-tb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=== Setup complete ==="
echo ""
echo "  First-time login  (you'll be forced to change the password on first sign-in):"
echo "    URL:       $ALLOWED_ORIGIN"
echo "    Username:  admin"
echo "    Password:  $INITIAL_ADMIN_PASSWORD"
echo ""
echo "  Same info saved to /opt/vibe-tb/FIRST_LOGIN.txt"
echo "  Next step:  run deploy.sh to build the app and start PM2."
echo ""
