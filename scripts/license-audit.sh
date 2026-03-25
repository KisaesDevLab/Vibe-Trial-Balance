#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# License audit script for Vibe Trial Balance
# Checks all npm dependencies against the project license policy.
#
# Usage: ./scripts/license-audit.sh
#
# Requires: npx (comes with npm)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Vibe Trial Balance — License Audit ===${NC}"
echo ""

# Allowed licenses per CLAUDE.md policy
ALLOWED_RE="^(MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|BlueOak-1.0.0|Unlicense|AGPL-3.0|AGPL-3.0-only|AGPL-3.0-or-later|0BSD|CC0-1.0|Python-2.0|CC-BY-4.0|CC-BY-3.0|Zlib)$"

# Review-required licenses
REVIEW_RE="^(LGPL-2.1|LGPL-3.0|LGPL-2.1-only|LGPL-3.0-only|MPL-2.0|GPL-3.0-or-later)$"

# Denied licenses
DENIED_RE="^(GPL-2.0-only|SSPL-1.0|BUSL-1.1)$"

# Known exceptions
KNOWN_EXCEPTIONS="buffers@0.1.1"

TOTAL_DENIED=0
TOTAL_REVIEW=0
TOTAL_UNKNOWN=0

audit_workspace() {
  local name="$1"
  local dir="$2"

  if [ ! -d "$dir/node_modules" ]; then
    echo -e "${YELLOW}SKIP: $name — no node_modules${NC}"
    return
  fi

  echo -e "${CYAN}--- Checking $name ---${NC}"

  # Run license-checker and get CSV output (easier to parse in bash)
  local csv
  csv=$(cd "$dir" && npx --yes license-checker --excludePrivatePackages --csv 2>/dev/null) || {
    echo -e "${RED}ERROR: license-checker failed for $name${NC}"
    return
  }

  local denied=0
  local review=0
  local unknown=0
  local checked=0

  # Skip header line, process each package
  echo "$csv" | tail -n +2 | while IFS=',' read -r pkg_quoted license_quoted rest; do
    # Strip quotes
    local pkg="${pkg_quoted//\"/}"
    local license="${license_quoted//\"/}"

    [ -z "$pkg" ] && continue
    checked=$((checked + 1))

    # Skip known exceptions
    for exc in $KNOWN_EXCEPTIONS; do
      if [[ "$pkg" == *"$exc"* ]]; then
        continue 2
      fi
    done

    # Normalize: handle "MIT*", "(MIT OR Apache-2.0)", etc.
    local clean_license
    clean_license=$(echo "$license" | sed 's/\*//g; s/[()]//g; s/ OR /\n/g; s/ AND /\n/g')

    local pkg_ok=true
    local pkg_denied=false
    local pkg_review=false
    local pkg_unknown=false

    while IFS= read -r lic; do
      lic=$(echo "$lic" | xargs) # trim whitespace
      [ -z "$lic" ] && continue

      if [[ "$lic" =~ $DENIED_RE ]]; then
        pkg_denied=true
        pkg_ok=false
      elif [[ "$lic" == "UNKNOWN" || "$lic" == "UNLICENSED" ]]; then
        pkg_unknown=true
        pkg_ok=false
      elif [[ "$lic" =~ $REVIEW_RE ]]; then
        pkg_review=true
      elif [[ ! "$lic" =~ $ALLOWED_RE ]]; then
        pkg_unknown=true
        pkg_ok=false
      fi
    done <<< "$clean_license"

    if $pkg_denied; then
      echo -e "  ${RED}DENIED:  $pkg — $license${NC}"
    elif $pkg_unknown; then
      echo -e "  ${YELLOW}UNKNOWN: $pkg — $license${NC}"
    elif $pkg_review; then
      echo -e "  ${YELLOW}REVIEW:  $pkg — $license${NC}"
    fi
  done

  # Count issues (re-process since subshell can't modify parent vars)
  local denied_count review_count unknown_count
  denied_count=$(echo "$csv" | tail -n +2 | awk -F',' '{gsub(/"/, "", $2); print $2}' | grep -cE "$DENIED_RE" 2>/dev/null || echo 0)
  unknown_count=$(echo "$csv" | tail -n +2 | awk -F',' '{gsub(/"/, "", $2); print $2}' | grep -cE "^(UNKNOWN|UNLICENSED)$" 2>/dev/null || echo 0)
  review_count=$(echo "$csv" | tail -n +2 | awk -F',' '{gsub(/"/, "", $2); print $2}' | grep -cE "$REVIEW_RE" 2>/dev/null || echo 0)
  local total_pkgs
  total_pkgs=$(echo "$csv" | tail -n +2 | wc -l | xargs)

  echo -e "  Scanned $total_pkgs packages"
  denied_count=$(echo "$denied_count" | tr -d '[:space:]')
  review_count=$(echo "$review_count" | tr -d '[:space:]')
  unknown_count=$(echo "$unknown_count" | tr -d '[:space:]')
  TOTAL_DENIED=$((TOTAL_DENIED + denied_count))
  TOTAL_REVIEW=$((TOTAL_REVIEW + review_count))
  TOTAL_UNKNOWN=$((TOTAL_UNKNOWN + unknown_count))
  echo ""
}

# Audit each workspace
audit_workspace "root"   "$PROJECT_ROOT"
audit_workspace "client" "$PROJECT_ROOT/client"
audit_workspace "server" "$PROJECT_ROOT/server"

# Summary
echo -e "${CYAN}=== Summary ===${NC}"
if [ "$TOTAL_DENIED" -gt 0 ]; then
  echo -e "${RED}  DENIED licenses: $TOTAL_DENIED — these MUST be removed${NC}"
fi
if [ "$TOTAL_REVIEW" -gt 0 ]; then
  echo -e "${YELLOW}  Review-required: $TOTAL_REVIEW — verify AGPL-3.0 compatibility${NC}"
fi
if [ "$TOTAL_UNKNOWN" -gt 0 ]; then
  echo -e "${YELLOW}  Unknown/unlicensed: $TOTAL_UNKNOWN — investigate before release${NC}"
fi
if [ "$TOTAL_DENIED" -eq 0 ] && [ "$TOTAL_REVIEW" -eq 0 ] && [ "$TOTAL_UNKNOWN" -eq 0 ]; then
  echo -e "${GREEN}  All dependencies have approved licenses. No issues found.${NC}"
fi

echo ""
echo -e "${CYAN}Known exceptions:${NC}"
echo "  buffers@0.1.1: No license field. Transitive via exceljs. Accepted."

# Exit non-zero if denied licenses found
if [ "$TOTAL_DENIED" -gt 0 ]; then
  exit 1
fi
