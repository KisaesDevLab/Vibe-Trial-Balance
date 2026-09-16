// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import type { Request } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Rate-limit bucketing key: prefer the JWT userId (decoded, not verified — we
 * only care about grouping, not trust), fall back to client IP. This prevents
 * an entire office behind one NAT/VPN IP from sharing a single rate-limit
 * bucket when many users are authenticated, and lets the second-factor
 * endpoints limit per ACCOUNT (the pending token names the user).
 */
export function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(authHeader.slice(7)) as { userId?: number } | null;
      if (decoded?.userId) return `u:${decoded.userId}`;
    } catch {
      // fall through to IP
    }
  }
  // express 4 normalizes req.ip when trust proxy is set; fall back to the
  // unconnected socket's address, then a static string if that's also absent.
  return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
}
