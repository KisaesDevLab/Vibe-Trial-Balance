// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * `name('general-ledger.xlsx')` → "FY2024_Acme Holdings LLC_general-ledger.xlsx"
 * for the selected client and period — the same `<period>_<client>_<report>`
 * the server puts on every PDF, for the spreadsheets a page builds itself.
 *
 * Reads the `['clients']` and `['periods', clientId]` caches under the same
 * keys and fetchers every page uses, so on a page that already loads them this
 * costs nothing, and on one that does not it is a single cached fetch.
 * Before either list has arrived the prefix is simply shorter (the helper
 * drops a missing part), never wrong.
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { useUIStore } from '../store/uiStore';
import { engagementFilename } from '../utils/reportFilename';

export function useEngagementFilename(): (baseName: string) => string {
  const { selectedClientId, selectedPeriodId } = useUIStore();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => { const r = await listClients(); return r.data ?? []; },
  });
  const { data: periods } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => { const r = await listPeriods(selectedClientId!); return r.data ?? []; },
    enabled: selectedClientId !== null,
  });

  const clientName = clients?.find((c) => c.id === selectedClientId)?.name ?? null;
  const periodName = periods?.find((p) => p.id === selectedPeriodId)?.period_name ?? null;

  return useCallback(
    (baseName: string) => engagementFilename(periodName, clientName, baseName),
    [periodName, clientName],
  );
}
