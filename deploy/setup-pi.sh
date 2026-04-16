#!/bin/bash
set -e

echo "=== Vibe Trial Balance — Pi Setup ==="

# Require a PostgreSQL password from the caller — never ship a default. Either
# pass PG_PASSWORD=... in the environment or let the script generate one.
if [ -z "${PG_PASSWORD:-}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    PG_PASSWORD="$(openssl rand -hex 24)"
    echo "[setup] Generated random PG_PASSWORD — saving to /opt/vibe-tb/.env"
    GENERATED_PG_PASSWORD=1
  else
    echo "ERROR: PG_PASSWORD is not set and openssl is unavailable to generate one."
    echo "       Set it and re-run:  PG_PASSWORD='...' ./setup-pi.sh"
    exit 1
  fi
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

# Persist the generated password to .env so deploy.sh / ecosystem.config.js
# can pick it up. Only created if this run actually generated the value.
if [ "${GENERATED_PG_PASSWORD:-0}" = "1" ]; then
  sudo install -m 600 -o "$USER" -g "$USER" /dev/null /opt/vibe-tb/.env
  {
    echo "NODE_ENV=production"
    echo "DB_HOST=127.0.0.1"
    echo "DB_PORT=5432"
    echo "DB_NAME=vibe_tb_db"
    echo "DB_USER=vibetb"
    echo "DB_PASSWORD=$PG_PASSWORD"
  } >> /opt/vibe-tb/.env
  echo "[setup] Credentials written to /opt/vibe-tb/.env (chmod 600)"
fi

# Copy nginx config
sudo cp /opt/vibe-tb/deploy/nginx.conf /etc/nginx/sites-available/vibe-tb
sudo ln -sf /etc/nginx/sites-available/vibe-tb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== Setup complete. Edit /opt/vibe-tb/.env before running deploy.sh ==="
echo "    Ensure JWT_SECRET, ENCRYPTION_KEY, and ALLOWED_ORIGIN are set there."
