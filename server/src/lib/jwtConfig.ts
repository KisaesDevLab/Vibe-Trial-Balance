// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Centralized JWT configuration.
 *
 * JWT_SECRET is REQUIRED in every environment. We deliberately do not provide a
 * development fallback — that used to be a well-known string baked into the
 * binary, and an operator who launched without `NODE_ENV=production` (easy to
 * forget) would silently sign real tokens with a public secret.
 *
 * The only valid setup path is: generate once with `openssl rand -hex 32`,
 * store in `.env`, and load it through the process environment.
 */

const providedSecret = process.env.JWT_SECRET;

if (!providedSecret) {
  console.error(
    '\nFATAL: JWT_SECRET environment variable is required.\n' +
    '  Generate one with:  openssl rand -hex 32\n' +
    '  Add to your .env:   JWT_SECRET=...\n',
  );
  process.exit(1);
}

if (providedSecret.length < 32) {
  console.error(
    '\nFATAL: JWT_SECRET is too short (need ≥ 32 characters of entropy).\n' +
    '  Regenerate with:  openssl rand -hex 32\n',
  );
  process.exit(1);
}

export const JWT_SECRET: string = providedSecret;
export const JWT_EXPIRY: string = process.env.JWT_EXPIRY ?? '8h';
