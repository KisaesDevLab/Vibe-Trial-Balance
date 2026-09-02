// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The ONE query for `['qbo-connections']`. Every page that needs a client's
 * QuickBooks connection goes through here, because the key is shared across
 * pages and TanStack caches whatever shape the first fetcher stored: when the
 * QuickBooks page stored `{ rows, meta }` and the TB page stored a bare array,
 * navigating between them crashed the second page with
 * "x.find is not a function".
 */

import { useQuery } from '@tanstack/react-query';
import { listQboConnections, type QboConnectionRow, type QboEnvironment } from '../api/qbo';

export interface QboConnectionsData {
  rows: QboConnectionRow[];
  meta: { configured: boolean; environment: QboEnvironment };
}

export const QBO_CONNECTIONS_KEY = ['qbo-connections'] as const;

export function useQboConnections(enabled = true) {
  return useQuery<QboConnectionsData>({
    queryKey: QBO_CONNECTIONS_KEY,
    queryFn: async () => {
      const res = await listQboConnections();
      if (res.error) throw new Error(res.error.message);
      return { rows: res.data ?? [], meta: res.meta ?? { configured: false, environment: 'sandbox' } };
    },
    enabled,
  });
}

/** The connection for one client, or null when it has none (or the list has not loaded). */
export function findQboConnection(data: QboConnectionsData | undefined, clientId: number | null | undefined): QboConnectionRow | null {
  if (!data || clientId == null) return null;
  return data.rows.find((c) => c.clientId === clientId) ?? null;
}
