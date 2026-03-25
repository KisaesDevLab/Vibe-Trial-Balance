#!/bin/bash
set -e

echo "=== Deploying Vibe Trial Balance ==="

cd /opt/vibe-tb

# Install server dependencies
cd server && npm install --production
# Run migrations
npx knex migrate:latest --knexfile knexfile.ts
# Build server TypeScript
npx tsc
cd ..

# Build React frontend
cd client && npm install && npm run build
# Copy to nginx web root
sudo cp -r dist/* /var/www/vibe-tb/
cd ..

# Restart server with PM2
pm2 restart vibe-tb-server || pm2 start server/dist/app.js --name vibe-tb-server

echo "=== Deploy complete ==="
