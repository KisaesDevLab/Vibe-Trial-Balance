#!/bin/sh
# Vibe Trial Balance — Docker entrypoint
#
# Behavior is gated by MIGRATIONS_AUTO (default: true):
#
#   true   — standalone deploys. Run `knex migrate:latest`, then check whether
#            the database has been seeded yet (admin user exists?) and run
#            `knex seed:run` if not. Then start the server.
#
#   false  — appliance / orchestrated deploys where migrations and seeds run
#            as explicit one-shot containers BEFORE this entrypoint fires.
#            Skip both — the operator is in control. The server itself has
#            a startup-time guard that refuses to start if migrations are
#            still pending, so a misconfigured deploy fails loudly.

set -e
cd /app/server

# TypeScript layout note: tsconfig.json includes both `src/**/*` and
# `../shared/**/*`. With no explicit `rootDir`, tsc computes it as the
# common ancestor of those inputs — `/app` — and emits to
# `dist/server/src/*.js` (preserving the layout below rootDir), NOT
# `dist/*.js`. Keep the dist paths below in sync with that reality.

if [ "${MIGRATIONS_AUTO:-true}" = "true" ]; then
  echo "[entrypoint] Running database migrations (MIGRATIONS_AUTO=true)..."
  npx knex migrate:latest --knexfile knexfile.js

  # Check if this is a fresh database (no admin user exists). The query is
  # safe to run AFTER migrations because the schema now exists.
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
else
  echo "[entrypoint] MIGRATIONS_AUTO=false — skipping auto-migration and auto-seed"
  echo "[entrypoint]   Run \`node dist/server/src/migrate.js\` and \`npx knex seed:run --knexfile knexfile.js\`"
  echo "[entrypoint]   as one-shot containers before starting this service."
fi

echo "[entrypoint] Starting server..."
exec node dist/server/src/app.js
