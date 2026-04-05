// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

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
