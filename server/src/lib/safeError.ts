// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Response } from 'express';

/**
 * Logs the real error server-side and sends a generic message to the client.
 * Prevents internal details (DB schema, file paths, driver errors) from leaking.
 */
export function sendServerError(
  res: Response,
  err: unknown,
  context: string,
  code = 'SERVER_ERROR',
  status = 500,
): void {
  const internal = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, internal);
  res.status(status).json({
    data: null,
    error: { code, message: 'An internal error occurred. Please try again.' },
  });
}
