#!/bin/bash
set -e

echo "=== Vibe Trial Balance — Pi Setup ==="

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

# Set up PostgreSQL
sudo -u postgres psql -c "CREATE USER vibetb WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE vibe_tb_db OWNER vibetb;"

# Copy nginx config
sudo cp /opt/vibe-tb/deploy/nginx.conf /etc/nginx/sites-available/vibe-tb
sudo ln -sf /etc/nginx/sites-available/vibe-tb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== Setup complete. Edit /opt/vibe-tb/.env before running deploy.sh ==="
