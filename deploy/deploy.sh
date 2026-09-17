#!/bin/bash
set -e

echo "=== Deploying Vibe Trial Balance ==="

cd /opt/vibe-tb

# @kisaesdevlab/vibe-auth (single sign-on) is served from GitHub Packages,
# which refuses anonymous reads. The deploying user needs a token with
# read:packages in ~/.npmrc:  //npm.pkg.github.com/:_authToken=<token>
# Fail here, with a clear message, rather than half-way through npm ci.
if [[ -z "$(npm config get //npm.pkg.github.com/:_authToken 2>/dev/null | grep -v '^undefined$' | grep -v '^null$')" ]]; then
  echo "ERROR: no GitHub Packages token found." >&2
  echo "Add to ~/.npmrc:  //npm.pkg.github.com/:_authToken=<token with read:packages>" >&2
  echo "(see docs/sso.md, \"Building from source\")" >&2
  exit 1
fi

# Install server deps (full, not --production) so TypeScript is available for
# the build step. We prune dev deps after building.
cd server
npm ci

# Build server TypeScript first so dist/ is ready before migrations run.
npx tsc

# Run migrations against the compiled-JS knexfile (no TS toolchain needed at
# runtime even if dev deps are pruned later).
npx knex migrate:latest --knexfile knexfile.js

# Strip dev deps for the live process footprint.
npm prune --omit=dev
cd ..

# Build React frontend
cd client
npm ci
npm run build
sudo cp -r dist/* /var/www/vibe-tb/
cd ..

# Restart server with PM2
pm2 restart vibe-tb-server || pm2 start server/dist/app.js --name vibe-tb-server

echo "=== Deploy complete ==="
