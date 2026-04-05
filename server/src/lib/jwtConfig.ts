// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

/**
 * Centralized JWT configuration.
 * In production (NODE_ENV=production), JWT_SECRET MUST be set via environment variable.
 * In development, falls back to a local-only default with a console warning.
 */

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  console.error('\nFATAL: JWT_SECRET environment variable is required in production.\n');
  process.exit(1);
}

if (!isProduction && !process.env.JWT_SECRET) {
  console.warn('\n⚠️  WARNING: JWT_SECRET env var not set. Using insecure default — set JWT_SECRET before deploying.\n');
}

export const JWT_SECRET: string = process.env.JWT_SECRET ?? 'local-dev-secret-12345';
export const JWT_EXPIRY: string = process.env.JWT_EXPIRY ?? '8h';
