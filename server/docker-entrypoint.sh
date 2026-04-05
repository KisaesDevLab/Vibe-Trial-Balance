#!/bin/sh
# Vibe Trial Balance — Docker entrypoint
# Runs migrations, seeds on first launch (if DB is empty), then starts the server.

set -e
cd /app/server

echo "[entrypoint] Running database migrations..."
npx knex migrate:latest --knexfile knexfile.js

# Check if this is a fresh database (no admin user exists)
ADMIN_EXISTS=$(node -e "
  const knex = require('knex')(require('./knexfile.js'));
  knex('app_users').where({username:'admin'}).first('id')
    .then(r => { console.log(r ? 'yes' : 'no'); process.exit(0); })
    .catch(() => { console.log('no'); process.exit(0); });
" 2>/dev/null || echo "no")

if [ "$ADMIN_EXISTS" = "no" ]; then
  echo "[entrypoint] Fresh database detected — running seeds..."
  npx knex seed:run --knexfile knexfile.js
  echo "[entrypoint] Database seeded (admin user, tax codes, templates)"
else
  echo "[entrypoint] Database already initialized — skipping seeds"
fi

echo "[entrypoint] Starting server..."
exec node dist/app.js
