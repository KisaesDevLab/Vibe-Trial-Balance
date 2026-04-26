#!/bin/sh
# Vibe TB web container — runs as a docker-entrypoint.d/ hook before nginx starts.
#
# The SPA is built with `base: '/__VIBE_BASE_PATH__/'` so a single image can
# serve either '/' (single-app) or '/<prefix>/' (multi-app behind shared
# Caddy). This script substitutes the placeholder before nginx is exec'd by
# the parent /docker-entrypoint.sh.
#
# VITE_BASE_PATH defaults to '/'. A bare prefix without a trailing slash is
# normalized so React Router and asset URLs both stay consistent.

set -eu

raw="${VITE_BASE_PATH:-/}"

# Reject anything outside [A-Za-z0-9_./-]. The value lands inside `sed s|...|...|`
# at runtime; characters like `&`, `\`, `|`, `$` would break the substitution
# (sed treats `&` in the replacement as the matched string, etc.).
case "$raw" in
  *[!A-Za-z0-9_./-]*)
    echo "[web-entrypoint] ERROR: VITE_BASE_PATH='$raw' contains characters outside [A-Za-z0-9_./-]" >&2
    exit 1
    ;;
esac

case "$raw" in
  /) base='/' ;;
  /*/) base="$raw" ;;
  /*) base="${raw}/" ;;
  *) base="/${raw}/" ;;
esac

echo "[web-entrypoint] applying VITE_BASE_PATH=$base"

# Replace the build-time sentinel across SPA assets in place. Idempotent: if
# the container is restarted in place, the second pass finds no matches.
find /usr/share/nginx/html -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.map' \) \
  -exec sed -i "s|/__VIBE_BASE_PATH__/|${base}|g" {} +

# Drop a marker so the active value is observable inside the container.
echo "$base" > /usr/share/nginx/html/.base-path
